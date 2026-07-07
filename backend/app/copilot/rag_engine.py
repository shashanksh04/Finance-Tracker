from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_
from app.models.memory import FinancialMemory
from app.models.transaction import Transaction
from app.models.bill import Bill
from app.embeddings.embedding_service import EmbeddingService


class RAGEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def retrieve(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
        min_score: float = 0.3,
    ) -> List[dict]:
        try:
            query_vec = await EmbeddingService.embed(query)
        except Exception:
            query_vec = []
        if not query_vec:
            return []

        results = await self._pgvector_search(query_vec, user_id, top_k, min_score)
        if results:
            return results

        return await self._in_memory_search(query_vec, user_id, top_k, min_score)

    async def _pgvector_search(
        self,
        query_vec: List[float],
        user_id: str,
        top_k: int,
        min_score: float,
    ) -> List[dict]:
        try:
            vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"
            sql = text("""
                SELECT id, key, value, context, memory_type, importance,
                       1 - (embedding_vector <=> :query_vec::vector) AS similarity
                FROM financial_memories
                WHERE user_id = :user_id
                  AND embedding_vector IS NOT NULL
                  AND 1 - (embedding_vector <=> :query_vec::vector) >= :min_score
                ORDER BY similarity DESC
                LIMIT :top_k
            """)
            result = await self.db.execute(
                sql,
                {"query_vec": vec_str, "user_id": user_id, "top_k": top_k, "min_score": min_score},
            )
            rows = result.all()
            return [
                {
                    "id": r.id,
                    "key": r.key,
                    "value": r.value,
                    "context": r.context,
                    "memory_type": r.memory_type,
                    "importance": r.importance,
                    "score": float(r.similarity),
                }
                for r in rows
            ]
        except Exception:
            return []

    async def _in_memory_search(
        self,
        query_vec: List[float],
        user_id: str,
        top_k: int,
        min_score: float,
    ) -> List[dict]:
        result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.user_id == user_id,
                FinancialMemory.embedding.isnot(None),
            )
        )
        memories = result.scalars().all()

        scored = []
        for mem in memories:
            if not mem.embedding:
                continue
            score = EmbeddingService.cosine_similarity(query_vec, mem.embedding)
            if score >= min_score:
                scored.append({
                    "id": mem.id,
                    "key": mem.key,
                    "value": mem.value,
                    "context": mem.context,
                    "memory_type": mem.memory_type,
                    "importance": mem.importance,
                    "score": score,
                })

        scored.sort(key=lambda x: (x["score"], x["importance"]), reverse=True)
        return scored[:top_k]

    async def hybrid_search(
        self,
        query: str,
        user_id: str,
        top_k: int = 5,
    ) -> List[dict]:
        semantic = await self.retrieve(query, user_id, top_k, min_score=0.0)
        seen_ids = {r["id"] for r in semantic}

        keyword_result = await self.db.execute(
            select(FinancialMemory).where(
                FinancialMemory.user_id == user_id,
                or_(
                    FinancialMemory.value.ilike(f"%{query}%"),
                    FinancialMemory.context.ilike(f"%{query}%"),
                ),
            ).order_by(FinancialMemory.importance.desc()).limit(top_k)
        )
        keyword_rows = keyword_result.scalars().all()

        for mem in keyword_rows:
            if mem.id not in seen_ids:
                semantic.append({
                    "id": mem.id,
                    "key": mem.key,
                    "value": mem.value,
                    "context": mem.context,
                    "memory_type": mem.memory_type,
                    "importance": mem.importance,
                    "score": 0.5,
                })

        semantic.sort(key=lambda x: (x["score"], x["importance"]), reverse=True)
        return semantic[:top_k]

    def format_context(self, results: List[dict]) -> str:
        if not results:
            return ""
        parts = ["Relevant information from your financial history:"]
        for r in results:
            label = r.get("key", r.get("memory_type", "note"))
            val = r.get("value", "")
            if len(val) > 500:
                val = val[:500] + "..."
            parts.append(f"- [{label}]: {val}")
        return "\n".join(parts)
