from abc import ABC, abstractmethod
from typing import Any
from typing import AsyncIterator


class AdapterError(Exception):
    """Raised when a provider returns an error."""

    def __init__(self, message: str, status_code: int = 400, error_type: str = "provider_error"):
        self.status_code = status_code
        self.error_type = error_type
        super().__init__(message)


class BaseAdapter(ABC):
    """Abstract base for all provider adapters."""

    def __init__(self, model_config: dict[str, Any]):
        self.config = model_config
        self.model_id = model_config.get("id", "")
        self.name = model_config.get("name", self.model_id)
        self.provider = model_config.get("provider", "")
        self.base_url = model_config.get("baseUrl", "")
        self.api_key = model_config.get("apiKey", "")
        self.capabilities = model_config.get("capabilities", {})
        self.supports_streaming = model_config.get("supportsStreaming", True)

    @property
    def can_stream(self) -> bool:
        return self.supports_streaming

    @property
    def can_vision(self) -> bool:
        return self.capabilities.get("vision", False)

    @property
    def can_image_generation(self) -> bool:
        return self.capabilities.get("imageGeneration", False)

    @property
    def can_code(self) -> bool:
        return self.capabilities.get("codeGeneration", True)

    @property
    def can_file_analysis(self) -> bool:
        return self.capabilities.get("fileAnalysis", True)

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        max_tokens: int | None = None,
        stream: bool = True,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream generate a response. Yields dicts with 'content' and 'done' flags."""
        pass

    @abstractmethod
    async def generate_non_streaming(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Non-streaming generation. Returns full response text."""
        pass

    @abstractmethod
    async def generate_image(self, prompt: str, **kwargs) -> str | None:
        """Generate an image. Returns a URL or base64 string, or None if unsupported."""
        pass

    @abstractmethod
    async def test_connection(self) -> dict[str, Any]:
        """Test the model connection. Returns status dict."""
        pass
