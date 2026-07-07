import uuid
from sqlalchemy import Column, String, DateTime, Numeric, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Numeric(14, 2), nullable=False)
    current_amount = Column(Numeric(14, 2), default=0)
    deadline = Column(Date, nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    icon = Column(String, nullable=True)
    color = Column(String, nullable=True)
    status = Column(String, default="active")
    monthly_contribution = Column(Numeric, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="goals")
    category = relationship("Category", back_populates="goals")
