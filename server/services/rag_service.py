"""RAG Orchestrator — connects existing project analysis and knowledge builder to chat."""
from __future__ import annotations

import time
from typing import Any

from server.services import knowledge_service
from server.storage.db import query
from server.services.codebase_service import get_project


def build_rag_context(
    user_id: str,
    project_id: str,
    query_text: str,
    version_id: str | None = None,
    top_k: int = 8,
) -> dict:
    """Retrieve and assemble project-aware RAG context without calling an LLM."""
    if not get_project(user_id, project_id):
        return {"ok": False, "error": "Project not found", "status": "failed"}

    chunks = knowledge_service.search_project_knowledge(
        user_id, project_id, query_text or "", version_id=version_id, top_k=top_k
    )

    # Relationship expansion: for each chunk, find related relationships
    if version_id:
        relationships = query(
            "SELECT * FROM code_relationships WHERE project_id = ? AND version_id = ? LIMIT 20",
            (project_id, version_id),
        )
    else:
        relationships = query(
            "SELECT * FROM code_relationships WHERE project_id = ? AND (version_id IS NULL OR version_id = (SELECT id FROM project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 1)) LIMIT 20",
            (project_id, project_id),
        )

    # Evidence tracking per chunk (simplified)
    evidence_refs = []
    for ch in chunks:
        # Try to match chunk content/file/symbol back to evidence
        ev_rows = query(
            "SELECT * FROM evidence WHERE project_id = ? AND (version_id = ? OR version_id IS NULL) AND (path = ? OR symbol = ?) LIMIT 5",
            (project_id, version_id, ch.get("file_path"), ch.get("symbol_name")),
        )
        evidence_refs.append([{"id": e["id"], "type": e.get("evidence_type"), "line_start": e.get("line_start")} for e in ev_rows])

    # Assemble structured context (not LLM prompt yet)
    sources = []
    for ch in chunks:
        sources.append({
            "chunk_id": ch.get("chunk_id"),
            "chunk_type": ch.get("chunk_type"),
            "file_path": ch.get("file_path"),
            "symbol_name": ch.get("symbol_name"),
            "language": ch.get("language"),
            "line_start": ch.get("line_start"),
            "line_end": ch.get("line_end"),
            "content_preview": ch.get("content_preview", ch.get("content", ""))[:400],
            "version_id": ch.get("version_id"),
        })

    return {
        "ok": True,
        "project_id": project_id,
        "version_id": version_id,
        "retrieval_mode": "hybrid",
        "query": query_text,
        "sources": sources,
        "relationship_expansion": [
            {
                "relationship_type": r.get("relationship_type"),
                "from_path": r.get("from_file_path"),
                "from_symbol": r.get("from_symbol"),
                "to_path": r.get("to_file_path"),
                "to_symbol": r.get("to_symbol"),
                "confidence": r.get("confidence"),
                "version_id": r.get("version_id"),
            }
            for r in relationships
        ],
        "evidence_refs": evidence_refs,
        "results_count": len(chunks),
    }


def retrieve_project_context(
    user_id: str,
    project_id: str,
    max_chunks: int = 8,
    version_id: str | None = None,
) -> list[dict]:
    return knowledge_service.get_project_knowledge(user_id, project_id, version_id)[:max_chunks]
