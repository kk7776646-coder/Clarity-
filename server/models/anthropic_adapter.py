import logging
from typing import Any
from typing import AsyncIterator

from server.models.base import BaseAdapter, AdapterError

log = logging.getLogger(__name__)

try:
    from anthropic import AsyncAnthropic, AuthenticationError as AnthropicAuthError
except ImportError:
    AsyncAnthropic = None  # type: ignore


class AnthropicAdapter(BaseAdapter):
    """Adapter for Anthropic Claude models."""

    def __init__(self, model_config: dict[str, Any]):
        super().__init__(model_config)
        if AsyncAnthropic is None:
            raise AdapterError("anthropic package not installed", 500, "dependency_missing")
        client_kwargs = {"api_key": self.api_key or None}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        self._client = AsyncAnthropic(**client_kwargs)

    def _resolve_model_name(self) -> str:
        return self.config.get("modelName") or self.model_id

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
                    mime = att.get("mime", "")
                    data = att.get("data", "")
                    if ftype == "image" or mime.startswith("image/"):
                        parts.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime or "image/png",
                                "data": data,
                            }
                        })
                    elif ftype == "file_reference":
                        parts.append({"type": "text", "text": f"[File: {att.get('name','file')}]\n{att.get('content','')}"})
                result.append({"role": role, "content": parts})

        if not result:
            result.append({"role": "user", "content": "Hello"})

        if result and result[0].get("role") == "assistant":
            result.insert(0, {"role": "user", "content": "Hello"})

        return result

    async def generate(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = True,
    ) -> AsyncIterator[dict[str, Any]]:
        try:
            anthropic_messages = self._build_messages(messages)
            model_name = self._resolve_model_name()
            kwargs: dict[str, Any] = {
                "model": model_name,
                "messages": anthropic_messages,
                "temperature": temperature if temperature is not None else self.config.get("defaultTemperature", 0.7),
                "max_tokens": max_tokens if max_tokens is not None else self.config.get("maxOutputTokens", 4096),
            }

            if not self.can_stream or not stream:
                resp = await self._client.messages.create(stream=False, **kwargs)
                content = ""
                for block in resp.content:
                    if hasattr(block, "text"):
                        content += block.text
                yield {"content": content, "done": True, "model": model_name}
                return

            stream_resp = self._client.messages.stream(**kwargs)
            async with stream_resp as response:
                async for chunk in response.text_stream:
                    yield {"content": chunk, "done": False}
            yield {"content": "", "done": True, "model": model_name}

        except AnthropicAuthError:
            raise AdapterError("Invalid Anthropic API key", 401, "auth_error")
        except Exception as e:
            code = getattr(e, "status_code", None)
            if code == 429:
                raise AdapterError("Rate limit exceeded", 429, "rate_limit")
            if code == 404:
                raise AdapterError(f"Model not found: {self._resolve_model_name()}", 404, "model_not_found")
            log.exception("Anthropic adapter error")
            raise AdapterError(str(e), code or 500, "api_error")

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
        return None

    async def test_connection(self) -> dict[str, Any]:
        try:
            model_name = self._resolve_model_name()
            resp = await self._client.messages.create(
                model=model_name,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return {"ok": True, "model": model_name}
        except Exception as e:
            return {"ok": False, "error": str(e)}
