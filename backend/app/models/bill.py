import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Bill(Base):
    __tablename__ = "bills"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    due_date = Column(Date, nullable=False)
    file_path = Column(String, nullable=True)
    ocr_text = Column(Text, nullable=True)
    is_paid = Column(Boolean, default=False)
    paid_date = Column(Date, nullable=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    recurring_id = Column(String(36), ForeignKey("recurring_transactions.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="bills")
    category = relationship("Category", back_populates="bills")
    recurring = relationship("RecurringTransaction", back_populates="bills")
    transactions = relationship("Transaction", back_populates="bill")
