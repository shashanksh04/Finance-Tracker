import httpx
from typing import List, Optional
from app.core.config import settings


class EmbeddingService:
    _client: Optional[httpx.AsyncClient] = None

    @classmethod
    def _get_client(cls) -> httpx.AsyncClient:
        if cls._client is None:
            headers = {}
            if settings.OLLAMA_API_KEY:
                headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
            cls._client = httpx.AsyncClient(timeout=60, headers=headers)
        return cls._client

    @classmethod
    async def embed(cls, text: str, model: Optional[str] = None) -> List[float]:
        client = cls._get_client()
        payload = {
            "model": model or settings.EMBEDDING_MODEL,
            "input": text,
        }
        try:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/embed",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            embeddings = result.get("embeddings", [])
            if embeddings:
                return embeddings[0]
            return []
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama embed error {e.response.status_code}: {e.response.text}")
        except httpx.RequestError as e:
            raise RuntimeError(f"Ollama embed request failed: {e}")

    @classmethod
    async def embed_batch(cls, texts: List[str], model: Optional[str] = None) -> List[List[float]]:
        if not texts:
            return []
        client = cls._get_client()
        payload = {
            "model": model or settings.EMBEDDING_MODEL,
            "input": texts,
        }
        try:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/embed",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            return result.get("embeddings", [])
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama batch embed error {e.response.status_code}: {e.response.text}")
        except httpx.RequestError as e:
            raise RuntimeError(f"Ollama batch embed request failed: {e}")

    @classmethod
    async def embed_dimension(cls, model: Optional[str] = None) -> int:
        vec = await cls.embed("test", model=model)
        return len(vec)

    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        for x, y in zip(a, b):
            dot += x * y
            norm_a += x * x
            norm_b += y * y
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / ((norm_a ** 0.5) * (norm_b ** 0.5))

    @classmethod
    async def close(cls):
        if cls._client:
            await cls._client.aclose()
            cls._client = None
