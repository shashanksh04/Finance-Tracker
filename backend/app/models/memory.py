import uuid
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from pgvector.sqlalchemy import Vector


class FinancialMemory(Base):
    __tablename__ = "financial_memories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    embedding = Column(JSON, nullable=True)
    embedding_vector = Column(Vector(1024), nullable=True)
    memory_type = Column(String, nullable=False)
    importance = Column(Float, default=0.5)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="memories")
