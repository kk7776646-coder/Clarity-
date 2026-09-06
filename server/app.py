"""NexaRAG backend.

Single Flask app: authentication, model registry, chat streaming, files,
projects and the static SPA. Provider API keys never leave this process.
"""

import asyncio
import json
import logging
import os
import sys
from functools import wraps
from typing import Any, Callable, Iterator

from flask import Flask, g, jsonify, request, Response, send_file, send_from_directory, stream_with_context
from werkzeug.security import safe_join

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.config import ModelConfig
from server.models.base import AdapterError
from server.services import auth_service, chat_service
from server.services.auth_service import AuthError, SESSION_COOKIE
from server.services.codebase_service import (
    create_project,
    delete_project,
    get_file_content,
    get_project,
    get_project_tree,
    index_project_files,
    list_projects,
    retrieve_relevant_chunks,
)
from server.services.file_service import (
    MAX_FILE_SIZE,
    FileError,
    detect_file_type,
    extract_text_from_file,
    process_zip,
    save_uploaded_file,
    save_generated_file,
)
from server.storage.db import execute, init, query

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("server")

init()
auth_service.purge_expired_sessions()

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_frontend_dirs = ("css", "js", "assets")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE + 1024
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET", "dev-secret-change-me")
# The SPA is served from this same origin, so no cross-origin allowance is
# needed and none is granted: session cookies stay first-party.


# ---------------------------------------------------------------------------
# Authentication plumbing
# ---------------------------------------------------------------------------

def _cookie_secure() -> bool:
    return os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"


def _set_session_cookie(response: Response, token: str, expires: float) -> Response:
    from server.services.auth_service import SESSION_TTL_SECONDS
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="Lax",
        secure=_cookie_secure(),
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )
    return response


def _clear_session_cookie(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


def current_user() -> dict[str, Any] | None:
    if "user" not in g:
        g.user = auth_service.resolve_session(request.cookies.get(SESSION_COOKIE))
    return g.user


def login_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "Sign in to continue", "type": "unauthenticated"}), 401
        return fn(*args, **kwargs)

    return wrapper


@app.errorhandler(AuthError)
def handle_auth_error(err: AuthError):
    return jsonify({"error": str(err), "type": err.error_type}), err.status_code


@app.errorhandler(FileError)
def handle_file_error(err: FileError):
    return jsonify({"error": str(err), "type": "file_error"}), 400


@app.errorhandler(413)
def too_large(_e):
    return jsonify({"error": "File too large. Maximum size is 50MB.", "type": "file_too_large"}), 413


@app.errorhandler(500)
def internal_error(_e):
    log.exception("Internal server error")
    return jsonify({"error": "Internal server error", "type": "server_error"}), 500


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    user = auth_service.create_user(data.get("email", ""), data.get("password", ""))
    token, expires = auth_service.create_session(user["id"])
    response = jsonify({"user": auth_service.public_user(user)})
    return _set_session_cookie(response, token, expires), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user = auth_service.verify_login(data.get("email", ""), data.get("password", ""))
    token, expires = auth_service.create_session(user["id"])
    response = jsonify({"user": auth_service.public_user(user)})
    return _set_session_cookie(response, token, expires)


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    auth_service.destroy_session(request.cookies.get(SESSION_COOKIE))
    return _clear_session_cookie(jsonify({"ok": True}))


@app.route("/api/auth/me", methods=["GET"])
def whoami():
    user = current_user()
    if not user:
        return jsonify({"user": None}), 401
    return jsonify({"user": auth_service.public_user(user)})


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def _mask_key(key: str) -> str:
    """Fully opaque placeholder.

    No part of a stored secret is ever sent to the browser, so this returns a
    fixed-width mask that reveals neither characters nor the exact length.
    """
    if not key:
        return ""
    return "•" * 12


def _public_model(m: dict[str, Any]) -> dict[str, Any]:
    """Strip every secret before a model crosses the network boundary."""
    safe = dict(m)
    raw_key = safe.pop("apiKey", "") or ""
    safe["hasApiKey"] = bool(raw_key)
    safe["apiKeyMasked"] = _mask_key(raw_key) if raw_key else None
    safe.setdefault("status", "untested")
    safe.setdefault("enabled", True)
    safe.setdefault("isUser", False)
    return safe


def _resolve_active_model(user: dict[str, Any], models: list[dict[str, Any]]) -> str | None:
    """The user's stored selection when it is still selectable, else nothing."""
    selectable = [m for m in models if m.get("enabled", True)]
    stored = user.get("active_model_id")
    if stored and any(m["id"] == stored for m in selectable):
        return stored
    return None


@app.route("/api/models", methods=["GET"])
@login_required
def list_models():
    user = current_user()
    models = ModelConfig.list_models(user["id"])
    active = _resolve_active_model(user, models)
    public = [_public_model(m) for m in models]
    for m in public:
        m["is_active"] = m["id"] == active
    return jsonify({"models": public, "active": active})


@app.route("/api/models", methods=["POST"])
@login_required
def create_model():
    user = current_user()
    data = request.get_json(silent=True) or {}
    error = _validate_model_payload(data, require_key=True)
    if error:
        return jsonify({"error": error, "type": "invalid_model"}), 400
    if ModelConfig.get_user_model(user["id"], str(data["id"]).strip()):
        return jsonify({"error": f"A model with id '{data['id']}' already exists", "type": "duplicate_model"}), 409
    data["status"] = "untested"
    try:
        saved = ModelConfig.save_user_model(user["id"], data)
    except Exception as e:
        log.exception("Model save failed")
        return jsonify({"error": f"Failed to save model: {e}", "type": "invalid_model"}), 400
    return jsonify(_public_model(saved)), 201


@app.route("/api/models/<model_id>", methods=["GET"])
@login_required
def get_model(model_id):
    model = ModelConfig.get_model(current_user()["id"], model_id)
    if not model:
        return jsonify({"error": "Model not found", "type": "model_not_found"}), 404
    return jsonify(_public_model(model))


def _is_masked_key(value: str) -> bool:
    """True when the submitted 'key' is only mask characters, not a real secret.

    Guards the masked-key overwrite bug: a UI that echoes the placeholder back
    must never be able to replace a working secret with dots/asterisks.
    """
    stripped = str(value or "").strip()
    if not stripped:
        return False
    return all(ch in "•*·.…\u2022\u00b7" for ch in stripped)


@app.route("/api/models/<model_id>", methods=["PUT"])
@login_required
def update_model(model_id):
    user = current_user()
    data = request.get_json(silent=True) or {}
    data["id"] = model_id
    existing = ModelConfig.get_user_model(user["id"], model_id)
    if not existing:
        return jsonify({"error": "Only models you added can be edited", "type": "not_editable"}), 400

    submitted_key = str(data.get("apiKey") or "").strip()
    if _is_masked_key(submitted_key):
        # The client sent back the placeholder, not a new secret: keep the old one.
        submitted_key = ""
    if not submitted_key:
        data["apiKey"] = existing.get("apiKey", "")
    else:
        data["apiKey"] = submitted_key

    error = _validate_model_payload(data, require_key=not existing.get("apiKey"))
    if error:
        return jsonify({"error": error, "type": "invalid_model"}), 400

    config_changed = (
        str(data.get("baseUrl", "")).strip() != (existing.get("baseUrl") or "")
        or str(data.get("modelName", "")).strip() != (existing.get("modelName") or "")
        or str(data.get("provider", "")).strip() != (existing.get("provider") or "")
        or (submitted_key and submitted_key != (existing.get("apiKey") or ""))
    )
    if config_changed:
        data["status"] = "untested"
        data["lastError"] = None
    try:
        saved = ModelConfig.save_user_model(user["id"], data)
    except Exception as e:
        log.exception("Model update failed")
        return jsonify({"error": f"Failed to update: {e}", "type": "invalid_model"}), 400
    return jsonify(_public_model(saved))


@app.route("/api/models/<model_id>", methods=["DELETE"])
@login_required
def delete_model(model_id):
    user = current_user()
    if not ModelConfig.delete_user_model(user["id"], model_id):
        if ModelConfig.get_model(user["id"], model_id):
            return jsonify({"error": "Only models you added can be deleted", "type": "not_deletable"}), 400
        return jsonify({"error": "Model not found", "type": "model_not_found"}), 404
    if user.get("active_model_id") == model_id:
        auth_service.set_active_model(user["id"], None)
    # Conversations keep their history and their recorded model id on purpose.
    return jsonify({"deleted": True, "id": model_id})


@app.route("/api/models/<model_id>/enable", methods=["POST"])
@login_required
def enable_model(model_id):
    user = current_user()
    data = request.get_json(silent=True) or {}
    enabled = bool(data.get("enabled", True))
    updated = ModelConfig.set_enabled(user["id"], model_id, enabled)
    if not updated:
        return jsonify({"error": "Model not found", "type": "model_not_found"}), 404
    if not enabled and user.get("active_model_id") == model_id:
        auth_service.set_active_model(user["id"], None)
    return jsonify({"ok": True, "enabled": enabled, "model": _public_model(updated)})


@app.route("/api/models/set-active", methods=["POST"])
@login_required
def set_active_model():
    user = current_user()
    data = request.get_json(silent=True) or {}
    model_id = data.get("model_id")
    if not model_id:
        return jsonify({"error": "model_id required", "type": "invalid_request"}), 400
    model = ModelConfig.get_model(user["id"], model_id)
    if not model:
        return jsonify({"error": f"Model '{model_id}' not found", "type": "model_not_found"}), 404
    if not model.get("enabled", True):
        return jsonify({"error": f"Model '{model_id}' is disabled", "type": "model_disabled"}), 400
    auth_service.set_active_model(user["id"], model_id)
    return jsonify({"ok": True, "active": model_id, "model": _public_model(model)})


@app.route("/api/models/test", methods=["POST"])
@login_required
def test_model():
    """Verify a model using the SAME resolution path the chat endpoint uses.

    The stored record is loaded through ``ModelConfig.get_model`` — exactly the
    lookup ``_resolve_chat_model`` performs — then only genuinely re-typed form
    fields are overlaid. A masked placeholder is never treated as a key, so a
    verification can never pass with a secret that chat would not receive.
    """
    user = current_user()
    data = request.get_json(silent=True) or {}
    mid = str(data.get("id") or "").strip()
    if not mid:
        return jsonify({"ok": False, "error": "Model ID required", "error_type": "invalid_request"}), 400

    stored = ModelConfig.get_user_model(user["id"], mid)
    base = stored or ModelConfig.get_model(user["id"], mid)
    if base:
        model = dict(base)
        for key in ("name", "provider", "baseUrl", "modelName"):
            submitted = str(data.get(key) or "").strip()
            if submitted:
                model[key] = submitted
        submitted_key = str(data.get("apiKey") or "").strip()
        if submitted_key and not _is_masked_key(submitted_key):
            model["apiKey"] = submitted_key
        model = ModelConfig._normalize(model)
    else:
        payload = dict(data)
        if _is_masked_key(str(payload.get("apiKey") or "")):
            payload["apiKey"] = ""
        try:
            model = ModelConfig._normalize(payload)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Invalid model: {e}", "error_type": "invalid_model"}), 400

    provider = str(model.get("provider") or "")
    if not model.get("apiKey") and provider != "ollama":
        return jsonify({"ok": False, "error": "API key is required to test this provider", "error_type": "missing_api_key"}), 400
    if not model.get("baseUrl") and provider != "anthropic":
        return jsonify({"ok": False, "error": "Base URL is required to test this provider", "error_type": "missing_base_url"}), 400

    log.info("Model verify resolved: %s", ModelConfig.describe(model))

    try:
        result = asyncio.run(ModelConfig.get_adapter(model).test_connection())
    except Exception as e:
        log.exception("Model test failed")
        result = {"ok": False, "error": str(e), "error_type": "adapter_error"}

    if stored:
        if result.get("ok"):
            ModelConfig.set_status(user["id"], mid, "available", None)
        else:
            ModelConfig.set_status(user["id"], mid, "unavailable", result.get("error") or "Test failed")

    return jsonify(result), (200 if result.get("ok") else 400)


def _validate_model_payload(data: dict[str, Any], require_key: bool) -> str | None:
    if not str(data.get("id") or "").strip():
        return "Registry ID is required"
    if not str(data.get("name") or "").strip():
        return "Display name is required"
    if not str(data.get("modelName") or "").strip():
        return "Provider model ID is required"
    provider = str(data.get("provider") or "").strip().lower()
    if not provider:
        return "Provider is required"
    if not str(data.get("baseUrl") or "").strip() and provider != "anthropic":
        return "Base URL is required for this provider"
    if require_key and not str(data.get("apiKey") or "").strip() and provider != "ollama":
        return "API key is required for this provider"
    return None


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

@app.route("/api/conversations", methods=["GET"])
@login_required
def get_conversations():
    return jsonify({"conversations": chat_service.list_conversations(current_user()["id"])})


@app.route("/api/conversations", methods=["DELETE"])
@login_required
def delete_all_conversations():
    user = current_user()
    if not user:
        log.warning("delete_all_conversations: no user found")
        return jsonify({"error": "Not authenticated", "type": "unauthenticated"}), 401
    log.info("delete_all_conversations: user_id=%s", user["id"])
    try:
        count = chat_service.delete_all_conversations(user["id"])
        log.info("delete_all_conversations: deleted %d conversations", count)
        return jsonify({"deleted": count})
    except Exception as e:
        log.exception("delete_all_conversations failed")
        return jsonify({"error": str(e), "type": "delete_failed"}), 500


@app.route("/api/conversations", methods=["POST"])
@login_required
def create_conversation():
    user = current_user()
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()
    model_id = data.get("model_id") or user.get("active_model_id")
    cid = chat_service.create_conversation(user["id"], title, model_id)
    return jsonify({"id": cid, "title": title, "model_id": model_id}), 201


@app.route("/api/conversations/<cid>", methods=["GET"])
@login_required
def get_conversation(cid):
    user = current_user()
    conv = chat_service.get_conversation(user["id"], cid)
    if not conv:
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    return jsonify({"conversation": conv, "messages": chat_service.get_messages(user["id"], cid)})


@app.route("/api/conversations/<cid>", methods=["DELETE"])
@login_required
def delete_conversation(cid):
    if not chat_service.delete_conversation(current_user()["id"], cid):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    return jsonify({"deleted": True})


@app.route("/api/conversations/<cid>/title", methods=["PATCH"])
@login_required
def update_title(cid):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title required", "type": "invalid_request"}), 400
    if not chat_service.update_conversation_title(current_user()["id"], cid, title):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    return jsonify({"updated": True, "title": title})


@app.route("/api/conversations/<cid>/messages", methods=["GET"])
@login_required
def list_messages(cid):
    if not chat_service.get_conversation(current_user()["id"], cid):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    return jsonify({"messages": chat_service.get_messages(current_user()["id"], cid)})


@app.route("/api/conversations/<cid>/messages/<msg_id>/edit", methods=["POST"])
@login_required
def edit_message(cid, msg_id):
    data = request.get_json(silent=True) or {}
    content = data.get("content")
    if not isinstance(content, str):
        return jsonify({"error": "content required", "type": "invalid_request"}), 400
    user = current_user()
    if not chat_service.get_conversation(user["id"], cid):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    if not chat_service.update_message(user["id"], cid, msg_id, content):
        return jsonify({"error": "Message not found", "type": "not_found"}), 404
    return jsonify({"updated": True, "id": msg_id, "content": content})


@app.route("/api/conversations/<cid>/files", methods=["GET"])
@login_required
def conversation_files(cid):
    user = current_user()
    if not chat_service.get_conversation(user["id"], cid):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    rows = query(
        "SELECT id, filename, mime, size, file_type, uploaded_at FROM files"
        " WHERE conversation_id = ? AND user_id = ?",
        (cid, user["id"]),
    )
    return jsonify({"files": rows})


# ---------------------------------------------------------------------------
# Chat: one streaming implementation shared by send and regenerate
# ---------------------------------------------------------------------------

def _sse(payload: dict[str, Any]) -> str:
    return "data: " + json.dumps(payload) + "\n\n"


def _resolve_chat_model(user_id: str, model_id: str | None) -> dict[str, Any]:
    """Load the requested model or raise the real reason it cannot be used.

    This is the single resolution path for chat and regenerate, and it uses the
    same ``ModelConfig.get_model`` lookup as verification, so the provider,
    base URL, provider model id and API key are always identical to what was
    verified.
    """
    if not model_id:
        raise AdapterError("No model selected. Choose a model before sending a message.", 400, "no_model_selected")
    model = ModelConfig.get_model(user_id, model_id)
    if not model:
        raise AdapterError(f"Model '{model_id}' is not configured.", 404, "model_not_found")
    if not model.get("enabled", True):
        raise AdapterError(f"Model '{model_id}' is disabled.", 400, "model_disabled")
    if not model.get("apiKey") and str(model.get("provider")) != "ollama":
        raise AdapterError(
            f"Model '{model_id}' has no API key configured. Add one in Model Management.",
            400,
            "missing_api_key",
        )
    log.info("Chat model resolved: %s", ModelConfig.describe(model))
    return model


def _generate_stream(user_id: str, cid: str, model: dict[str, Any], context: list[dict[str, Any]]) -> Iterator[str]:
    """Drive the provider adapter and persist the assistant message.

    Streams when the model advertises streaming, otherwise emits the completed
    text in one event. Provider failures surface as real errors; nothing is
    substituted for a failed response.
    """
    adapter = ModelConfig.get_adapter(model)
    model_id = model["id"]
    chunks: list[str] = []
    failed = False

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        if model.get("supportsStreaming", True):
            agen = adapter.generate(context, stream=True)
            while True:
                try:
                    event = loop.run_until_complete(agen.__anext__())
                except StopAsyncIteration:
                    break
                except Exception as e:  # noqa: BLE001 - surfaced to the client verbatim
                    failed = True
                    log.exception("Streaming chat error (%s)", model_id)
                    yield _sse({"error": _error_payload(e)})
                    break
                content = event.get("content", "")
                if content:
                    chunks.append(content)
                    yield _sse({"content": content})
        else:
            try:
                text = loop.run_until_complete(adapter.generate_non_streaming(context))
            except Exception as e:  # noqa: BLE001
                failed = True
                log.exception("Non-streaming chat error (%s)", model_id)
                yield _sse({"error": _error_payload(e)})
                text = ""
            if text:
                chunks.append(text)
                yield _sse({"content": text})
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        loop.close()

    text = "".join(chunks)
    if text:
        cleaned_text, parsed_files = chat_service.parse_file_markers(text)
        attachments = []
        if parsed_files:
            attachments = chat_service.save_generated_files_and_attachments(user_id, cid, parsed_files)
        if attachments:
            msg_id = chat_service.save_message_with_attachments(user_id, cid, "assistant", cleaned_text, model_id, attachments)
            att_summary = [{"file_id": a["file_id"], "name": a["name"], "mime": a["mime"]} for a in attachments]
            yield _sse({"done": True, "message_id": msg_id, "model_id": model_id, "attachments": att_summary})
        else:
            msg_id = chat_service.save_message(user_id, cid, "assistant", cleaned_text, model_id)
            yield _sse({"done": True, "message_id": msg_id, "model_id": model_id})
    else:
        chat_service.touch_conversation(user_id, cid)
        if not failed:
            yield _sse({"error": {"message": "The model returned an empty response.", "type": "empty_response"}})
        yield _sse({"done": True, "model_id": model_id})


def _error_payload(err: Exception) -> dict[str, Any]:
    return {
        "message": str(err) or err.__class__.__name__,
        "type": getattr(err, "error_type", "chat_error"),
        "status": getattr(err, "status_code", 500),
    }


def _stream_response(generator: Iterator[str]) -> Response:
    return Response(
        stream_with_context(generator),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/conversations/<cid>/chat", methods=["POST"])
@login_required
def chat(cid):
    user = current_user()
    data = request.get_json(silent=True) or {}
    message = str(data.get("message") or "").strip()
    file_ids = [str(f) for f in (data.get("file_ids") or [])]
    project_id = data.get("project_id") or None

    conv = chat_service.get_conversation(user["id"], cid)
    if not conv:
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    if not message:
        return jsonify({"error": "Message is required", "type": "invalid_request"}), 400

    model_id = data.get("model_id") or conv.get("model_id") or user.get("active_model_id")
    try:
        model = _resolve_chat_model(user["id"], model_id)
    except AdapterError as e:
        return jsonify({"error": str(e), "type": e.error_type}), e.status_code

    chat_service.save_message(user["id"], cid, "user", message, model["id"])
    chat_service.set_conversation_model(user["id"], cid, model["id"])
    context = chat_service.build_context(user["id"], cid, message, file_ids, project_id)
    return _stream_response(_generate_stream(user["id"], cid, model, context))


@app.route("/api/conversations/<cid>/regenerate", methods=["POST"])
@login_required
def regenerate(cid):
    user = current_user()
    data = request.get_json(silent=True) or {}
    conv = chat_service.get_conversation(user["id"], cid)
    if not conv:
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404

    msgs = chat_service.get_messages(user["id"], cid)
    last_assistant = next((i for i in range(len(msgs) - 1, -1, -1) if msgs[i]["role"] == "assistant"), None)
    keep = msgs[:last_assistant] if last_assistant is not None else msgs
    last_user = next((m for m in reversed(keep) if m["role"] == "user"), None)
    if not last_user:
        return jsonify({"error": "No user message to regenerate from", "type": "invalid_request"}), 400

    model_id = data.get("model_id") or conv.get("model_id") or user.get("active_model_id")
    try:
        model = _resolve_chat_model(user["id"], model_id)
    except AdapterError as e:
        return jsonify({"error": str(e), "type": e.error_type}), e.status_code

    if last_assistant is not None:
        chat_service.delete_messages(cid, [m["id"] for m in msgs[last_assistant:]])
    chat_service.set_conversation_model(user["id"], cid, model["id"])

    context = chat_service.build_context(
        user["id"],
        cid,
        last_user["content"],
        [str(f) for f in (data.get("file_ids") or [])],
        data.get("project_id") or None,
        history=keep[:-1],
    )
    return _stream_response(_generate_stream(user["id"], cid, model, context))


@app.route("/api/models/<model_id>/capabilities", methods=["GET"])
@login_required
def model_capabilities(model_id):
    model = ModelConfig.get_model(current_user()["id"], model_id)
    if not model:
        return jsonify({"error": "Model not configured", "type": "model_not_found"}), 404
    return jsonify({"capabilities": model.get("capabilities", {})})


# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------

def _owned_file(user_id: str, file_id: str) -> dict[str, Any] | None:
    return query("SELECT * FROM files WHERE id = ? AND user_id = ?", (file_id, user_id), one=True)


@app.route("/api/files/upload", methods=["POST"])
@login_required
def upload_file():
    user = current_user()
    conversation_id = request.form.get("conversation_id") or None
    project_id = request.form.get("project_id") or None
    files = request.files.getlist("files") or request.files.getlist("file")

    if not files:
        return jsonify({"error": "No files provided", "type": "invalid_request"}), 400
    if conversation_id and not chat_service.get_conversation(user["id"], conversation_id):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    if project_id and not get_project(user["id"], project_id):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404

    results = []
    for f in files:
        try:
            info = save_uploaded_file(f, user["id"], conversation_id, project_id)
        except FileError as e:
            results.append({"filename": f.filename, "error": str(e), "ok": False})
            continue
        except Exception as e:  # noqa: BLE001
            log.exception("Upload failed")
            results.append({"filename": f.filename, "error": str(e), "ok": False})
            continue

        if info["file_type"] == "archive":
            target_project = project_id or create_project(
                user["id"], os.path.splitext(info["filename"])[0] or "Uploaded project", "Created from archive upload"
            )
            try:
                report = process_zip(info["path"], target_project, user["id"], conversation_id)
                index_project_files(user["id"], target_project)
            except FileError as e:
                results.append({"filename": info["filename"], "error": str(e), "ok": False})
                continue
            results.append({
                "ok": True,
                "id": info["id"],
                "filename": info["filename"],
                "file_type": info["file_type"],
                "project_id": target_project,
                "extracted": report["kept"],
                "skipped_sensitive": report["skipped_sensitive"],
            })
        else:
            results.append({
                "ok": True,
                "id": info["id"],
                "filename": info["filename"],
                "file_type": info["file_type"],
                "mime": info["mime"],
                "size": info["size"],
            })

    return jsonify({"files": results})


@app.route("/api/files/generate", methods=["POST"])
@login_required
def generate_file():
    """Create a file from AI-generated content.

    Request body:
    {
        "filename": "example.py",
        "content": "print('hello')",
        "conversation_id": "conv_xxx" (optional),
        "project_id": "proj_xxx" (optional)
    }
    """
    user = current_user()
    data = request.get_json(silent=True) or {}

    filename = (data.get("filename") or "").strip()
    if not filename:
        return jsonify({"error": "filename is required", "type": "invalid_request"}), 400

    content = data.get("content", "")
    if content is None:
        content = ""

    conversation_id = data.get("conversation_id") or None
    project_id = data.get("project_id") or None

    if conversation_id and not chat_service.get_conversation(user["id"], conversation_id):
        return jsonify({"error": "Conversation not found", "type": "not_found"}), 404
    if project_id and not get_project(user["id"], project_id):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404

    try:
        info = save_generated_file(
            filename,
            content,
            user["id"],
            conversation_id,
            project_id,
        )
    except FileError as e:
        return jsonify({"error": str(e), "type": "invalid_request"}), 400
    except Exception as e:  # noqa: BLE001
        log.exception("File generation failed")
        return jsonify({"error": f"Failed to generate file: {e}", "type": "generation_error"}), 500

    return jsonify({
        "ok": True,
        "id": info["id"],
        "filename": info["filename"],
        "mime": info["mime"],
        "size": info["size"],
        "file_type": info["file_type"],
        "language": info["language"],
        "ext": info["ext"],
    }), 201


@app.route("/api/files/shared", methods=["GET"])
@login_required
def list_user_files():
    rows = query(
        "SELECT id, filename, mime, size, file_type, uploaded_at FROM files"
        " WHERE user_id = ? AND conversation_id IS NULL ORDER BY uploaded_at DESC LIMIT 200",
        (current_user()["id"],),
    )
    return jsonify({"files": rows})


@app.route("/api/files/<file_id>", methods=["GET"])
@login_required
def get_file(file_id):
    row = _owned_file(current_user()["id"], file_id)
    if not row:
        return jsonify({"error": "File not found", "type": "not_found"}), 404
    row.pop("path", None)
    return jsonify({"file": row})


@app.route("/api/files/<file_id>", methods=["DELETE"])
@login_required
def delete_file(file_id):
    user = current_user()
    row = _owned_file(user["id"], file_id)
    if not row:
        return jsonify({"error": "File not found", "type": "not_found"}), 404
    execute("DELETE FROM files WHERE id = ? AND user_id = ?", (file_id, user["id"]))
    try:
        if row.get("path") and os.path.isfile(row["path"]):
            os.remove(row["path"])
    except OSError:
        log.warning("Could not remove %s from disk", row.get("path"))
    return jsonify({"deleted": True, "id": file_id})


@app.route("/api/files/<file_id>/content", methods=["GET"])
@login_required
def get_file_text(file_id):
    row = _owned_file(current_user()["id"], file_id)
    if not row:
        return jsonify({"error": "File not found", "type": "not_found"}), 404
    kind = detect_file_type(row["filename"], row["mime"])
    if kind["category"] == "image":
        return jsonify({"type": "image", "path": f"/api/files/{file_id}/raw"})
    return jsonify({"content": extract_text_from_file(row["path"]), "file_type": kind["category"]})


@app.route("/api/files/<file_id>/raw", methods=["GET"])
@login_required
def get_file_raw(file_id):
    row = _owned_file(current_user()["id"], file_id)
    if not row or not os.path.isfile(row["path"]):
        return jsonify({"error": "File not found", "type": "not_found"}), 404
    return send_file(row["path"], download_name=row["filename"])


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@app.route("/api/projects", methods=["GET"])
@login_required
def list_projects_route():
    return jsonify({"projects": list_projects(current_user()["id"])})


@app.route("/api/projects", methods=["POST"])
@login_required
def create_project_route():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip() or "New project"
    pid = create_project(current_user()["id"], name, str(data.get("description") or ""))
    return jsonify({"id": pid, "name": name}), 201


@app.route("/api/projects/<pid>", methods=["DELETE"])
@login_required
def delete_project_route(pid):
    if not delete_project(current_user()["id"], pid):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404
    return jsonify({"deleted": True, "id": pid})


@app.route("/api/projects/default", methods=["GET"])
@login_required
def default_project_route():
    """Return the user's first (or freshly created) project for the workspace."""
    user = current_user()
    projects = list_projects(user["id"])
    if projects:
        return jsonify({"id": projects[0]["id"]})
    pid = create_project("Workspace", "Default workspace project", user["id"])
    return jsonify({"id": pid})


@app.route("/api/projects/<pid>", methods=["GET"])
@login_required
def get_project_route(pid):
    project = get_project(current_user()["id"], pid)
    if not project:
        return jsonify({"error": "Project not found", "type": "not_found"}), 404
    return jsonify({"project": project})


@app.route("/api/projects/<pid>/tree", methods=["GET"])
@login_required
def project_tree(pid):
    user = current_user()
    if not get_project(user["id"], pid):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404
    return jsonify({"tree": get_project_tree(user["id"], pid)})


@app.route("/api/projects/<pid>/search", methods=["GET"])
@login_required
def search_project(pid):
    user = current_user()
    if not get_project(user["id"], pid):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404
    limit = max(1, min(int(request.args.get("limit", 10) or 10), 50))
    return jsonify({"chunks": retrieve_relevant_chunks(pid, request.args.get("q", ""), limit)})


@app.route("/api/projects/<pid>/index", methods=["POST"])
@login_required
def index_project(pid):
    user = current_user()
    if not get_project(user["id"], pid):
        return jsonify({"error": "Project not found", "type": "not_found"}), 404
    return jsonify(index_project_files(user["id"], pid))


@app.route("/api/projects/<pid>/file", methods=["GET"])
@login_required
def project_file_content(pid):
    content = get_file_content(current_user()["id"], pid, request.args.get("path", ""))
    if content is None:
        return jsonify({"error": "File not found", "type": "not_found"}), 404
    return jsonify({"content": content})


# ---------------------------------------------------------------------------
# Static SPA (same origin as the API, so provider keys stay server-side)
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def serve_index():
    return send_from_directory(_project_root, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    if filename.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    top = filename.split("/", 1)[0]
    if top not in _frontend_dirs and filename != "index.html":
        return jsonify({"error": "Not found"}), 404
    target = safe_join(_project_root, filename)
    if not target or not os.path.isfile(target):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(_project_root, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="127.0.0.1", port=port, debug=debug, threaded=True)
