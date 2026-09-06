"""Model registry.

Two sources of truth, both server-side:

* ``MODELS_CONFIG`` / provider env vars — deployment-level models shared by
  every authenticated user.
* the ``model_configs`` table — models a signed-in user added themselves.

API keys are only ever read here and handed to an adapter; they are never
returned to the browser (see ``app._public_model``).
"""

import json
import os
import time
from typing import Any

from server.models.anthropic_adapter import AnthropicAdapter
from server.models.openai_adapter import OpenAIAdapter
from server.storage.db import execute, query


class ModelConfig:
    @classmethod
    def _load_from_env(cls) -> list[dict[str, Any]]:
        raw = os.environ.get("MODELS_CONFIG", "")
        if not raw.strip():
            return []
        try:
            configs = json.loads(raw)
        except Exception:
            return []
        return [cls._normalize(c) for c in configs if isinstance(c, dict) and c.get("id")]

    @classmethod
    def _load_user_models(cls, user_id: str) -> list[dict[str, Any]]:
        if not user_id:
            return []
        rows = query(
            "SELECT * FROM model_configs WHERE user_id = ? ORDER BY created_at ASC",
            (user_id,),
        )
        out = []
        for r in rows:
            try:
                caps = json.loads(r.get("capabilities") or "{}")
            except Exception:
                caps = {}
            out.append({
                "id": r["id"],
                "name": r["name"],
                "provider": r.get("provider") or "custom",
                "baseUrl": r.get("base_url") or "",
                "apiKey": r.get("api_key") or "",
                "modelName": r.get("model_name") or "",
                "modelType": r.get("model_type") or "text",
                "capabilities": {
                    "text": caps.get("text", True),
                    "vision": caps.get("vision", False),
                    "imageGeneration": caps.get("imageGeneration", False),
                    "codeGeneration": caps.get("codeGeneration", True),
                    "fileAnalysis": caps.get("fileAnalysis", True),
                    "streaming": caps.get("streaming", caps.get("supportsStreaming", True)),
                },
                "contextWindow": r.get("context_window") or 16000,
                "maxOutputTokens": r.get("max_output_tokens") or 4096,
                "defaultTemperature": r.get("default_temperature") or 0.7,
                "defaultTopP": r.get("top_p") if r.get("top_p") is not None else (r.get("default_top_p") or 1.0),
                "supportsStreaming": bool(r.get("supports_streaming", 1)),
                "enabled": bool(r.get("enabled", 1)),
                "status": r.get("status") or "untested",
                "lastTestedAt": r.get("last_tested_at"),
                "lastError": r.get("last_error"),
                "isUser": True,
            })
        return out

    @classmethod
    def list_models(cls, user_id: str) -> list[dict[str, Any]]:
        """Every model the given user may select.

        The user's own models come first and therefore win any id collision
        with a deployment/env model. This is the single ordering used by every
        resolution path (listing, verification and chat) so all three always
        agree on which record — and therefore which API key, base URL and
        provider model id — belongs to a given model id.
        """
        models: list[dict[str, Any]] = []
        models.extend(cls._load_user_models(user_id))
        seen = {m["id"] for m in models}
        for m in cls._load_from_env() + cls._builtin():
            if m["id"] in seen:
                continue
            seen.add(m["id"])
            models.append(m)
        return models

    @classmethod
    def get_model(cls, user_id: str, model_id: str) -> dict[str, Any] | None:
        """Authoritative lookup: the user's own record wins, then env/builtin."""
        if not model_id:
            return None
        user_model = cls.get_user_model(user_id, model_id)
        if user_model:
            return user_model
        for m in cls._load_from_env() + cls._builtin():
            if m["id"] == model_id:
                return m
        return None

    @classmethod
    def describe(cls, model: dict[str, Any]) -> dict[str, Any]:
        """Secret-free diagnostics for logging. Never includes the key itself."""
        key = str(model.get("apiKey") or "")
        return {
            "id": model.get("id"),
            "provider": model.get("provider"),
            "modelId": model.get("modelName") or model.get("id"),
            "baseUrl": model.get("baseUrl") or "",
            "apiKeyPresent": bool(key),
            "apiKeyLength": len(key),
            "isUser": bool(model.get("isUser")),
        }

    @classmethod
    def get_user_model(cls, user_id: str, model_id: str) -> dict[str, Any] | None:
        for m in cls._load_user_models(user_id):
            if m["id"] == model_id:
                return m
        return None

    @classmethod
    def save_user_model(cls, user_id: str, cfg: dict[str, Any]) -> dict[str, Any]:
        norm = cls._normalize(cfg)
        norm["isUser"] = True
        caps_json = json.dumps(norm["capabilities"])
        existing = query(
            "SELECT id, status FROM model_configs WHERE id = ? AND user_id = ?",
            (norm["id"], user_id),
            one=True,
        )
        if existing:
            prev_status = existing.get("status") or "untested"
            new_status = norm.get("status") or prev_status
            execute(
                "UPDATE model_configs SET name=?, provider=?, base_url=?, api_key=?, model_name=?,"
                " model_type=?, capabilities=?, context_window=?, max_output_tokens=?,"
                " default_temperature=?, default_top_p=?, top_p=?, supports_streaming=?, enabled=?,"
                " status=?, last_error=? WHERE id=? AND user_id=?",
                (
                    norm["name"], norm["provider"], norm.get("baseUrl", ""), norm.get("apiKey", ""),
                    norm.get("modelName", "") or norm["id"],
                    norm.get("modelType", "text"), caps_json, norm.get("contextWindow", 16000),
                    norm.get("maxOutputTokens", 4096), norm.get("defaultTemperature", 0.7),
                    norm.get("defaultTopP", 1.0), norm.get("defaultTopP", 1.0),
                    1 if norm.get("supportsStreaming", True) else 0,
                    1 if norm.get("enabled", True) else 0,
                    new_status,
                    norm.get("lastError"),
                    norm["id"], user_id,
                ),
            )
            norm["status"] = new_status
        else:
            execute(
                "INSERT INTO model_configs (id, user_id, name, provider, base_url, api_key, model_name,"
                " model_type, capabilities, context_window, max_output_tokens, default_temperature,"
                " default_top_p, top_p, supports_streaming, enabled, status, last_error, is_active,"
                " created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    norm["id"], user_id, norm["name"], norm["provider"], norm.get("baseUrl", ""),
                    norm.get("apiKey", ""), norm.get("modelName", "") or norm["id"],
                    norm.get("modelType", "text"), caps_json, norm.get("contextWindow", 16000),
                    norm.get("maxOutputTokens", 4096), norm.get("defaultTemperature", 0.7),
                    norm.get("defaultTopP", 1.0), norm.get("defaultTopP", 1.0),
                    1 if norm.get("supportsStreaming", True) else 0,
                    1 if norm.get("enabled", True) else 0,
                    norm.get("status") or "untested",
                    norm.get("lastError"),
                    0, time.time(),
                ),
            )
        return norm

    @classmethod
    def delete_user_model(cls, user_id: str, model_id: str) -> bool:
        return execute(
            "DELETE FROM model_configs WHERE id = ? AND user_id = ?",
            (model_id, user_id),
        ) > 0

    @classmethod
    def set_enabled(cls, user_id: str, model_id: str, enabled: bool) -> dict[str, Any] | None:
        if not cls.get_user_model(user_id, model_id):
            return None
        execute(
            "UPDATE model_configs SET enabled = ? WHERE id = ? AND user_id = ?",
            (1 if enabled else 0, model_id, user_id),
        )
        return cls.get_user_model(user_id, model_id)

    @classmethod
    def set_status(cls, user_id: str, model_id: str, status: str, last_error: str | None = None) -> None:
        execute(
            "UPDATE model_configs SET status = ?, last_tested_at = ?, last_error = ?"
            " WHERE id = ? AND user_id = ?",
            (status, time.time(), last_error, model_id, user_id),
        )

    @staticmethod
    def _builtin() -> list[dict[str, Any]]:
        """Models implied by provider keys present in the server environment."""
        out: list[dict[str, Any]] = []
        if os.environ.get("OPENAI_API_KEY"):
            for sub in [
                {"id": "gpt-4o-mini", "name": "Clarity", "modelName": "gpt-4o-mini"},
                {"id": "gpt-4o", "name": "Clarity", "modelName": "gpt-4o"},
                {"id": "dall-e-3", "name": "DALL·E 3", "modelName": "dall-e-3", "modelType": "image_generation"},
            ]:
                is_image = sub.get("modelType") == "image_generation"
                out.append({
                    "id": sub["id"],
                    "name": sub["name"],
                    "modelName": sub["modelName"],
                    "provider": "openai",
                    "baseUrl": "https://api.openai.com/v1",
                    "apiKey": os.environ["OPENAI_API_KEY"],
                    "modelType": sub.get("modelType", "text"),
                    "capabilities": {
                        "text": not is_image,
                        "vision": sub["id"] in ("gpt-4o-mini", "gpt-4o"),
                        "imageGeneration": is_image,
                        "codeGeneration": not is_image,
                        "fileAnalysis": not is_image,
                        "streaming": not is_image,
                    },
                    "contextWindow": 4000 if is_image else 128000,
                    "maxOutputTokens": 0 if is_image else 4096,
                    "defaultTemperature": 1.0 if is_image else 0.7,
                    "defaultTopP": 1.0,
                    "supportsStreaming": not is_image,
                    "status": "available",
                    "enabled": True,
                    "isUser": False,
                })
        if os.environ.get("ANTHROPIC_API_KEY"):
            out.append({
                "id": "claude-3-5-sonnet",
                "name": "Clarity",
                "modelName": "claude-3-5-sonnet-20241022",
                "provider": "anthropic",
                "baseUrl": "https://api.anthropic.com",
                "apiKey": os.environ["ANTHROPIC_API_KEY"],
                "modelType": "text",
                "capabilities": {"text": True, "vision": True, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 200000,
                "maxOutputTokens": 4096,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        if os.environ.get("OPENROUTER_API_KEY"):
            out.append({
                "id": "openrouter-mixtral",
                "name": "Mixtral 8x7B (OpenRouter)",
                "modelName": "mistralai/mixtral-8x7b-instruct",
                "provider": "openrouter",
                "baseUrl": "https://openrouter.ai/api/v1",
                "apiKey": os.environ["OPENROUTER_API_KEY"],
                "modelType": "text",
                "capabilities": {"text": True, "vision": False, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 32000,
                "maxOutputTokens": 4096,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if gemini_key:
            out.append({
                "id": "gemini-2-0-flash",
                "name": "Gemini 2.0 Flash",
                "modelName": "gemini-2.0-flash",
                "provider": "gemini",
                "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
                "apiKey": gemini_key,
                "modelType": "text",
                "capabilities": {"text": True, "vision": True, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 1000000,
                "maxOutputTokens": 8192,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        if os.environ.get("GROQ_API_KEY"):
            out.append({
                "id": "groq-llama-3-3-70b",
                "name": "Llama 3.3 70B (Groq)",
                "modelName": "llama-3.3-70b-versatile",
                "provider": "groq",
                "baseUrl": "https://api.groq.com/openai/v1",
                "apiKey": os.environ["GROQ_API_KEY"],
                "modelType": "text",
                "capabilities": {"text": True, "vision": False, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 128000,
                "maxOutputTokens": 4096,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        if os.environ.get("MISTRAL_API_KEY"):
            out.append({
                "id": "mistral-large",
                "name": "Mistral Large",
                "modelName": "mistral-large-latest",
                "provider": "mistral",
                "baseUrl": "https://api.mistral.ai/v1",
                "apiKey": os.environ["MISTRAL_API_KEY"],
                "modelType": "text",
                "capabilities": {"text": True, "vision": False, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 128000,
                "maxOutputTokens": 4096,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        if os.environ.get("TOGETHER_API_KEY"):
            out.append({
                "id": "together-llama-3-1-70b",
                "name": "Llama 3.1 70B (Together)",
                "modelName": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                "provider": "together",
                "baseUrl": "https://api.together.xyz/v1",
                "apiKey": os.environ["TOGETHER_API_KEY"],
                "modelType": "text",
                "capabilities": {"text": True, "vision": False, "imageGeneration": False, "codeGeneration": True, "fileAnalysis": True, "streaming": True},
                "contextWindow": 128000,
                "maxOutputTokens": 4096,
                "defaultTemperature": 0.7,
                "defaultTopP": 1.0,
                "supportsStreaming": True,
                "status": "available",
                "enabled": True,
                "isUser": False,
            })
        return out

    @staticmethod
    def _normalize(cfg: dict[str, Any]) -> dict[str, Any]:
        caps = cfg.get("capabilities", {}) or {}
        mid = str(cfg["id"]).strip()
        provider = str(cfg.get("provider") or "openai").strip().lower()
        base_url = str(cfg.get("baseUrl") or cfg.get("base_url") or "").strip()
        if not base_url:
            if provider == "openai":
                base_url = "https://api.openai.com/v1"
            elif provider == "openrouter":
                base_url = "https://openrouter.ai/api/v1"
            elif provider == "gemini":
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            elif provider == "anthropic":
                base_url = "https://api.anthropic.com"
            elif provider == "groq":
                base_url = "https://api.groq.com/openai/v1"
            elif provider == "mistral":
                base_url = "https://api.mistral.ai/v1"
            elif provider == "together":
                base_url = "https://api.together.xyz/v1"
            elif provider == "ollama":
                base_url = "http://localhost:11434/v1"

        streaming = caps.get("streaming", caps.get("supportsStreaming", cfg.get("supportsStreaming", True)))
        return {
            "id": mid,
            "name": str(cfg.get("name") or mid).strip(),
            "provider": provider,
            "baseUrl": base_url,
            "apiKey": str(cfg.get("apiKey") or cfg.get("api_key") or ""),
            "modelName": str(cfg.get("modelName") or cfg.get("model_name") or mid).strip(),
            "modelType": cfg.get("modelType", "text"),
            "capabilities": {
                "text": caps.get("text", True),
                "vision": caps.get("vision", False),
                "imageGeneration": caps.get("imageGeneration", False),
                "codeGeneration": caps.get("codeGeneration", True),
                "fileAnalysis": caps.get("fileAnalysis", True),
                "streaming": bool(streaming),
            },
            "contextWindow": int(cfg.get("contextWindow") or 16000),
            "maxOutputTokens": int(cfg.get("maxOutputTokens") or 4096),
            "defaultTemperature": float(cfg.get("defaultTemperature") or 0.7),
            "defaultTopP": float(cfg.get("defaultTopP") if cfg.get("defaultTopP") is not None else 1.0),
            "supportsStreaming": bool(streaming),
            "enabled": bool(cfg.get("enabled", True)),
            "status": cfg.get("status") or "untested",
            "lastTestedAt": cfg.get("lastTestedAt"),
            "lastError": cfg.get("lastError"),
        }

    @classmethod
    def get_adapter(cls, model: dict[str, Any]):
        """Route a model configuration to its provider adapter."""
        provider = str(model.get("provider") or "").lower()
        if provider == "anthropic":
            return AnthropicAdapter(model)
        # OpenAI, OpenRouter, Azure, Ollama and other OpenAI-compatible HTTP APIs.
        return OpenAIAdapter(model)
