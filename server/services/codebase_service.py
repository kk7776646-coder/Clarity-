"""Projects: creation, indexing and keyword retrieval over indexed chunks."""

import json
import logging
import os
import re
import time
import uuid
from typing import Any

from server.services.file_service import CODE_EXTENSIONS, extract_text_from_file
from server.storage.db import execute, query

log = logging.getLogger(__name__)

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200
MAX_INDEXED_CHARS = 50_000


def create_project(user_id: str, name: str, description: str = "") -> str:
    pid = f"proj_{uuid.uuid4().hex[:12]}"
    execute(
        "INSERT INTO projects (id, user_id, name, created_at, description) VALUES (?, ?, ?, ?, ?)",
        (pid, user_id, name, time.time(), description),
    )
    return pid


def get_project(user_id: str, pid: str) -> dict[str, Any] | None:
    return query(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (pid, user_id),
        one=True,
    )


def list_projects(user_id: str) -> list[dict[str, Any]]:
    return query(
        "SELECT p.*, (SELECT COUNT(*) FROM project_files pf WHERE pf.project_id = p.id) AS file_count"
        " FROM projects p WHERE p.user_id = ? ORDER BY p.created_at DESC",
        (user_id,),
    )


def delete_project(user_id: str, pid: str) -> int:
    if not get_project(user_id, pid):
        return 0
    execute("DELETE FROM embeddings WHERE project_id = ?", (pid,))
    execute("DELETE FROM project_files WHERE project_id = ?", (pid,))
    return execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (pid, user_id))


def index_project_files(user_id: str, project_id: str) -> dict[str, Any]:
    """(Re)build the chunk index for a project's registered files."""
    if not get_project(user_id, project_id):
        return {"error": "Project not found", "file_count": 0, "chunk_count": 0}

    files = query("SELECT * FROM project_files WHERE project_id = ? ORDER BY path", (project_id,))

    # Backfill text for rows stored without extracted content.
    for pf in files:
        if pf.get("content"):
            continue
        frow = query("SELECT path FROM files WHERE id = ?", (pf.get("file_id"),), one=True) if pf.get("file_id") else None
        disk_path = frow["path"] if frow else None
        if disk_path and os.path.exists(disk_path):
            content = extract_text_from_file(disk_path, limit=MAX_INDEXED_CHARS)
            execute("UPDATE project_files SET content = ? WHERE id = ?", (content, pf["id"]))
            pf["content"] = content

    execute("DELETE FROM embeddings WHERE project_id = ?", (project_id,))
    chunk_count = _chunk_files(project_id, files)

    return {
        "project_id": project_id,
        "file_count": len(files),
        "chunk_count": chunk_count,
        "imports": _extract_imports(files),
    }


def get_project_tree(user_id: str, project_id: str) -> dict[str, Any]:
    if not get_project(user_id, project_id):
        return {}
    rows = query(
        "SELECT path, name, ext, size FROM project_files WHERE project_id = ? ORDER BY path",
        (project_id,),
    )
    return _build_tree(rows)


def get_file_content(user_id: str, project_id: str, file_path: str) -> str | None:
    if not get_project(user_id, project_id):
        return None
    row = query(
        "SELECT content FROM project_files WHERE project_id = ? AND path = ?",
        (project_id, file_path),
        one=True,
    )
    return row["content"] if row else None


def retrieve_relevant_chunks(project_id: str, search_text: str, limit: int = 8) -> list[dict[str, Any]]:
    """Rank indexed chunks by keyword overlap with the query."""
    chunks = query(
        "SELECT id, file_path, chunk_index, content FROM embeddings WHERE project_id = ?",
        (project_id,),
    )
    if not chunks:
        return []
    words = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b", (search_text or "").lower()))
    if not words:
        return [_chunk_view(c) for c in chunks[:limit]]
    scored = []
    for ch in chunks:
        lowered = (ch["content"] or "").lower()
        score = sum(1 for w in words if w in lowered)
        if score:
            scored.append((score, ch))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [_chunk_view(c) for _, c in scored[:limit]]


# --------------------------------------------------------------------------
# Internals
# --------------------------------------------------------------------------

def _chunk_view(chunk: dict[str, Any]) -> dict[str, Any]:
    return {
        "file_path": chunk["file_path"],
        "content": chunk["content"],
        "chunk_index": chunk["chunk_index"],
    }


def _build_tree(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tree: dict[str, Any] = {}
    for r in rows:
        parts = [p for p in str(r["path"]).split("/") if p]
        node = tree
        for i, part in enumerate(parts):
            is_file = i == len(parts) - 1
            if part not in node:
                node[part] = {
                    "name": part,
                    "path": r["path"] if is_file else "/".join(parts[: i + 1]),
                    "ext": r["ext"] if is_file else "",
                    "size": r["size"] if is_file else None,
                    "children": None if is_file else {},
                }
            if not is_file:
                if node[part]["children"] is None:
                    node[part]["children"] = {}
                node = node[part]["children"]
    return tree


def _extract_imports(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pattern = re.compile(
        r"""(?:^|\n)\s*(?:import|export\s+.*?\s+from)\s+['"]([^'"]+)['"]""",
        re.MULTILINE,
    )
    results = []
    for pf in files:
        if pf.get("ext") not in CODE_EXTENSIONS:
            continue
        content = pf.get("content") or ""
        if not content:
            continue
        for imp in dict.fromkeys(pattern.findall(content)):
            results.append({"file": pf["path"], "import_path": imp, "type": "import"})
    return results


def _chunk_files(project_id: str, files: list[dict[str, Any]]) -> int:
    rows: list[tuple] = []
    index = 0
    for pf in files:
        content = pf.get("content") or ""
        if not content:
            continue
        if pf.get("ext") not in CODE_EXTENSIONS and pf.get("file_type") not in ("code", "text", "document"):
            continue
        step = max(1, CHUNK_SIZE - CHUNK_OVERLAP)
        for start in range(0, len(content), step):
            chunk_text = content[start:start + CHUNK_SIZE]
            if not chunk_text.strip():
                continue
            rows.append((
                f"chunk_{uuid.uuid4().hex[:12]}",
                project_id,
                pf["path"],
                index,
                chunk_text,
                _keyword_vector(chunk_text),
            ))
            index += 1
            if start + CHUNK_SIZE >= len(content):
                break
    if rows:
        from server.storage.db import executemany

        executemany(
            "INSERT INTO embeddings (id, project_id, file_path, chunk_index, content, vector)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
    return len(rows)


def _keyword_vector(text: str) -> str:
    words = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]{3,}\b", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    top = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[:30]
    return json.dumps([w for w, _ in top])
