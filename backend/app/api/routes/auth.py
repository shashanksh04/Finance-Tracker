from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.database import get_db
from app.api.deps import get_current_user, security_scheme
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, TokenResponse, TokenRefresh, UserResponse, ChangePassword, UpdateProfile
from app.services.auth_service import AuthService
from app.core.security import decode_token, blacklist_token
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.refresh_token(data.refresh_token)


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    payload = decode_token(credentials.credentials)
    if payload:
        await blacklist_token(payload.jti, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/profile", response_model=UserResponse)
async def update_profile(data: UpdateProfile, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.update_profile(user.id, data)


@router.post("/change-password")
async def change_password(data: ChangePassword, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.change_password(user.id, data.current_password, data.new_password)


@router.patch("/onboarding", response_model=UserResponse)
async def complete_onboarding(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.complete_onboarding(user.id)
