"""Knowledge Builder service — builds and retrieves project-aware knowledge from analysis results."""
from __future__ import annotations

import hashlib
import re
import time
from typing import Any

from server.storage.db import execute, query

VALID_CHUNK_TYPES = {
    "file", "symbol", "documentation", "config", "api", "dependency", "relationship", "code"
}


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def get_project_knowledge_state(user_id: str, project_id: str) -> dict:
    rows = query(
        "SELECT version_id, chunk_index FROM project_chunks WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
        (project_id,),
    )
    return {"version_id": rows[0]["version_id"] if rows else None, "chunk_count": len(query(
        "SELECT id FROM project_chunks WHERE project_id = ?", (project_id,)
    ))}


def build_project_knowledge(user_id: str, project_id: str, version_id: str | None = None) -> dict:
    """Build/rebuild knowledge chunks for a project version using real analysis results."""
    from server.services.codebase_service import get_project
    if not get_project(user_id, project_id):
        return {"ok": False, "error": "Project not found", "status": "failed"}

    if version_id is None:
        ver_rows = query(
            "SELECT id FROM project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1",
            (project_id,),
        )
        version_id = ver_rows[0]["id"] if ver_rows else None

    # Read analysis results linked to this version
    files = query("SELECT * FROM project_files WHERE project_id = ? AND (version_id = ? OR version_id IS NULL)", (project_id, version_id))
    symbols = query("SELECT * FROM project_symbols WHERE project_id = ? AND version_id = ?", (project_id, version_id))
    relationships = query("SELECT * FROM code_relationships WHERE project_id = ? AND version_id = ?", (project_id, version_id))
    evidence_rows = query("SELECT * FROM evidence WHERE project_id = ? AND version_id = ?", (project_id, version_id))
    api_evidence = [e for e in evidence_rows if e.get("evidence_type") == "api_discovery"]
    import_evidence = [e for e in evidence_rows if e.get("evidence_type") == "imports"]

    # Deduplicate index tracking per content hash + version
    created = 0
    reused = 0
    errors = 0

    # Helper to upsert chunk
    def upsert_chunk(chunk_data: dict):
        nonlocal created, reused, errors
        chash = chunk_data.get("content_hash", _hash(chunk_data.get("content", "")))
        chunk_data["content_hash"] = chash
        # Deduplicate within same version/project/file/symbol combo
        existing = query(
            "SELECT id FROM project_chunks WHERE project_id = ? AND version_id = ? AND file_path = ? AND symbol_name = ? AND chunk_type = ? AND content_hash = ?",
            (project_id, version_id, chunk_data.get("file_path"), chunk_data.get("symbol_name"), chunk_data.get("chunk_type"), chash),
            one=True,
        )
        if existing:
            reused += 1
            return existing["id"]
        sid = chunk_data.get("chunk_id") or f"chk_{hashlib.sha256(str(time.time()).encode()).hexdigest()[:12]}_{created}"
        chunk_data["chunk_id"] = sid
        try:
            execute(
                "INSERT OR IGNORE INTO project_chunks (id, project_id, version_id, run_id, chunk_index, file_path, file_id, symbol_name, symbol_type, chunk_type, language, line_start, line_end, content, content_hash, embedding_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    sid,
                    project_id,
                    version_id,
                    chunk_data.get("run_id"),
                    chunk_data.get("chunk_index", 0),
                    chunk_data.get("file_path"),
                    chunk_data.get("file_id"),
                    chunk_data.get("symbol_name"),
                    chunk_data.get("symbol_type"),
                    chunk_data.get("chunk_type", "file"),
                    chunk_data.get("language"),
                    chunk_data.get("line_start"),
                    chunk_data.get("line_end"),
                    chunk_data.get("content"),
                    chash,
                    chunk_data.get("embedding_id"),
                    time.time(),
                ),
            )
            created += 1
        except Exception as e:
            errors += 1
        return sid

    # 1. File chunks
    for f in files:
        fp = f.get("path", "")
        ext = f.get("ext", "")
        content = (f.get("content") or "")[:120_000]
        if content:
            upsert_chunk({
                "run_id": None,
                "chunk_index": 0,
                "file_path": fp,
                "file_id": f.get("id"),
                "symbol_name": None,
                "symbol_type": None,
                "chunk_type": "file",
                "language": f.get("language", "unknown"),
                "line_start": 1,
                "line_end": len(content.splitlines()),
                "content": content,
            })

    # 2. Symbol chunks
    for sym in symbols:
        fp = sym.get("file_path", "")
        # Find file content from files table for source context
        file_row = query("SELECT content FROM project_files WHERE project_id = ? AND path = ?", (project_id, fp), one=True)
        content_preview = (file_row.get("content") or "")[:120_000] if file_row else ""
        if content_preview:
            upsert_chunk({
                "run_id": None,
                "chunk_index": 0,
                "file_path": fp,
                "file_id": None,
                "symbol_name": sym.get("symbol_name") or sym.get("symbol"),
                "symbol_type": sym.get("symbol_type") or sym.get("type"),
                "chunk_type": "symbol",
                "language": sym.get("language", "unknown"),
                "line_start": sym.get("line_start"),
                "line_end": sym.get("line_end"),
                "content": f"Symbol: {sym.get('symbol_name') or sym.get('symbol')} ({sym.get('symbol_type') or sym.get('type')}) in {fp}\n{content_preview}",
            })

    # 3. Dependency chunks
    for rel in relationships:
        from_path = rel.get("from_file_path") or rel.get("from_path")
        to_path = rel.get("to_file_path") or rel.get("to_path")
        if from_path and to_path:
            upsert_chunk({
                "run_id": rel.get("run_id"),
                "chunk_index": 0,
                "file_path": from_path,
                "file_id": None,
                "symbol_name": rel.get("from_symbol"),
                "symbol_type": None,
                "chunk_type": "dependency",
                "language": None,
                "line_start": None,
                "line_end": None,
                "content": f"Dependency: {from_path} imports/references {to_path} (type: {rel.get('relationship_type')}, confidence: {rel.get('confidence')})",
            })

    # 4. API chunks (from evidence with api_discovery)
    for ev in api_evidence:
        fp = ev.get("path", "")
        line_start = ev.get("line_start")
        upsert_chunk({
            "run_id": ev.get("run_id"),
            "chunk_index": 0,
            "file_path": fp,
            "file_id": ev.get("project_file_id"),
            "symbol_name": None,
            "symbol_type": None,
            "chunk_type": "api",
            "language": None,
            "line_start": line_start,
            "line_end": ev.get("line_end"),
            "content": f"API endpoint discovered in {fp} at line {line_start}: {ev.get('observation', '')}",
        })

    # 5. Documentation chunks (README.md / docs)
    docs = [f for f in files if f.get("path", "").lower().endswith(".md") or f.get("file_type") == "text"]
    for doc in docs:
        fp = doc.get("path", "")
        content = doc.get("content", "")[:120_000]
        if content:
            upsert_chunk({
                "run_id": None,
                "chunk_index": 0,
                "file_path": fp,
                "file_id": doc.get("id"),
                "symbol_name": None,
                "symbol_type": None,
                "chunk_type": "documentation",
                "language": None,
                "line_start": 1,
                "line_end": len(content.splitlines()),
                "content": content,
            })

    # 6. Config chunks
    configs = [f for f in files if f.get("ext", "").lower() in {".json", ".yaml", ".yml", ".ini", ".env", ".toml"} or f.get("file_type") == "config"]
    for cfg in configs:
        fp = cfg.get("path", "")
        content = cfg.get("content", "")[:120_000]
        if content:
            upsert_chunk({
                "run_id": None,
                "chunk_index": 0,
                "file_path": fp,
                "file_id": cfg.get("id"),
                "symbol_name": None,
                "symbol_type": None,
                "chunk_type": "config",
                "language": cfg.get("language", "unknown"),
                "line_start": 1,
                "line_end": len(content.splitlines()),
                "content": content,
            })

    # Status tracking
    total = len(query("SELECT id FROM project_chunks WHERE project_id = ? AND (version_id = ? OR version_id IS NULL)", (project_id, version_id)))
    return {
        "ok": True,
        "project_id": project_id,
        "version_id": version_id,
        "status": "completed",
        "files_processed": len(files),
        "chunks_created": created,
        "chunks_reused": reused,
        "errors": errors,
        "total_chunks": total,
    }


def get_project_knowledge(user_id: str, project_id: str, version_id: str | None = None) -> list[dict]:
    from server.services.codebase_service import get_project
    if not get_project(user_id, project_id):
        return []
    sql_base = "SELECT * FROM project_chunks WHERE project_id = ?"
    params = [project_id]
    if version_id:
        sql_base += " AND version_id = ?"
        params.append(version_id)
    sql_base += " ORDER BY created_at DESC LIMIT 100"
    rows = query(sql_base, tuple(params),)
    result = []
    for r in rows:
        # Only include chunks from requested version (or all if version not specified but user owns project)
        if version_id is None or r.get("version_id") == version_id or r.get("version_id") is None:
            result.append({
                "chunk_id": r["id"],
                "project_id": r["project_id"],
                "version_id": r.get("version_id"),
                "run_id": r.get("run_id"),
                "chunk_type": r.get("chunk_type"),
                "file_path": r.get("file_path"),
                "language": r.get("language"),
                "symbol_name": r.get("symbol_name"),
                "symbol_type": r.get("symbol_type"),
                "line_start": r.get("line_start"),
                "line_end": r.get("line_end"),
                "content": r.get("content", "")[:4000],
                "content_hash": r.get("content_hash"),
            })
    return result


def search_project_knowledge(
    user_id: str,
    project_id: str,
    query_text: str,
    version_id: str | None = None,
    top_k: int = 8,
) -> list[dict]:
    from server.services.codebase_service import get_project
    if not get_project(user_id, project_id):
        return []

    # Lexical/exact search: split query into keywords and match any keyword
    words = re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b", (query_text or "").lower())
    if not words:
        words = [(query_text or "").lower().strip()]
    or_parts = []
    word_params = []
    for w in words:
        or_parts.append("(content LIKE ? OR file_path LIKE ? OR symbol_name LIKE ?)")
        word_params.extend([f"%{w}%", f"%{w}%", f"%{w}%"])
    if version_id:
        sql_where = "SELECT * FROM project_chunks WHERE project_id = ? AND version_id = ? AND (" + " OR ".join(or_parts) + ") ORDER BY created_at DESC LIMIT ?"
        params = [project_id, version_id, *word_params, top_k * 2]
    else:
        sql_where = "SELECT * FROM project_chunks WHERE project_id = ? AND (" + " OR ".join(or_parts) + ") ORDER BY created_at DESC LIMIT ?"
        params = [project_id, *word_params, top_k * 2]
    lexical_rows = query(sql_where, tuple(params),)

    # Basic ranking (exact file/symbol match scores higher)
    scored = []
    for r in lexical_rows:
        score = 0
        q_lower = (query_text or "").lower()
        content_lower = (r.get("content") or "").lower()
        path = r.get("file_path") or ""
        sym = r.get("symbol_name") or ""
        # Exact file/symbol match
        if q_lower in path.lower():
            score += 10
        if sym and q_lower in sym.lower():
            score += 15
        # Content lexical match
        if q_lower in content_lower:
            score += 5
        scored.append({
            "chunk_id": r.get("id"),
            "chunk_type": r.get("chunk_type"),
            "file_path": r.get("file_path"),
            "symbol_name": r.get("symbol_name"),
            "symbol_type": r.get("symbol_type"),
            "line_start": r.get("line_start"),
            "line_end": r.get("line_end"),
            "content": (r.get("content") or "")[:2000],
            "content_preview": (r.get("content") or "")[:400],
            "version_id": r.get("version_id") or version_id,
            "evidence_ref": None,
            "score": score,
            "search_type": "lexical",
        })

    # Deduplicate and sort
    seen = set()
    result = []
    for item in sorted(scored, key=lambda x: x["score"], reverse=True):
        if item["chunk_id"] not in seen:
            seen.add(item["chunk_id"])
            result.append(item)
        if len(result) >= top_k:
            break
    return result


# Minimal embedding provider abstraction
class EmbeddingProvider:
    def __init__(self, provider_id: str | None = None):
        self.provider_id = provider_id
        self.available = provider_id is not None

    def embed_text(self, text: str) -> list[float] | None:
        """Return embedding vector or None if unavailable."""
        if not self.available:
            return None
        # Placeholder for future provider integration; returns dummy for now
        return [0.0] * 384

    def embed_documents(self, texts: list[str]) -> list[list[float]] | None:
        if not self.available:
            return None
        return [[0.0] * 384 for _ in texts]


# Default provider instance (can be configured)
embedding_provider = EmbeddingProvider()
