"""Whole-project analysis: versioning, analysis runs, evidence, knowledge
claims, and debug-session persistence.

Additive on top of the existing codebase_service / file_service / db
modules. No existing tables or routes are touched.
"""

import hashlib
import json
import time
import uuid
from typing import Any

from server.storage.db import execute, executemany, query


# ----------------------------------------------------------------------
# Versions
# ----------------------------------------------------------------------

def list_versions(user_id: str, project_id: str) -> list[dict[str, Any]]:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return []
    return query(
        "SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC",
        (project_id,),
    )


def create_version(
    user_id: str,
    project_id: str,
    label: str | None = None,
    source: str | None = None,
    note: str | None = None,
) -> str | None:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return None
    last = query(
        "SELECT MAX(version_number) AS n FROM project_versions WHERE project_id = ?",
        (project_id,),
        one=True,
    )
    next_n = int(last["n"] or 0) + 1
    vid = f"ver_{uuid.uuid4().hex[:12]}"
    now = time.time()
    file_count_row = query(
        "SELECT COUNT(*) AS n FROM project_files WHERE project_id = ?",
        (project_id,),
        one=True,
    )
    execute(
        "INSERT INTO project_versions (id, project_id, version_number, label, source, created_at,"
        " file_count, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (vid, project_id, next_n, label, source, now, file_count_row["n"] if file_count_row else 0, note),
    )
    return vid


def get_version(user_id: str, project_id: str, version_id: str) -> dict[str, Any] | None:
    row = query(
        "SELECT v.* FROM project_versions v"
        " JOIN projects p ON p.id = v.project_id"
        " WHERE v.id = ? AND v.project_id = ? AND p.user_id = ?",
        (version_id, project_id, user_id),
        one=True,
    )
    return row


# ----------------------------------------------------------------------
# Analysis runs
# ----------------------------------------------------------------------

VALID_RUN_STATUSES = {"pending", "scanning", "parsing", "indexing", "completed", "failed"}
VALID_RUN_STAGES = {"scanning", "parsing", "indexing", "completed", "failed"}


def create_analysis_run(
    user_id: str,
    project_id: str,
    version_id: str | None = None,
    model_id: str | None = None,
) -> str | None:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return None
    rid = f"run_{uuid.uuid4().hex[:12]}"
    execute(
        "INSERT INTO analysis_runs (id, project_id, version_id, user_id, status, stage,"
        " started_at, model_id) VALUES (?, ?, ?, ?, 'pending', 'scanning', ?, ?)",
        (rid, project_id, version_id, user_id, time.time(), model_id),
    )
    return rid


def update_analysis_run(
    run_id: str,
    *,
    status: str | None = None,
    stage: str | None = None,
    completed: bool = False,
    files_discovered: int | None = None,
    files_analyzed: int | None = None,
    chunks_indexed: int | None = None,
    error_count: int | None = None,
    warning_count: int | None = None,
    detail: str | None = None,
) -> None:
    sets: list[str] = []
    params: list[Any] = []
    if status is not None:
        sets.append("status = ?"); params.append(status)
    if stage is not None:
        sets.append("stage = ?"); params.append(stage)
    if files_discovered is not None:
        sets.append("files_discovered = ?"); params.append(files_discovered)
    if files_analyzed is not None:
        sets.append("files_analyzed = ?"); params.append(files_analyzed)
    if chunks_indexed is not None:
        sets.append("chunks_indexed = ?"); params.append(chunks_indexed)
    if error_count is not None:
        sets.append("error_count = ?"); params.append(error_count)
    if warning_count is not None:
        sets.append("warning_count = ?"); params.append(warning_count)
    if detail is not None:
        sets.append("detail = ?"); params.append(detail)
    if completed:
        sets.append("completed_at = ?"); params.append(time.time())
    if not sets:
        return
    params.append(run_id)
    execute("UPDATE analysis_runs SET " + ", ".join(sets) + " WHERE id = ?", tuple(params))


def list_runs(user_id: str, project_id: str) -> list[dict[str, Any]]:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return []
    return query(
        "SELECT * FROM analysis_runs WHERE project_id = ? ORDER BY started_at DESC",
        (project_id,),
    )


# ----------------------------------------------------------------------
# File hashing (for versioning / future diff)
# ----------------------------------------------------------------------

def hash_file_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def hash_text(content: str) -> str:
    return hash_file_bytes(content.encode("utf-8", errors="replace"))


# ----------------------------------------------------------------------
# Evidence
# ----------------------------------------------------------------------

VALID_CONFIDENCE = {"high", "medium", "low"}
VALID_EVIDENCE_TYPES = {
    "code_symbol", "imports", "config_key", "documentation", "structure", "observation",
}


def add_evidence(
    user_id: str,
    project_id: str,
    *,
    version_id: str | None = None,
    run_id: str | None = None,
    project_file_id: str | None = None,
    path: str | None = None,
    symbol: str | None = None,
    line_start: int | None = None,
    line_end: int | None = None,
    observation: str | None = None,
    evidence_type: str = "observation",
    confidence: str = "medium",
) -> str | None:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return None
    eid = f"evi_{uuid.uuid4().hex[:12]}"
    conf = confidence if confidence in VALID_CONFIDENCE else "medium"
    etype = evidence_type if evidence_type in VALID_EVIDENCE_TYPES else "observation"
    execute(
        "INSERT INTO evidence (id, project_id, version_id, run_id, project_file_id, path,"
        " symbol, line_start, line_end, observation, evidence_type, confidence, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (eid, project_id, version_id, run_id, project_file_id, path, symbol,
         line_start, line_end, observation, etype, conf, time.time()),
    )
    return eid


def list_evidence(user_id: str, project_id: str) -> list[dict[str, Any]]:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return []
    return query(
        "SELECT * FROM evidence WHERE project_id = ? ORDER BY created_at DESC",
        (project_id,),
    )


# ----------------------------------------------------------------------
# Knowledge claims
# ----------------------------------------------------------------------

VALID_CLAIM_STATUSES = {"confirmed", "inferred", "unknown", "contradicted"}


def add_claim(
    user_id: str,
    project_id: str,
    statement: str,
    *,
    category: str | None = None,
    confidence: str = "medium",
    status: str = "inferred",
    version_id: str | None = None,
    run_id: str | None = None,
    evidence_ids: list[str] | None = None,
) -> str | None:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return None
    cid = f"clm_{uuid.uuid4().hex[:12]}"
    st = status if status in VALID_CLAIM_STATUSES else "inferred"
    conf = confidence if confidence in VALID_CONFIDENCE else "medium"
    now = time.time()
    execute(
        "INSERT INTO knowledge_claims (id, project_id, version_id, run_id, statement,"
        " category, confidence, status, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (cid, project_id, version_id, run_id, statement, category, conf, st, now, now),
    )
    if evidence_ids:
        rows = [(cid, eid) for eid in evidence_ids]
        executemany(
            "INSERT OR IGNORE INTO knowledge_claim_evidence (claim_id, evidence_id) VALUES (?, ?)",
            rows,
        )
    return cid


def list_claims(user_id: str, project_id: str) -> list[dict[str, Any]]:
    if not query(
        "SELECT id FROM projects WHERE id = ? AND user_id = ?",
        (project_id, user_id),
        one=True,
    ):
        return []
    return query(
        "SELECT * FROM knowledge_claims WHERE project_id = ? ORDER BY updated_at DESC",
        (project_id,),
    )


def get_claim_with_evidence(claim_id: str) -> dict[str, Any] | None:
    claim = query("SELECT * FROM knowledge_claims WHERE id = ?", (claim_id,), one=True)
    if not claim:
        return None
    evidence = query(
        "SELECT e.* FROM evidence e"
        " JOIN knowledge_claim_evidence ce ON ce.evidence_id = e.id"
        " WHERE ce.claim_id = ?",
        (claim_id,),
    )
    claim["evidence"] = evidence
    return claim


# ----------------------------------------------------------------------
# Debug sessions
# ----------------------------------------------------------------------

def create_debug_session(
    user_id: str,
    *,
    project_id: str | None = None,
    version_id: str | None = None,
    error_text: str | None = None,
    stack_trace: str | None = None,
) -> str:
    sid = f"dbg_{uuid.uuid4().hex[:12]}"
    execute(
        "INSERT INTO debug_sessions (id, project_id, version_id, user_id, error_text,"
        " stack_trace, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (sid, project_id, version_id, user_id, error_text, stack_trace, time.time()),
    )
    return sid


def update_debug_session(session_id: str, **fields: Any) -> None:
    if not fields:
        return
    cols = []
    params: list[Any] = []
    for k, v in fields.items():
        if k not in {
            "source_context", "affected_files", "affected_functions", "root_cause",
            "suggested_fix", "generated_diff", "validation", "test_result",
            "build_result", "confidence", "completed_at",
        }:
            continue
        cols.append(f"{k} = ?"); params.append(v)
    if "completed_at" not in fields and "root_cause" in fields:
        cols.append("completed_at = ?"); params.append(time.time())
    if not cols:
        return
    params.append(session_id)
    execute("UPDATE debug_sessions SET " + ", ".join(cols) + " WHERE id = ?", tuple(params))


def list_debug_sessions(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    return query(
        "SELECT * FROM debug_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
        (user_id, limit),
    )


def _safe_json(value: Any) -> Any:
    try:
        return json.loads(value) if value else []
    except Exception:
        return []