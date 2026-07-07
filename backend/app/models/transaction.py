import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id = Column(String(36), ForeignKey("accounts.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    merchant = Column(String, nullable=True)
    date = Column(DateTime, nullable=False)
    is_recurring = Column(Boolean, default=False)
    recurring_id = Column(String(36), ForeignKey("recurring_transactions.id"), nullable=True)
    bill_id = Column(String(36), ForeignKey("bills.id"), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    is_split = Column(Boolean, default=False)
    parent_split_id = Column(String(36), ForeignKey("transactions.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    recurring = relationship("RecurringTransaction", back_populates="transactions")
    bill = relationship("Bill", back_populates="transactions")
    parent_split = relationship("Transaction", back_populates="child_splits", remote_side="Transaction.id")
    child_splits = relationship("Transaction", back_populates="parent_split")
