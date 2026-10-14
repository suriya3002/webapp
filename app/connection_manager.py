import json
import logging
from typing import Dict, Set, Optional, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # user_id -> set of active WebSockets (supports multiple tabs)
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        # websocket -> user_id mapping for quick lookup on disconnect
        self.socket_user_map: Dict[WebSocket, int] = {}
        # websocket -> current active room_id (optional tracking)
        self.socket_room_map: Dict[WebSocket, Optional[int]] = {}

    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

    def get_online_user_ids(self) -> Set[int]:
        return {uid for uid, sockets in self.user_connections.items() if len(sockets) > 0}

    async def connect(self, websocket: WebSocket, user_id: int, user_data: dict) -> bool:
        await websocket.accept()
        is_first_connection = False

        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
            is_first_connection = True

        self.user_connections[user_id].add(websocket)
        self.socket_user_map[websocket] = user_id
        self.socket_room_map[websocket] = None

        logger.info(f"User {user_id} connected. Active connections for user: {len(self.user_connections[user_id])}")

        # Send initial state to the connecting client: list of currently online user IDs
        await websocket.send_text(json.dumps({
            "type": "init_presence",
            "online_user_ids": list(self.get_online_user_ids())
        }))

        # If this is the user's first connection, notify everyone else that they are now online
        if is_first_connection:
            await self.broadcast({
                "type": "user_status",
                "user_id": user_id,
                "username": user_data.get("username"),
                "display_name": user_data.get("display_name"),
                "is_online": True
            }, exclude_user_id=user_id)

        return is_first_connection

    async def disconnect(self, websocket: WebSocket) -> Optional[int]:
        user_id = self.socket_user_map.pop(websocket, None)
        self.socket_room_map.pop(websocket, None)

        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if len(self.user_connections[user_id]) == 0:
                del self.user_connections[user_id]
                logger.info(f"User {user_id} disconnected (no remaining connections).")
                # Broadcast that user went offline
                await self.broadcast({
                    "type": "user_status",
                    "user_id": user_id,
                    "is_online": False
                })
                return user_id

        return None

    def set_current_room(self, websocket: WebSocket, room_id: Optional[int]):
        if websocket in self.socket_room_map:
            self.socket_room_map[websocket] = room_id

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")

    async def send_to_user(self, user_id: int, message: dict):
        """Send a message to all active sockets of a specific user."""
        if user_id in self.user_connections:
            sockets = list(self.user_connections[user_id])
            for ws in sockets:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Error sending to user {user_id}: {e}")
                    self.user_connections[user_id].discard(ws)

    async def broadcast(self, message: dict, exclude_user_id: Optional[int] = None):
        """Broadcast message to all connected clients across the entire app."""
        payload = json.dumps(message)
        for uid, sockets in list(self.user_connections.items()):
            if exclude_user_id is not None and uid == exclude_user_id:
                continue
            for ws in list(sockets):
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning(f"Error broadcasting to socket: {e}")

    async def broadcast_to_room(self, room_id: int, message: dict):
        """Broadcast room message to all connected users so channels update in real-time."""
        await self.broadcast(message)

    async def send_direct_message(self, sender_id: int, recipient_id: int, message: dict):
        """Send real-time direct message to both the recipient and sender's active devices."""
        # Send to recipient
        await self.send_to_user(recipient_id, message)
        # Send to sender (to sync across any other open tabs the sender has)
        await self.send_to_user(sender_id, message)

manager = ConnectionManager()
