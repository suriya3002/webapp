from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User
from app.schemas import UserResponse
from app.auth import get_current_user
from app.connection_manager import manager

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all registered users with their current online presence status."""
    result = await db.execute(select(User).order_by(User.display_name.asc()))
    users = result.scalars().all()
    
    user_list = []
    for u in users:
        is_online = manager.is_user_online(u.id)
        # Mark current user as online since they are requesting the endpoint
        if u.id == current_user.id:
            is_online = True
        user_list.append(UserResponse(**u.to_dict(is_online=is_online)))
    
    return user_list

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_online = manager.is_user_online(user.id)
    return UserResponse(**user.to_dict(is_online=is_online))
