from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.category import Category
from app.models.alert import AlertPreference
from app.models.account import Account
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.schemas.auth import UserCreate, UserLogin
from fastapi import HTTPException, status

DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Food & Dining", "icon": "🍔", "color": "#ef4444", "sort_order": 1},
    {"name": "Transportation", "icon": "🚗", "color": "#f59e0b", "sort_order": 2},
    {"name": "Shopping", "icon": "🛍️", "color": "#ec4899", "sort_order": 3},
    {"name": "Bills & Utilities", "icon": "📄", "color": "#8b5cf6", "sort_order": 4},
    {"name": "Rent", "icon": "🏠", "color": "#6366f1", "sort_order": 5},
    {"name": "Healthcare", "icon": "🏥", "color": "#06b6d4", "sort_order": 6},
    {"name": "Entertainment", "icon": "🎬", "color": "#14b8a6", "sort_order": 7},
    {"name": "Education", "icon": "📚", "color": "#0ea5e9", "sort_order": 8},
    {"name": "Groceries", "icon": "🛒", "color": "#10b981", "sort_order": 9},
    {"name": "Subscriptions", "icon": "📋", "color": "#f97316", "sort_order": 10},
]

DEFAULT_INCOME_CATEGORIES = [
    {"name": "Salary", "icon": "💰", "color": "#10b981", "sort_order": 1},
    {"name": "Freelance", "icon": "💻", "color": "#0ea5e9", "sort_order": 2},
    {"name": "Investments", "icon": "📈", "color": "#8b5cf6", "sort_order": 3},
    {"name": "Business", "icon": "🏢", "color": "#6366f1", "sort_order": 4},
    {"name": "Gifts", "icon": "🎁", "color": "#ec4899", "sort_order": 5},
    {"name": "Refunds", "icon": "↩️", "color": "#14b8a6", "sort_order": 6},
    {"name": "Rental Income", "icon": "🏘️", "color": "#f59e0b", "sort_order": 7},
    {"name": "Other Income", "icon": "💵", "color": "#06b6d4", "sort_order": 8},
]


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: UserCreate) -> dict:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            full_name=data.full_name,
            settings={"currency": "INR"},
        )
        self.db.add(user)
        await self.db.flush()

        await self._seed_default_categories(user.id)
        await self._seed_default_account(user.id)
        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    async def _seed_default_categories(self, user_id: str):
        for cat in DEFAULT_EXPENSE_CATEGORIES:
            self.db.add(Category(user_id=user_id, type="expense", **cat))
        for cat in DEFAULT_INCOME_CATEGORIES:
            self.db.add(Category(user_id=user_id, type="income", **cat))
        await self.db.flush()

    async def _seed_default_account(self, user_id: str):
        account = Account(user_id=user_id, name="Cash", type="cash", balance=0, currency="INR")
        self.db.add(account)
        await self.db.flush()

    async def login(self, data: UserLogin) -> dict:
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
            "token_type": "bearer",
        }

    async def refresh_token(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        if not payload or payload.type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        return {
            "access_token": create_access_token(payload.sub),
            "refresh_token": create_refresh_token(payload.sub),
            "token_type": "bearer",
        }

    async def get_profile(self, user_id: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def update_profile(self, user_id: str, data) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.settings is not None:
            if user.settings is None:
                user.settings = {}
            user.settings.update(data.settings)
        await self.db.flush()
        return user

    async def complete_onboarding(self, user_id: str) -> User:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.onboarding_completed = True
        await self.db.flush()
        return user

    async def change_password(self, user_id: str, current_password: str, new_password: str) -> bool:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        user.password_hash = hash_password(new_password)
        await self.db.flush()
        return True
