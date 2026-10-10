from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.memory import FinancialMemory
from app.embeddings.embedding_service import EmbeddingService
from app.models.category import Category
from typing import Optional, List, Dict, Any

# Minimum cosine similarity for a semantic match to be trusted. mxbai-embed-large
# typically scores 0.4-0.8 across categories; below this we return no suggestion
# rather than mis-categorize.
_CONFIDENCE_THRESHOLD = 0.35


class CategorizationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def suggest_category(self, user_id: str, text: str) -> Optional[Category]:
        """
        Suggest the best category for a transaction's merchant/description.

        Order of resolution:
          1. Exact vendor memory: a user who once corrected "Burger King -> Food"
             is remembered verbatim (merchant_category memory keyed by the merchant).
          2. Semantic fallback: nearest matching category embedding above a
             confidence threshold, so a new but similar vendor still resolves.
        """
        cat = await self._suggest_by_vendor_memory(user_id, text)
        if cat:
            return cat
        return await self._semantic_suggest(user_id, text)

    async def suggest_with_confidence(self, user_id: str, text: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Return the top `limit` category candidates with confidence scores, so the
        UI can offer corrections ("You categorized this as X; did you mean Y?").
        """
        if not text:
            return []

        # Vendor memory exact match (highest trust).
        vendor = await self._vendor_category_id(user_id, text)
        if vendor:
            cat = await self._load_category(vendor)
            if cat:
                return [{"category_id": cat.id, "category": cat, "confidence": 0.99, "source": "learned"}]

        vector = await self._safe_embed(text)
        if not vector:
            return []

        result = await self.db.execute(
            select(FinancialMemory)
            .where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type == "category",
                FinancialMemory.deleted_at.is_(None),
            )
            .order_by(FinancialMemory.embedding_vector.cosine_distance(vector))
            .limit(limit)
        )
        out: List[Dict[str, Any]] = []
        for mem in result.scalars().all():
            dist = float(mem.embedding_vector.cosine_distance(vector))
            confidence = round(1.0 - dist, 3)
            if confidence < _CONFIDENCE_THRESHOLD:
                break
            cat = await self._load_category(mem.key)
            if cat:
                out.append({
                    "category_id": cat.id,
                    "category": cat,
                    "confidence": confidence,
                    "source": "semantic",
                })
        return out

    async def _suggest_by_vendor_memory(self, user_id: str, text: str) -> Optional[Category]:
        """Resolve a vendor by a previously learned correction (exact, then nearby)."""
        merchant = self._normalize(text)
        if not merchant:
            return None
        cat_id = await self._vendor_category_id(user_id, merchant)
        if not cat_id and text:
            # Exact merchant match failed; try a semantic match among learned vendors.
            vector = await self._safe_embed(merchant)
            if vector:
                cat_id = await self._vendor_category_by_embedding(user_id, vector)
        return await self._load_category(cat_id) if cat_id else None

    async def _vendor_category_id(self, user_id: str, merchant: str) -> Optional[str]:
        result = await self.db.execute(
            select(FinancialMemory.value).where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type == "merchant_category",
                FinancialMemory.key.lower() == merchant.lower(),
                FinancialMemory.deleted_at.is_(None),
            )
        )
        value = result.scalar_one_or_none()
        if not value:
            return None
        return str(value)

    async def _vendor_category_by_embedding(self, user_id: str, vector: List[float]) -> Optional[str]:
        result = await self.db.execute(
            select(FinancialMemory)
            .where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type == "merchant_category",
                FinancialMemory.deleted_at.is_(None),
            )
            .order_by(FinancialMemory.embedding_vector.cosine_distance(vector))
            .limit(1)
        )
        mem = result.scalar_one_or_none()
        if not mem:
            return None
        dist = float(mem.embedding_vector.cosine_distance(vector))
        if (1.0 - dist) < _CONFIDENCE_THRESHOLD:
            return None
        return str(mem.value)

    async def _semantic_suggest(self, user_id: str, text: str) -> Optional[Category]:
        vector = await self._safe_embed(text)
        if not vector:
            return None
        result = await self.db.execute(
            select(FinancialMemory)
            .where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type == "category",
                FinancialMemory.deleted_at.is_(None),
            )
            .order_by(FinancialMemory.embedding_vector.cosine_distance(vector))
            .limit(1)
        )
        memory = result.scalar_one_or_none()
        if not memory:
            return None
        dist = float(memory.embedding_vector.cosine_distance(vector))
        if (1.0 - dist) < _CONFIDENCE_THRESHOLD:
            return None
        return await self._load_category(memory.key)

    async def _load_category(self, category_id: Optional[str]) -> Optional[Category]:
        if not category_id:
            return None
        result = await self.db.execute(
            select(Category).where(Category.id == category_id, Category.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def _safe_embed(self, text: str) -> List[float]:
        try:
            return await EmbeddingService.embed(text)
        except Exception:
            # Embedding provider down: never break transaction creation on a
            # categorization suggestion - just skip the suggestion.
            return []

    @staticmethod
    def _normalize(text: str) -> str:
        return (text or "").strip()

    async def update_category_embedding(self, user_id: str, category_id: str, name: str):
        """
        Creates or updates the embedding for a category in FinancialMemory.
        """
        vector = await self._safe_embed(name)
        if not vector:
            return

        # Check if memory already exists
        result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.key == category_id,
                FinancialMemory.memory_type == "category"
            )
        )
        memory = result.scalar_one_or_none()

        if memory:
            memory.value = name
            memory.embedding_vector = vector
            memory.embedding = vector # store JSON version too
        else:
            new_memory = FinancialMemory(
                user_id=user_id,
                key=category_id,
                value=name,
                memory_type="category",
                embedding_vector=vector,
                embedding=vector
            )
            self.db.add(new_memory)

        await self.db.flush()

    async def learn_from_correction(self, user_id: str, merchant: str, category_id: str):
        """
        Creates a specific mapping memory for a merchant to a category.
        This allows the AI to remember a correction for a specific vendor.
        """
        merchant = self._normalize(merchant)
        if not merchant:
            return

        # Embed the merchant name
        vector = await self._safe_embed(merchant)
        if not vector:
            return

        # Use memory_type='merchant_category'
        # Key: merchant_name, Value: category_id
        result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.memory_type == "merchant_category",
                FinancialMemory.key == merchant,
            )
        )
        memory = result.scalar_one_or_none()

        if memory:
            memory.value = category_id
            memory.embedding_vector = vector
            memory.embedding = vector
        else:
            new_memory = FinancialMemory(
                user_id=user_id,
                key=merchant,
                value=category_id,
                memory_type="merchant_category",
                embedding_vector=vector,
                embedding=vector,
                importance=1.0 # Give corrections high importance
            )
            self.db.add(new_memory)

        await self.db.flush()
