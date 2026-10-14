from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Room, RoomMember, Message, User
from app.schemas import RoomCreate, RoomResponse, MessageResponse, MessageCreate
from app.auth import get_current_user
from app.connection_manager import manager

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

@router.get("", response_model=List[RoomResponse])
async def list_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Room).order_by(Room.id.asc()))
    rooms = result.scalars().all()
    
    room_list = []
    for room in rooms:
        # Get member count
        member_res = await db.execute(select(RoomMember).where(RoomMember.room_id == room.id))
        members = member_res.scalars().all()
        room_list.append(RoomResponse(**room.to_dict(member_count=len(members))))
    return room_list

@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_in: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    name_clean = room_in.name.strip().lower().replace(" ", "-")
    existing = await db.execute(select(Room).where(Room.name == name_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Room '#{name_clean}' already exists"
        )
    
    new_room = Room(
        name=name_clean,
        description=room_in.description.strip() if room_in.description else "",
        icon=room_in.icon or "💬",
        is_private=bool(room_in.is_private),
        created_by_id=current_user.id
    )
    db.add(new_room)
    await db.commit()
    await db.refresh(new_room)

    # Add creator as room member
    membership = RoomMember(room_id=new_room.id, user_id=current_user.id)
    db.add(membership)
    await db.commit()

    room_data = new_room.to_dict(member_count=1)

    # Broadcast new room creation to all online clients
    await manager.broadcast({
        "type": "new_room_created",
        "room": room_data
    })

    return RoomResponse(**room_data)

@router.get("/{room_id}/messages", response_model=List[MessageResponse])
async def get_room_messages(
    room_id: int,
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify room exists
    room_res = await db.execute(select(Room).where(Room.id == room_id))
    room = room_res.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return [MessageResponse(**msg.to_dict()) for msg in messages]

@router.post("/{room_id}/messages", response_model=MessageResponse)
async def post_room_message(
    room_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    room_res = await db.execute(select(Room).where(Room.id == room_id))
    room = room_res.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    new_msg = Message(
        sender_id=current_user.id,
        room_id=room_id,
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

    # Broadcast to all connected clients
    await manager.broadcast_to_room(room_id, {
        "type": "room_message",
        "message": msg_dict
    })

    return MessageResponse(**msg_dict)
