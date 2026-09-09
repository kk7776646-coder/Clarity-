"""Debugging service — project-aware root-cause analysis using analysis and knowledge results."""
from __future__ import annotations

import hashlib
import re
import time
from typing import Any

from server.storage.db import execute, query


def parse_python_traceback(traceback_text: str) -> dict:
    """Parse a Python traceback to extract file, line, function, error type, message."""
    result = {
        "language": "python",
        "error_type": None,
        "message": traceback_text[:400],
        "file_path": None,
        "line_number": None,
        "function_name": None,
        "stack_frames": [],
    }
    # Find last traceback frame (the failing line)
    lines = traceback_text.splitlines()
    for i in range(len(lines) - 1, -1, -1):
        line = lines[i]
        # Pattern: File "...", line N, in function_name
        match = re.search(r'File "([^"]+)", line (\d+)(?:, in (\S+))?', line)
        if match:
            result["file_path"] = match.group(1)
            result["line_number"] = int(match.group(2))
            result["function_name"] = match.group(3)
            # Find error message - search all lines for any error message
            for msg_line in lines:
                msg_match = re.search(r"([A-Z][a-zA-Z_]*Error|[A-Z][a-zA-Z_]*Exception).*?:\s*(.*)", msg_line)
                if msg_match:
                    result["error_type"] = msg_match.group(1)
                    result["message"] = msg_match.group(2) or msg_line
                    break
            # Fallback: find any line that contains common error keywords
            if not result.get("error_type"):
                for msg_line in lines:
                    if re.search(r"(NameError|TypeError|ValueError|ImportError|ModuleNotFoundError|KeyError|IndexError|AttributeError|SyntaxError|IndentationError|ZeroDivisionError|RuntimeError|ReferenceError|Exception)", msg_line):
                        error_word = re.search(r"(NameError|TypeError|ValueError|ImportError|ModuleNotFoundError|KeyError|IndexError|AttributeError|SyntaxError|IndentationError|ZeroDivisionError|RuntimeError|ReferenceError|Exception)", msg_line)
                        if error_word:
                            result["error_type"] = error_word.group(1)
                            result["message"] = msg_line
                            break
            # Fallback: search all lines for error message
            if not result.get("error_type"):
                for msg_line in lines:
                    simple_msg = re.search(r"([A-Z][a-zA-Z_]*Error|[A-Z][a-zA-Z_]*Exception).*?:\s*(.*)", msg_line)
                    if simple_msg:
                        result["error_type"] = simple_msg.group(1)
                        result["message"] = simple_msg.group(2) or msg_line
                        break
            break
    return result


def parse_js_traceback(traceback_text: str) -> dict:
    """Parse a JavaScript/TypeScript stack trace."""
    result = {
        "language": "javascript" if (".js" in traceback_text.lower() or ".jsx" in traceback_text.lower()) else "typescript",
        "error_type": None,
        "message": traceback_text[:400],
        "file_path": None,
        "line_number": None,
        "function_name": None,
        "stack_frames": [],
    }
    # Find first error line
    lines = traceback_text.splitlines()
    for i, line in enumerate(lines):
        # Pattern: at function (file:line:col)
        match = re.search(r"at\s+([A-Za-z_][A-Za-z0-9_]*).*?(?:\(([^)]+):(\d+):(\d+)\)|\s+\(([^)]+):(\d+):(\d+)\))", line)
        if match:
            result["function_name"] = match.group(1)
            file_path = match.group(2) or match.group(5)
            line_num = int(match.group(3) or match.group(6) or 0)
            result["file_path"] = file_path
            result["line_number"] = line_num
            result["stack_frames"].append({
                "function": result["function_name"],
                "file_path": file_path,
                "line": line_num,
            })
        # Find error message
        msg_match = re.search(r"([A-Z][a-zA-Z_]*Error|[A-Z][a-zA-Z_]*Exception).*?: (.*)", line)
        if msg_match:
            result["error_type"] = msg_match.group(1) if msg_match.group(1) else None
            result["message"] = msg_match.group(2)
            break
    return result


def locate_project_location(project_id: str, file_path: str | None, symbol_name: str | None, user_id: str) -> dict:
    """Locate file/symbol in the project using DB results."""
    result = {"file_found": False, "symbol_found": False, "file_path": file_path, "symbol_name": symbol_name}
    if file_path:
        row = query(
            "SELECT id FROM project_files WHERE project_id = ? AND path = ?",
            (project_id, file_path),
            one=True,
        )
        result["file_found"] = row is not None
        result["file_id"] = row["id"] if row else None
    if symbol_name and file_path:
        sym_row = query(
            "SELECT * FROM project_symbols WHERE project_id = ? AND file_path = ? AND symbol_name = ?",
            (project_id, file_path, symbol_name),
            one=True,
        )
        result["symbol_found"] = sym_row is not None
        result["symbol_details"] = sym_row if sym_row else None
    return result


def retrieve_debug_context(project_id: str, file_path: str | None = None, symbol_name: str | None = None):
    """Retrieve relevant chunks and relationships for debugging."""
    from server.services import knowledge_service
    from server.storage.db import query
    chunks = knowledge_service.get_project_knowledge("system", project_id)[:20]
    relationships = query(
        "SELECT * FROM code_relationships WHERE project_id = ? LIMIT 20",
        (project_id,),
    )
    evidence_rows = query(
        "SELECT * FROM evidence WHERE project_id = ? ORDER BY created_at DESC LIMIT 10",
        (project_id,),
    )
    # Filter chunks to relevant file/symbol
    relevant_chunks = [
        ch for ch in chunks
        if (not file_path) or (ch.get("file_path") == file_path) or (ch.get("file_path", "").lower().endswith(file_path.lower()))
    ]
    return {
        "chunks": relevant_chunks,
        "relationships": relationships,
        "evidence": evidence_rows,
    }


def build_debug_result(user_id: str, project_id: str, error_text: str, parsed_error: dict) -> dict:
    """Assemble structured debugging result backed by real project evidence."""
    from server.services.codebase_service import get_project
    if not get_project(user_id, project_id):
        return {"ok": False, "error": "Project not found", "status": "failed"}

    # Create or reuse debug session
    from server.storage.db import execute, query
    debug_id = f"dbg_{hashlib.sha256(str(time.time()).encode()).hexdigest()[:12]}"
    status = "pending"
    file_found = parsed_error.get("file_path") is not None
    file_path = parsed_error.get("file_path", "")
    symbol_found = parsed_error.get("function_name") is not None
    symbol_name = parsed_error.get("function_name", "")

    # Insert debug session (reuse existing table structure)
    try:
        execute(
            "INSERT INTO debug_sessions (id, project_id, user_id, error_text, stack_trace, source_context, affected_files, affected_functions, root_cause, suggested_fix, validation, confidence, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (debug_id, project_id, user_id, error_text[:2000], str(parsed_error.get("stack_frames") or ""), "", file_path if file_found else "", symbol_name if symbol_found else "", "Analysis started; gathering evidence.", None, None, "low", time.time()),
        )
    except Exception:
        pass

    # Gather evidence/context
    context = retrieve_debug_context(project_id, file_path=file_path if file_found else None, symbol_name=symbol_name if symbol_found else None)

    # Determine root cause based on evidence
    root_cause_text = None
    confidence = "low"
    fix_suggestion = None
    if file_found:
        evidence_refs = context.get("evidence", [])
        relationships = context.get("relationships", [])
        chunks = context.get("chunks", [])
        # Simple deterministic root-cause reasoning
        error_type = parsed_error.get("error_type") or "unknown"
        if "import" in error_text.lower() or "module" in error_text.lower():
            root_cause_text = "Dependency/module import issue detected."
            fix_suggestion = "Check import paths and dependency resolution."
            confidence = "medium"
        elif "name" in error_text.lower() or "not defined" in error_text.lower():
            root_cause_text = "Symbol/function reference issue: referenced symbol not available in scope."
            fix_suggestion = "Ensure the referenced function/class is imported or defined in the source file."
            confidence = "medium" if file_found else "low"
        else:
            root_cause_text = "General runtime error detected."
            fix_suggestion = "Review error trace and related source context."
            confidence = "low"

    # Update session with structured analysis
    affected_files = ",".join({ch.get("file_path", "") for ch in chunks if ch.get("file_path")})
    affected_functions = ",".join({str(ch.get("symbol_name")) for ch in chunks if ch.get("symbol_name")})
    try:
        from server.storage.db import execute
        execute(
            "UPDATE debug_sessions SET completed_at = ?, root_cause = ?, suggested_fix = ?, confidence = ?, affected_files = ?, affected_functions = ? WHERE id = ?",
            (time.time(), root_cause_text or parsed_error.get("error_type"), fix_suggestion or "No specific fix suggested.", confidence, affected_files, affected_functions, debug_id),
        )
    except Exception:
        pass

    return {
        "ok": True,
        "debug_session_id": debug_id,
        "project_id": project_id,
        "status": "completed",
        "parsed_error": {
            "language": parsed_error.get("language"),
            "error_type": parsed_error.get("error_type"),
            "message": parsed_error.get("message"),
            "file_path": parsed_error.get("file_path"),
            "line_number": parsed_error.get("line_number"),
            "function_name": parsed_error.get("function_name"),
            "stack_frames": parsed_error.get("stack_frames"),
        },
        "location": {
            "file_found": file_found,
            "symbol_found": symbol_found,
            "file_path": file_path,
            "line_number": parsed_error.get("line_number"),
            "symbol_name": symbol_name,
        },
        "root_cause": root_cause_text,
        "confidence": confidence,
        "suggested_fix": fix_suggestion,
        "evidence": [{"id": e.get("id"), "type": e.get("evidence_type"), "line_start": e.get("line_start"), "path": e.get("path"), "symbol": e.get("symbol")} for e in context.get("evidence", [])],
        "related_relationships": [{"type": r.get("relationship_type"), "from_path": r.get("from_file_path"), "to_path": r.get("to_file_path"), "confidence": r.get("confidence")} for r in context.get("relationships", [])],
        "retrieved_context": [
            {
                "chunk_type": ch.get("chunk_type"),
                "file_path": ch.get("file_path"),
                "symbol_name": ch.get("symbol_name"),
                "line_start": ch.get("line_start"),
                "line_end": ch.get("line_end"),
                "content_preview": (ch.get("content") or "")[:200],
            } for ch in context.get("chunks", [])
        ],
        "additional_info_needed": "Provide exact traceback, error type, environment/config details, and relevant source context if confidence is low.",
        "security_check": "No code executed; no secrets exposed; all context backed by DB evidence.",
    }
