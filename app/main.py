import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.models import User, Room, RoomMember, Message
from app.auth import decode_access_token, hash_password
from app.connection_manager import manager
from app.routers import auth, users, rooms, messages

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("chat_app")

BASE_DIR = Path(__file__).resolve().parent.parent

async def seed_initial_data():
    """Seed initial rooms and demo users for testing real-time multi-user conversations."""
    async with AsyncSessionLocal() as db:
        # Check if users already exist
        res = await db.execute(select(User).limit(1))
        existing_user = res.scalar_one_or_none()
        
        demo_users = []
        if not existing_user:
            logger.info("Seeding demo users...")
            demo_user_configs = [
                {"username": "alice", "email": "alice@example.com", "display_name": "Alice Johnson", "avatar_color": "#8b5cf6", "bio": "Frontend enthusiast & UI designer"},
                {"username": "bob", "email": "bob@example.com", "display_name": "Bob Smith", "avatar_color": "#06b6d4", "bio": "Backend architect & Python lover"},
                {"username": "charlie", "email": "charlie@example.com", "display_name": "Charlie Davis", "avatar_color": "#10b981", "bio": "Full-stack dev & open-source contributor"}
            ]
            for conf in demo_user_configs:
                u = User(
                    username=conf["username"],
                    email=conf["email"],
                    hashed_password=hash_password("password123"),
                    display_name=conf["display_name"],
                    avatar_color=conf["avatar_color"],
                    bio=conf["bio"]
                )
                db.add(u)
                demo_users.append(u)
            await db.commit()
            for u in demo_users:
                await db.refresh(u)
        else:
            res_all = await db.execute(select(User))
            demo_users = list(res_all.scalars().all())

        # Check if default rooms exist
        res_room = await db.execute(select(Room).limit(1))
        if not res_room.scalar_one_or_none():
            logger.info("Seeding default rooms...")
            default_rooms = [
                {"name": "general", "description": "General discussions, welcome lounge & casual banter", "icon": "🌐"},
                {"name": "tech-talk", "description": "Code, architecture, Python, FastAPI & tech innovations", "icon": "💻"},
                {"name": "random", "description": "Memes, coffee breaks, music and interesting links", "icon": "🎲"},
                {"name": "announcements", "description": "Important updates and system releases", "icon": "📢"}
            ]
            creator_id = demo_users[0].id if demo_users else None
            for r_conf in default_rooms:
                r = Room(
                    name=r_conf["name"],
                    description=r_conf["description"],
                    icon=r_conf["icon"],
                    created_by_id=creator_id
                )
                db.add(r)
            await db.commit()

            # Seed a welcoming message in #general
            res_gen = await db.execute(select(Room).where(Room.name == "general"))
            gen_room = res_gen.scalar_one_or_none()
            if gen_room and demo_users:
                welcome_msg = Message(
                    sender_id=demo_users[0].id,
                    room_id=gen_room.id,
                    content="👋 Welcome everyone to the Real-Time Chat Application! Feel free to join rooms, create new ones, or chat 1-on-1 with anyone who is online."
                )
                db.add(welcome_msg)
                await db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Chat Application backend...")
    await init_db()
    await seed_initial_data()
    yield
    logger.info("Shutting down Chat Application backend...")

app = FastAPI(
    title="Real-Time Group & 1-to-1 Chat Application",
    description="Real-time multi-room & direct messaging web application built with FastAPI, WebSockets & persistent storage",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(rooms.router)
app.include_router(messages.router)

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Fetch user data for presence notification
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == user_id))
        user = res.scalar_one_or_none()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_dict = user.to_dict()

    await manager.connect(websocket, user_id, user_dict)

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                continue

            action = data.get("action")

            if action == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif action == "join_room":
                room_id = data.get("room_id")
                manager.set_current_room(websocket, room_id)

            elif action == "send_room_message":
                room_id = data.get("room_id")
                content = (data.get("content") or "").strip()
                if not content or not room_id:
                    continue

                async with AsyncSessionLocal() as db:
                    msg = Message(
                        sender_id=user_id,
                        room_id=room_id,
                        content=content
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)

                    res = await db.execute(
                        select(Message).options(selectinload(Message.sender)).where(Message.id == msg.id)
                    )
                    full_msg = res.scalar_one()
                    msg_dict = full_msg.to_dict()

                await manager.broadcast_to_room(room_id, {
                    "type": "room_message",
                    "message": msg_dict
                })

            elif action == "send_direct_message":
                try:
                    recipient_id = int(data.get("recipient_id"))
                except (ValueError, TypeError):
                    continue

                content = (data.get("content") or "").strip()
                if not content or not recipient_id or recipient_id == user_id:
                    continue

                async with AsyncSessionLocal() as db:
                    # Verify recipient exists for privacy protection
                    recip_res = await db.execute(select(User).where(User.id == recipient_id))
                    if not recip_res.scalar_one_or_none():
                        continue

                    msg = Message(
                        sender_id=user_id,
                        recipient_id=recipient_id,
                        room_id=None,
                        content=content
                    )
                    db.add(msg)
                    await db.commit()
                    await db.refresh(msg)

                    res = await db.execute(
                        select(Message).options(selectinload(Message.sender)).where(Message.id == msg.id)
                    )
                    full_msg = res.scalar_one()
                    msg_dict = full_msg.to_dict()

                # Deliver ONLY to recipient and sender for 1-to-1 privacy
                await manager.send_direct_message(
                    sender_id=user_id,
                    recipient_id=recipient_id,
                    message={
                        "type": "direct_message",
                        "message": msg_dict
                    }
                )

            elif action == "typing":
                # Handle typing indicator with privacy separation
                is_typing = bool(data.get("is_typing", True))
                target_room_id = data.get("room_id")
                target_recipient_id = data.get("recipient_id")

                try:
                    if target_recipient_id is not None:
                        target_recipient_id = int(target_recipient_id)
                except (ValueError, TypeError):
                    target_recipient_id = None

                try:
                    if target_room_id is not None:
                        target_room_id = int(target_room_id)
                except (ValueError, TypeError):
                    target_room_id = None

                typing_payload = {
                    "type": "user_typing",
                    "user_id": user_id,
                    "username": user_dict["username"],
                    "display_name": user_dict["display_name"],
                    "room_id": target_room_id,
                    "recipient_id": target_recipient_id,
                    "is_typing": is_typing
                }

                if target_room_id:
                    await manager.broadcast(typing_payload, exclude_user_id=user_id)
                elif target_recipient_id and target_recipient_id != user_id:
                    # In 1-on-1 private chat, deliver strictly to the peer user
                    await manager.send_to_user(target_recipient_id, typing_payload)

            elif action == "edit_message":
                try:
                    msg_id = int(data.get("message_id"))
                    new_content = (data.get("content") or "").strip()
                except (ValueError, TypeError):
                    continue

                if not msg_id or not new_content:
                    continue

                async with AsyncSessionLocal() as db:
                    res = await db.execute(
                        select(Message).options(selectinload(Message.sender)).where(Message.id == msg_id)
                    )
                    msg = res.scalar_one_or_none()
                    if msg and msg.sender_id == user_id:
                        from datetime import datetime, timezone
                        msg.content = new_content
                        msg.is_edited = True
                        msg.updated_at = datetime.now(timezone.utc)
                        await db.commit()
                        await db.refresh(msg)
                        msg_dict = msg.to_dict()

                        if msg.room_id:
                            await manager.broadcast_to_room(msg.room_id, {
                                "type": "message_edited",
                                "message": msg_dict
                            })
                        elif msg.recipient_id:
                            await manager.send_direct_message(
                                sender_id=msg.sender_id,
                                recipient_id=msg.recipient_id,
                                message={
                                    "type": "message_edited",
                                    "message": msg_dict
                                }
                            )

            elif action == "delete_message":
                try:
                    msg_id = int(data.get("message_id"))
                except (ValueError, TypeError):
                    continue

                if not msg_id:
                    continue

                async with AsyncSessionLocal() as db:
                    res = await db.execute(select(Message).where(Message.id == msg_id))
                    msg = res.scalar_one_or_none()
                    if msg and msg.sender_id == user_id:
                        del_id = msg.id
                        del_room_id = msg.room_id
                        del_recipient_id = msg.recipient_id
                        del_sender_id = msg.sender_id

                        await db.delete(msg)
                        await db.commit()

                        if del_room_id:
                            await manager.broadcast_to_room(del_room_id, {
                                "type": "message_deleted",
                                "message_id": del_id,
                                "room_id": del_room_id
                            })
                        elif del_recipient_id:
                            await manager.send_direct_message(
                                sender_id=del_sender_id,
                                recipient_id=del_recipient_id,
                                message={
                                    "type": "message_deleted",
                                    "message_id": del_id,
                                    "sender_id": del_sender_id,
                                    "recipient_id": del_recipient_id
                                }
                            )

    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await manager.disconnect(websocket)

# Static files and root entry
static_path = BASE_DIR / "static"
static_path.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

@app.get("/")
async def serve_index():
    index_file = static_path / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Chat App API is running. Create static/index.html to view the UI."}
