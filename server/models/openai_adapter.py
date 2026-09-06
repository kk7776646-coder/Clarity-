import json
import logging
from typing import Any
from typing import AsyncIterator

from server.models.base import BaseAdapter, AdapterError

log = logging.getLogger(__name__)

try:
    from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError, AuthenticationError
except ImportError:
    AsyncOpenAI = None  # type: ignore


class OpenAIAdapter(BaseAdapter):
    """Adapter for OpenAI-compatible APIs (OpenAI, OpenRouter, local Ollama, etc.)."""

    def __init__(self, model_config: dict[str, Any]):
        super().__init__(model_config)
        if AsyncOpenAI is None:
            raise AdapterError("openai package not installed", 500, "dependency_missing")
        self._client = AsyncOpenAI(base_url=self.base_url or None, api_key=self.api_key or None)

    def _resolve_model_name(self) -> str:
        """The actual model string to send to the provider API.

        Priority is: modelName (the provider's model id) > the registry id.
        Falls back to the registry id only if modelName is empty.
        """
        name = self.config.get("modelName") or self.config.get("model_name") or ""
        if name:
            return name
        return self.model_id

    def _build_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for msg in messages:
            role = msg.get("role", "user")
            text_content = msg.get("content", "")
            attachments = msg.get("attachments", [])

            if not attachments:
                result.append({"role": role, "content": text_content})
            else:
                parts = []
                if text_content:
                    parts.append({"type": "text", "text": text_content})
                for att in attachments:
                    ftype = att.get("type", "")
                    data = att.get("data", "")
                    mime = att.get("mime", "")
                    if ftype == "image" or mime.startswith("image/"):
                        if data.startswith("http"):
                            url = data
                        else:
                            url = f"data:{mime};base64,{data}"
                        parts.append({
                            "type": "image_url",
                            "image_url": {"url": url},
                        })
                    elif ftype == "file_reference":
                        parts.append({"type": "text", "text": f"[File attachment: {att.get('name','file')}]\n{att.get('content','')}"})
                result.append({"role": role, "content": parts})
        return result

    async def generate(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = True,
    ) -> AsyncIterator[dict[str, Any]]:
        try:
            openai_messages = self._build_messages(messages)
            model_name = self._resolve_model_name()
            kwargs: dict[str, Any] = {
                "model": model_name,
                "messages": openai_messages,
            }
            # Only forward temperature / max_tokens / top_p when explicitly set.
            # Avoid sending undefined/null/invalid params unless required.
            t = temperature if temperature is not None else self.config.get("defaultTemperature")
            if t is not None:
                kwargs["temperature"] = t
            m = max_tokens if max_tokens is not None else self.config.get("maxOutputTokens")
            if m:
                kwargs["max_tokens"] = m
            tp = self.config.get("defaultTopP")
            if tp is not None and tp != 1.0:
                kwargs["top_p"] = tp

            if not self.can_stream or not stream:
                resp = await self._client.chat.completions.create(stream=False, **kwargs)
                content = resp.choices[0].message.content or ""
                yield {"content": content, "done": True, "model": resp.model}
                return

            stream_resp = await self._client.chat.completions.create(stream=True, **kwargs)
            async for chunk in stream_resp:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield {"content": delta.content, "done": False}
            yield {"content": "", "done": True, "model": model_name}

        except AuthenticationError:
            raise AdapterError("Invalid API key for this provider", 401, "auth_error")
        except RateLimitError as e:
            raise AdapterError(f"Rate limit exceeded: {e}", 429, "rate_limit")
        except APIConnectionError:
            raise AdapterError("Could not connect to the provider API", 503, "connection_error")
        except APIError as e:
            if e.status_code == 404:
                raise AdapterError(f"Model not found: {self._resolve_model_name()}", 404, "model_not_found")
            raise AdapterError(f"Provider API error: {e}", e.status_code or 500, "api_error")
        except Exception as e:
            log.exception("OpenAI adapter error")
            raise AdapterError(str(e), 500, "unknown_error")

    async def generate_non_streaming(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        async for event in self.generate(messages, temperature, max_tokens, stream=False):
            if event.get("done"):
                return event.get("content", "")
        return ""

    async def generate_image(self, prompt: str, **kwargs) -> str | None:
        if not self.can_image_generation:
            return None
        try:
            model_name = self._resolve_model_name()
            resp = await self._client.images.generate(
                model=model_name,
                prompt=prompt,
                n=1,
                response_format="url",
            )
            return resp.data[0].url if resp.data else None
        except Exception as e:
            log.exception("Image generation error")
            raise AdapterError(str(e), 500, "image_generation_error")

    async def test_connection(self) -> dict[str, Any]:
        model_name = self._resolve_model_name()
        # First try models.retrieve (preferred when supported).
        try:
            resp = await self._client.models.retrieve(model_name)
            return {"ok": True, "model": getattr(resp, "id", model_name) or model_name}
        except AuthenticationError:
            # Many OpenAI-compatible providers (OpenRouter, Groq, etc.) don't support
            # /models/{id} and return 401 even when the same key works for chat.
            # Fall back to a chat completion probe to properly verify the credential.
            return await self._test_via_chat(model_name)
        except APIError as e:
            # Many (especially OpenAI-compatible) providers don't support /models
            # or return 404 for it; fall back to a tiny chat completion probe.
            if getattr(e, "status_code", None) in (404, 405, 400):
                return await self._test_via_chat(model_name)
            return {"ok": False, "error": f"Provider error: {e}", "error_type": "api_error"}
        except APIConnectionError:
            return {"ok": False, "error": "Could not connect to the provider API", "error_type": "connection_error"}
        except Exception as e:
            return await self._test_via_chat(model_name)

    async def _test_via_chat(self, model_name: str) -> dict[str, Any]:
        try:
            resp = await self._client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": "Reply with the single word: OK"}],
                max_tokens=256,
                stream=False,
            )
            if not hasattr(resp, "choices") or not resp.choices or len(resp.choices) == 0:
                log.warning("test_via_chat: empty choices in response for model %s", model_name)
                return {"ok": False, "error": "Provider returned empty choices", "error_type": "empty_response"}
            choice = resp.choices[0]
            message = getattr(choice, "message", None) if choice else None
            if message is None:
                log.warning("test_via_chat: no message in first choice for model %s", model_name)
                return {"ok": False, "error": "Provider returned no message", "error_type": "empty_response"}
            text = getattr(message, "content", None) or ""
            if not text.strip():
                finish_reason = getattr(choice, "finish_reason", None)
                log.warning("test_via_chat: empty content for model %s, finish_reason=%s", model_name, finish_reason)
                return {"ok": False, "error": "Provider returned empty response", "error_type": "empty_response"}
            return {"ok": True, "model": getattr(resp, "model", model_name) or model_name, "note": "Verified via chat completion probe"}
        except AuthenticationError:
            return {"ok": False, "error": "Invalid API key for this provider", "error_type": "auth_error"}
        except RateLimitError as e:
            return {"ok": False, "error": f"Rate limit exceeded: {e}", "error_type": "rate_limit"}
        except APIConnectionError:
            return {"ok": False, "error": "Could not connect to the provider API", "error_type": "connection_error"}
        except APIError as e:
            if getattr(e, "status_code", None) == 404:
                return {"ok": False, "error": f"Model not found at provider: {model_name}", "error_type": "model_not_found"}
            return {"ok": False, "error": f"Provider error: {e}", "error_type": "api_error"}
        except Exception as e:
            return {"ok": False, "error": str(e), "error_type": "unknown_error"}

    @property
    def can_image_generation(self) -> bool:
        return self.capabilities.get("imageGeneration", False)