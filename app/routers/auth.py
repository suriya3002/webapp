from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, Token, UserResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.connection_manager import manager

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if username or email already exists
    existing_username = await db.execute(select(User).where(User.username == user_in.username.strip()))
    if existing_username.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )

    existing_email = await db.execute(select(User).where(User.email == user_in.email.strip().lower()))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )

    display_name = user_in.display_name.strip() if user_in.display_name else user_in.username.strip()
    avatar_color = user_in.avatar_color or "#6366f1"

    new_user = User(
        username=user_in.username.strip(),
        email=user_in.email.strip().lower(),
        hashed_password=hash_password(user_in.password),
        display_name=display_name,
        avatar_color=avatar_color
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(data={"sub": str(new_user.id), "username": new_user.username})
    is_online = manager.is_user_online(new_user.id)

    return Token(
        access_token=token,
        token_type="bearer",
        user=new_user.to_dict(is_online=is_online)
    )

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    identifier = credentials.username.strip()
    # Support login with either username or email
    result = await db.execute(
        select(User).where((User.username == identifier) | (User.email == identifier.lower()))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_access_token(data={"sub": str(user.id), "username": user.username})
    is_online = manager.is_user_online(user.id)

    return Token(
        access_token=token,
        token_type="bearer",
        user=user.to_dict(is_online=is_online)
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    is_online = manager.is_user_online(current_user.id)
    return UserResponse(**current_user.to_dict(is_online=is_online))

@router.post("/demo-login/{username}", response_model=Token)
async def demo_login(username: str, db: AsyncSession = Depends(get_db)):
    """Fast login helper for demo accounts to easily test multi-user real-time chat."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found")

    token = create_access_token(data={"sub": str(user.id), "username": user.username})
    is_online = manager.is_user_online(user.id)
    return Token(
        access_token=token,
        token_type="bearer",
        user=user.to_dict(is_online=is_online)
    )
