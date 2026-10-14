from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Message, User
from app.schemas import MessageResponse, MessageCreate, MessageUpdate
from app.auth import get_current_user
from app.connection_manager import manager
from datetime import datetime, timezone

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

    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a private conversation with yourself")

    # Fetch messages where (sender == me and recipient == other) OR (sender == other and recipient == me)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            Message.room_id.is_(None),
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
        .where(Message.room_id.is_(None), Message.sender_id == other_user_id, Message.recipient_id == current_user.id, Message.is_read == False)
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
    """Send a private direct message to another user."""
    other_res = await db.execute(select(User).where(User.id == other_user_id))
    other_user = other_res.scalar_one_or_none()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")

    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send a private message to yourself")

    new_msg = Message(
        sender_id=current_user.id,
        recipient_id=other_user_id,
        room_id=None,
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
 
@router.put("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: int,
    msg_update: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit a message. Only the author of the message is authorized to edit it."""
    res = await db.execute(
        select(Message).options(selectinload(Message.sender)).where(Message.id == message_id)
    )
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied: You can only edit your own messages")

    new_content = msg_update.content.strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    message.content = new_content
    message.is_edited = True
    message.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(message)

    msg_dict = message.to_dict()

    # Broadcast real-time edit event
    if message.room_id:
        await manager.broadcast_to_room(message.room_id, {
            "type": "message_edited",
            "message": msg_dict
        })
    elif message.recipient_id:
        await manager.send_direct_message(
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            message={
                "type": "message_edited",
                "message": msg_dict
            }
        )

    return MessageResponse(**msg_dict)


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a message. Only the author of the message is authorized to delete it."""
    res = await db.execute(select(Message).where(Message.id == message_id))
    message = res.scalar_one_or_none()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied: You can only delete your own messages")

    msg_id = message.id
    room_id = message.room_id
    recipient_id = message.recipient_id
    sender_id = message.sender_id

    await db.delete(message)
    await db.commit()

    # Broadcast real-time deletion event
    if room_id:
        await manager.broadcast_to_room(room_id, {
            "type": "message_deleted",
            "message_id": msg_id,
            "room_id": room_id
        })
    elif recipient_id:
        await manager.send_direct_message(
            sender_id=sender_id,
            recipient_id=recipient_id,
            message={
                "type": "message_deleted",
                "message_id": msg_id,
                "sender_id": sender_id,
                "recipient_id": recipient_id
            }
        )

    return {"detail": "Message deleted successfully", "message_id": msg_id}
