from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    display_name: Optional[str] = None
    avatar_color: Optional[str] = "#6366f1"

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    display_name: str
    avatar_color: str
    bio: Optional[str] = ""
    is_online: bool = False
    last_seen: Optional[str] = None

class RoomCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = ""
    icon: Optional[str] = "💬"
    is_private: Optional[bool] = False

class RoomResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "💬"
    is_private: bool = False
    created_by_id: Optional[int] = None
    created_at: Optional[str] = None
    member_count: int = 0
    unread_count: Optional[int] = 0

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    room_id: Optional[int] = None
    recipient_id: Optional[int] = None
    reply_to_id: Optional[int] = None

class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)

class ReactionToggleRequest(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=32)

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_username: str
    sender_display_name: str
    sender_avatar_color: str
    room_id: Optional[int] = None
    recipient_id: Optional[int] = None
    content: str
    created_at: str
    updated_at: Optional[str] = None
    is_read: bool = False
    is_edited: Optional[bool] = False
    reply_to_id: Optional[int] = None
    reply_to: Optional[dict] = None
    reactions: Optional[List[dict]] = []

class OnlineStatusEvent(BaseModel):
    user_id: int
    username: str
    is_online: bool

