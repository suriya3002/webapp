# PulseChat — Real-Time Group & 1-to-1 Web Chat Application

A high-performance real-time messaging web application featuring **Group Rooms**, **1-to-1 Private Direct Messaging**, **Live Online Presence Tracking**, and **Persistent Message History**.

Built with **Python**, **FastAPI**, **WebSockets**, and **PostgreSQL / SQLAlchemy** with a modern, glassmorphic UI.

---

## 🌟 Key Features

1. **User Authentication & Profiles**
   - User registration & login with secure password hashing via `bcrypt`.
   - Stateless authentication using JSON Web Tokens (JWT).
   - Pre-seeded demo user accounts (**Alice Johnson**, **Bob Smith**, **Charlie Davis**) for instant multi-user testing in multiple browser tabs or windows with 1-click.
   - Customizable avatar colors, display names, and bio.

2. **Group Rooms (Channels)**
   - Create custom rooms with channel names, descriptions, and custom icons (`#general`, `#tech-talk`, `#random`, `#announcements`, etc.).
   - Instant room broadcasting via WebSockets to all connected participants.
   - Unread badges for channels that receive messages while you are in a different conversation.

3. **Private 1-to-1 Conversations**
   - Direct messaging between any two registered users.
   - Real-time routing directly to recipient's active devices and sync across sender's tabs.
   - Instant unread indicators and gentle audio chime on incoming private messages.

4. **Live Online Presence (Who is Online)**
   - Real-time connection presence tracked through active WebSocket connections.
   - Glowing emerald green presence indicators for online users; gray indicators for offline users.
   - Live broadcast of user status events (`user_status`: online/offline) when users join or disconnect.

5. **Persistent History**
   - Every single group message and private direct message is committed to PostgreSQL / SQLite.
   - Full conversation history is retrieved upon page reload, room switching, or later login.
   - Chronological date dividers ("Today", "Yesterday", etc.) and timestamps.

6. **Rich Interactive UI & Aesthetics**
   - Sleek dark theme with glassmorphism, Google Fonts (`Inter` and `Outfit`), and micro-animations.
   - Typing indicator wave ("Alice is typing... •••").
   - Quick Emoji selector.
   - Right-side drawer displaying channel member rosters and user profiles.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Python 3, [FastAPI](https://fastapi.tiangolo.com/), Starlette WebSockets, Pydantic v2
- **Database ORM**: [SQLAlchemy 2.0 (Async)](https://www.sqlalchemy.org/) with `asyncpg` and `psycopg2-binary` for **PostgreSQL**, with seamless `aiosqlite` zero-config local fallback
- **Security**: `bcrypt` password hashing, `pyjwt` HMAC-SHA256 tokens
- **Frontend**: Responsive Semantic HTML5, Vanilla CSS3 (glassmorphic styling, CSS variables), Vanilla JavaScript (WebSockets client, Fetch API client, audio feedback via Web Audio API)

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+ (tested on Python 3.14)
- (Optional) PostgreSQL database server

### 2. Environment Setup
The virtual environment and dependencies are already installed in `venv`. If configuring on a new machine:

```powershell
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
```

### 3. Database Configuration
Edit [`.env`](file:///c:/Users/HAI/Desktop/webapp/.env):

#### For PostgreSQL:
```env
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/chat_app
SECRET_KEY=your_secure_random_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

#### For Zero-Configuration Local SQLite (default):
```env
DATABASE_URL=sqlite+aiosqlite:///./chat.db
```

> **Note**: The application automatically creates all necessary tables (`users`, `rooms`, `room_members`, `messages`) and seeds initial default rooms and demo accounts on startup. If a configured PostgreSQL instance is unreachable, it automatically falls back to local SQLite so your app never fails to start.

### 4. Running the Application

Start the FastAPI application with Uvicorn:

```powershell
.\venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser at:
👉 **`http://127.0.0.1:8000`**

---

## 👥 Testing Real-Time Multi-User Chat

To test real-time interactions:
1. Open `http://127.0.0.1:8000` in a normal browser window.
2. Click the **Alice** demo chip to sign in instantly as Alice Johnson.
3. Open a second **Incognito / Private Window** (or a different browser like Edge/Firefox) at `http://127.0.0.1:8000`.
4. Click the **Bob** demo chip to sign in as Bob Smith.
5. Notice:
   - Alice immediately sees Bob's status dot turn **🟢 Online**.
   - Send a message from Bob in `#general` -> Alice sees it appear in real-time.
   - Click Bob in Alice's direct messages list and send a private message -> Bob receives it in real-time with unread notifications.
   - Refresh either browser window -> full message history is loaded from the database.

---

## 🧪 Running Automated Tests

Run the test suite to verify all endpoints, database persistence, and WebSocket presence:

```powershell
# Run REST & Database Persistence Integration Tests
.\venv\Scripts\python test_app.py

# Run Live WebSocket Presence & Messaging Tests
.\venv\Scripts\python test_ws_live.py
```

---

## 📡 API & WebSocket Reference

### REST Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user account |
| `POST` | `/api/auth/login` | Login with username/email & password |
| `POST` | `/api/auth/demo-login/{username}` | Fast login for demo accounts |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/users` | List all users with real-time `is_online` status |
| `GET` | `/api/rooms` | List all group rooms with member counts |
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/rooms/{room_id}/messages` | Retrieve persistent room message history |
| `GET` | `/api/messages/direct/{user_id}` | Retrieve persistent 1-to-1 conversation history |

### WebSocket Endpoint: `/ws?token=<JWT_TOKEN>`
| Inbound Action | Payload | Description |
|---|---|---|
| `send_room_message` | `{"room_id": 1, "content": "Hello"}` | Broadcast message to room and persist |
| `send_direct_message` | `{"recipient_id": 2, "content": "Hi"}` | Deliver 1-to-1 private message and persist |
| `typing` | `{"room_id": 1, "is_typing": true}` | Transmit real-time typing indicator |
| `ping` | `{}` | Heartbeat check |
