import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, nullable=False)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True)
    related_amount = Column(Numeric, nullable=True)
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="alerts")
    category = relationship("Category", back_populates="alerts")


class AlertPreference(Base):
    __tablename__ = "alert_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    alert_type = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    threshold = Column(Numeric, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="alert_preferences")
