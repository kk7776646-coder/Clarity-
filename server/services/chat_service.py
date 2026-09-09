"""Conversation persistence and prompt assembly.

Every read and write is scoped to a user id so one account can never observe
or mutate another account's history.
"""

import logging
import os
import time
import uuid
from typing import Any

from server.storage.db import execute, query

log = logging.getLogger(__name__)

MAX_ATTACHMENT_CHARS = 8000
RAG_CHUNK_LIMIT = 5


# --------------------------------------------------------------------------
# Conversations
# --------------------------------------------------------------------------

def create_conversation(user_id: str, title: str, model_id: str | None) -> str:
    cid = f"conv_{uuid.uuid4().hex[:12]}"
    now = time.time()
    execute(
        "INSERT INTO conversations (id, user_id, title, model_id, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (cid, user_id, title, model_id, now, now),
    )
    return cid


def get_conversation(user_id: str, cid: str) -> dict[str, Any] | None:
    return query(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (cid, user_id),
        one=True,
    )


def list_conversations(user_id: str, limit: int = 100) -> list[dict[str, Any]]:
    rows = query(
        "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,"
        " (SELECT m.content FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.timestamp DESC LIMIT 1) AS last_user_message"
        " FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT ?",
        (user_id, limit),
    )
    return rows


def update_conversation_title(user_id: str, cid: str, title: str) -> int:
    return execute(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (title, time.time(), cid, user_id),
    )


def set_conversation_model(user_id: str, cid: str, model_id: str) -> None:
    execute(
        "UPDATE conversations SET model_id = ? WHERE id = ? AND user_id = ?",
        (model_id, cid, user_id),
    )


def touch_conversation_by_id(cid: str) -> None:
    """Bump the timestamp for an already-authorised conversation."""
    execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (time.time(), cid))


def touch_conversation(user_id: str, cid: str) -> None:
    """Bump the timestamp for the given conversation if it belongs to the user."""
    execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?",
        (time.time(), cid, user_id),
    )


def delete_conversation(user_id: str, cid: str) -> int:
    # Messages cascade through the foreign key; delete explicitly as well so the
    # rows also disappear on databases created before foreign keys were enforced.
    execute(
        "DELETE FROM messages WHERE conversation_id IN"
        " (SELECT id FROM conversations WHERE id = ? AND user_id = ?)",
        (cid, user_id),
    )
    return execute("DELETE FROM conversations WHERE id = ? AND user_id = ?", (cid, user_id))


def delete_all_conversations(user_id: str) -> int:
    """Delete all conversations and their messages for a user."""
    execute(
        "DELETE FROM messages WHERE conversation_id IN"
        " (SELECT id FROM conversations WHERE user_id = ?)",
        (user_id,),
    )
    return execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))


# --------------------------------------------------------------------------
# Messages
# --------------------------------------------------------------------------

def save_message(user_id: str, cid: str, role: str, content: str, model_id: str | None = None) -> str:
    mid = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    execute(
        "INSERT INTO messages (id, conversation_id, role, content, model_id, timestamp)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (mid, cid, role, content, model_id, now),
    )
    execute("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?", (now, cid, user_id))
    return mid


def get_messages(user_id: str, cid: str) -> list[dict[str, Any]]:
    rows = query(
        "SELECT m.id, m.role, m.content, m.model_id, m.timestamp FROM messages m"
        " JOIN conversations c ON c.id = m.conversation_id"
        " WHERE m.conversation_id = ? AND c.user_id = ? ORDER BY m.timestamp ASC",
        (cid, user_id),
    )
    # Load attachments per message
    msg_ids = [r["id"] for r in rows]
    attachments_map: dict[str, list[dict]] = {}
    if msg_ids:
        placeholders = ",".join("?" for _ in msg_ids)
        att_rows = query(
            f"SELECT ma.message_id, ma.file_id, ma.name, ma.mime FROM message_attachments ma"
            f" WHERE ma.message_id IN ({placeholders})",
            tuple(msg_ids),
        )
        for ar in att_rows:
            mid = ar["message_id"]
            if mid not in attachments_map:
                attachments_map[mid] = []
            attachments_map[mid].append({
                "file_id": ar["file_id"],
                "name": ar["name"],
                "mime": ar["mime"],
            })
    # Enrich messages with attachments
    for r in rows:
        r["attachments"] = attachments_map.get(r["id"], [])
    return rows


def update_message(user_id: str, cid: str, msg_id: str, content: str) -> int:
    rows = execute(
        "UPDATE messages SET content = ? WHERE id = ? AND conversation_id = ?"
        " AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)",
        (content, msg_id, cid, user_id),
    )
    if rows:
        execute("UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?", (time.time(), cid, user_id))
    return rows


def save_message_with_attachments(
    user_id: str,
    cid: str,
    role: str,
    content: str,
    model_id: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
) -> str:
    """Save a message and optionally attach file records to it."""
    mid = save_message(user_id, cid, role, content, model_id)
    if attachments:
        for att in attachments:
            att_id = f"att_{uuid.uuid4().hex[:12]}"
            execute(
                "INSERT INTO message_attachments (id, message_id, file_id, name, mime)"
                " VALUES (?, ?, ?, ?, ?)",
                (att_id, mid, att["file_id"], att.get("name"), att.get("mime")),
            )
    return mid


def parse_file_markers(text: str) -> tuple[str, list[dict[str, Any]]]:
    """Extract [FILE: name] blocks from AI response text.

    Returns (cleaned_text, files) where files is a list of
    {filename, content} dicts. The [FILE: ...] blocks are removed
    from the returned text. Outer markdown code fences are stripped
    from the file content.
    """
    import re

    files = []
    pattern = re.compile(
        r'\[FILE:\s*([^\]]+)\]\s*\n?(.*?)\[ENDFILE\]',
        re.DOTALL | re.IGNORECASE,
    )

    def strip_outer_fences(content: str) -> str:
        """Remove outer markdown code fences (```lang\\n ... \\n```) if present."""
        content = content.strip()
        fence_pattern = re.compile(r'^```(\w*)\n(.*)\n```$', re.DOTALL)
        match = fence_pattern.match(content)
        if match:
            return match.group(2)
        return content

    def replacer(match):
        filename = match.group(1).strip()
        content = match.group(2).rstrip("\n")
        content = strip_outer_fences(content)
        if filename and content:
            files.append({"filename": filename, "content": content})
        return ""

    cleaned = pattern.sub(replacer, text)
    cleaned = cleaned.rstrip()
    return cleaned, files


def save_generated_files_and_attachments(
    user_id: str,
    cid: str | None,
    files: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Save generated files and return attachment records for message linking."""
    if not files:
        return []

    from server.services.file_service import save_generated_file

    attachments = []
    for f in files:
        try:
            info = save_generated_file(
                filename=f["filename"],
                content=f["content"],
                user_id=user_id,
                conversation_id=cid,
            )
            attachments.append({
                "file_id": info["id"],
                "name": info["filename"],
                "mime": info["mime"],
            })
        except Exception:
            pass
    return attachments


def delete_messages(cid: str, msg_ids: list[str]) -> None:
    if not msg_ids:
        return
    placeholders = ",".join("?" for _ in msg_ids)
    execute(
        f"DELETE FROM messages WHERE conversation_id = ? AND id IN ({placeholders})",
        (cid, *msg_ids),
    )
    execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (time.time(), cid))


# --------------------------------------------------------------------------
# Prompt assembly (RAG retrieval + attachments)
# --------------------------------------------------------------------------

def build_context(
    user_id: str,
    conversation_id: str,
    user_message: str,
    file_ids: list[str] | None = None,
    project_id: str | None = None,
    history: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Assemble the provider message list for one turn.

    ``history`` lets a caller pass an already-trimmed transcript (regenerate);
    otherwise the stored transcript for the conversation is used.
    """
    msgs: list[dict[str, Any]] = [
        {"role": "system", "content": _system_prompt(file_ids, project_id)}
    ]

    rows = history if history is not None else get_messages(user_id, conversation_id)
    for row in rows:
        role = row.get("role")
        if role in ("user", "assistant"):
            msgs.append({"role": role, "content": row.get("content", "")})

    msgs.append({
        "role": "user",
        "content": user_message,
        "attachments": _retrieve_context(user_id, user_message, file_ids, project_id),
    })
    return msgs


def _retrieve_context(
    user_id: str,
    user_message: str,
    file_ids: list[str] | None,
    project_id: str | None,
) -> list[dict[str, Any]]:
    from server.services.codebase_service import get_project, retrieve_relevant_chunks

    refs: list[dict[str, Any]] = []

    for fid in file_ids or []:
        frow = query(
            "SELECT filename, file_type, path FROM files WHERE id = ? AND (user_id = ? OR user_id IS NULL)",
            (fid, user_id),
            one=True,
        )
        if frow:
            refs.append({
                "type": "file_reference",
                "name": frow["filename"],
                "content": _file_excerpt(frow.get("path")),
            })

    if project_id and get_project(user_id, project_id):
        # Retrieval using existing codebase chunks (lexical over embeddings)
        for chunk in retrieve_relevant_chunks(project_id, user_message, limit=RAG_CHUNK_LIMIT):
            refs.append({
                "type": "file_reference",
                "name": chunk.get("file_path", "project_file"),
                "content": chunk.get("content", ""),
            })
        # Enhanced retrieval using Knowledge Builder results (version-aware)
        try:
            from server.services import knowledge_service
            kb_chunks = knowledge_service.search_project_knowledge(
                user_id, project_id, user_message, version_id=None, top_k=RAG_CHUNK_LIMIT
            )
            for ch in kb_chunks:
                # Only skip exact same file+symbol+chunk duplicates; preserve enhanced metadata chunks
                is_duplicate = any(
                    ref.get("name") == ch.get("file_path") and ref.get("chunk_id") == ch.get("chunk_id")
                    for ref in refs
                )
                if not is_duplicate:
                    refs.append({
                        "type": "file_reference",
                        "name": ch.get("file_path", "project_file"),
                        "content": ch.get("content_preview", ch.get("content", "")),
                        "chunk_type": ch.get("chunk_type"),
                        "chunk_id": ch.get("chunk_id"),
                        "symbol_name": ch.get("symbol_name"),
                        "evidence_ref": ch.get("evidence_ref"),
                        "version_id": ch.get("version_id"),
                    })
        except Exception:
            # If knowledge service is unavailable, fall back gracefully to lexical only.
            pass

    return refs


def _system_prompt(file_ids: list[str] | None, project_id: str | None) -> str:
    parts = [
        "You are a helpful, knowledgeable AI assistant. You answer questions using the "
        "provided context from uploaded files and project codebases.",
        "Do not mention that context was provided — answer naturally and cite file names when useful.",
        "FILE GENERATION: When the user asks you to create, generate, or save a file "
        "(e.g., 'create a Python file', 'generate a script', 'make a config file', "
        "'save this as .js', 'download the code'), output the file content using "
        "this EXACT format at the END of your response (after your explanation):\n\n"
        "[FILE: <filename>]\n"
        "<file content here>\n"
        "[ENDFILE]\n\n"
        "Example:\n"
        "[FILE: hello.py]\n"
        "print('Hello, World!')\n"
        "[ENDFILE]\n\n"
        "Only use [FILE: ...]/[ENDFILE] markers when explicitly creating files. "
        "The filename MUST include the correct extension (e.g., .py, .js, .ts, .tsx, .json, .md, .html, .css). "
        "Do NOT wrap regular code examples in file markers - only use them for actual file generation requests.",
    ]
    if project_id:
        parts.append(
            "Project files are attached. Use them to reason about code relationships, "
            "imports and structure."
        )
    if file_ids:
        parts.append("Files are attached. Ground your answer in their contents.")
    return " ".join(parts)


def _file_excerpt(path: str | None) -> str:
    if not path or not os.path.exists(path):
        return ""
    from server.services.file_service import extract_text_from_file

    return extract_text_from_file(path, limit=MAX_ATTACHMENT_CHARS)
