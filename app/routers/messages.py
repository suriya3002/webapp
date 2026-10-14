from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Message, User
from app.schemas import MessageResponse, MessageCreate
from app.auth import get_current_user
from app.connection_manager import manager

router = APIRouter(prefix="/api/messages", tags=["Messages"])

@router.get("/direct/{other_user_id}", response_model=List[MessageResponse])
async def get_direct_messages(
    other_user_id: int,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve 1-to-1 message history between the current user and another user."""
    # Verify other user exists
    other_res = await db.execute(select(User).where(User.id == other_user_id))
    other_user = other_res.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch messages where (sender == me and recipient == other) OR (sender == other and recipient == me)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.recipient_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.recipient_id == current_user.id),
            )
        )
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()

    # Mark unread messages sent by the other user to current user as read
    await db.execute(
        update(Message)
        .where(Message.sender_id == other_user_id, Message.recipient_id == current_user.id, Message.is_read == False)
        .values(is_read=True)
    )
    await db.commit()

    return [MessageResponse(**msg.to_dict()) for msg in messages]

@router.post("/direct/{other_user_id}", response_model=MessageResponse)
async def post_direct_message(
    other_user_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a direct message to another user."""
    other_res = await db.execute(select(User).where(User.id == other_user_id))
    other_user = other_res.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_msg = Message(
        sender_id=current_user.id,
        recipient_id=other_user_id,
        content=msg_in.content.strip()
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)

    # Re-fetch with sender relationship
    res = await db.execute(
        select(Message).options(selectinload(Message.sender)).where(Message.id == new_msg.id)
    )
    full_msg = res.scalar_one()
    msg_dict = full_msg.to_dict()

    # Deliver real-time via WebSocket to recipient and sender
    await manager.send_direct_message(
        sender_id=current_user.id,
        recipient_id=other_user_id,
        message={
            "type": "direct_message",
            "message": msg_dict
        }
    )

    return MessageResponse(**msg_dict)
