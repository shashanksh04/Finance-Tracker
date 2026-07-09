import uuid
from sqlalchemy import Column, String, Boolean, DateTime, JSON, text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False, server_default=text("false"))
    is_verified = Column(Boolean, default=False)
    onboarding_completed = Column(Boolean, default=False, server_default=text("false"))
    settings = Column(JSON, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    accounts = relationship("Account", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    budgets = relationship("Budget", back_populates="user")
    categories = relationship("Category", back_populates="user")
    goals = relationship("Goal", back_populates="user")
    alerts = relationship("Alert", back_populates="user")
    memories = relationship("FinancialMemory", back_populates="user")
    bills = relationship("Bill", back_populates="user")
    recurring_transactions = relationship("RecurringTransaction", back_populates="user")
    rules = relationship("CategoryRule", back_populates="user")
    alert_preferences = relationship("AlertPreference", back_populates="user")
