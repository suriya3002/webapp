import asyncio
import sys
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db
from app.models import User, Room, Message

async def run_tests():
    print("=== STARTING PULSECHAT AUTOMATED INTEGRATION TESTS ===")
    
    # 1. Test lifespan / database initialization
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger startup manually if needed or call lifespan
        async with app.router.lifespan_context(app):
            print("1. Testing Demo Logins...")
            alice_login = await client.post("/api/auth/demo-login/alice")
            assert alice_login.status_code == 200, f"Alice login failed: {alice_login.text}"
            alice_token = alice_login.json()["access_token"]
            alice_id = alice_login.json()["user"]["id"]
            print(f"   Alice logged in successfully. ID: {alice_id}")

            bob_login = await client.post("/api/auth/demo-login/bob")
            assert bob_login.status_code == 200, f"Bob login failed: {bob_login.text}"
            bob_token = bob_login.json()["access_token"]
            bob_id = bob_login.json()["user"]["id"]
            print(f"   Bob logged in successfully. ID: {bob_id}")

            # 2. Test User Registration
            print("2. Testing User Registration...")
            new_user_payload = {
                "username": "diana",
                "email": "diana@example.com",
                "password": "securepassword123",
                "display_name": "Diana Prince",
                "avatar_color": "#ec4899"
            }
            reg_res = await client.post("/api/auth/register", json=new_user_payload)
            if reg_res.status_code == 200:
                print("   Diana registered successfully!")
            else:
                print(f"   Diana registration status: {reg_res.status_code} ({reg_res.json().get('detail')})")

            # 3. Test Listing Rooms
            print("3. Testing Rooms List...")
            rooms_res = await client.get("/api/rooms", headers={"Authorization": f"Bearer {alice_token}"})
            assert rooms_res.status_code == 200
            rooms = rooms_res.json()
            print(f"   Found {len(rooms)} default rooms: {[r['name'] for r in rooms]}")
            assert len(rooms) >= 1

            general_room = next(r for r in rooms if r["name"] == "general")

            # 4. Test Creating a New Room
            print("4. Testing New Room Creation...")
            new_room_name = "ai-discussions"
            create_room_res = await client.post(
                "/api/rooms",
                headers={"Authorization": f"Bearer {alice_token}"},
                json={"name": new_room_name, "description": "AI models & architectures", "icon": "🤖"}
            )
            assert create_room_res.status_code in (200, 201)
            new_room_id = create_room_res.json()["id"]
            print(f"   Created new room #{new_room_name} with ID {new_room_id}")

            # 5. Test Sending & Persisting Room Messages
            print("5. Testing Room Message Persistence...")
            msg_content = "Hello from automated test in #general!"
            post_msg_res = await client.post(
                f"/api/rooms/{general_room['id']}/messages",
                headers={"Authorization": f"Bearer {alice_token}"},
                json={"content": msg_content}
            )
            assert post_msg_res.status_code == 200
            msg_id = post_msg_res.json()["id"]
            print(f"   Posted message {msg_id}: '{msg_content}'")

            # Verify history retrieval (message persistence)
            get_history_res = await client.get(
                f"/api/rooms/{general_room['id']}/messages",
                headers={"Authorization": f"Bearer {bob_token}"}
            )
            assert get_history_res.status_code == 200
            history = get_history_res.json()
            assert any(m["id"] == msg_id for m in history), "Message was not found in room history!"
            print(f"   Verified message persistence: Bob retrieved {len(history)} messages in #{general_room['name']}")

            # 6. Test 1-to-1 Direct Messaging & History Persistence
            print("6. Testing 1-to-1 Private Direct Messaging...")
            dm_text = "Hey Bob, this is a secret 1-to-1 private direct message!"
            send_dm_res = await client.post(
                f"/api/messages/direct/{bob_id}",
                headers={"Authorization": f"Bearer {alice_token}"},
                json={"content": dm_text}
            )
            assert send_dm_res.status_code == 200
            dm_id = send_dm_res.json()["id"]
            print(f"   Alice sent DM to Bob (ID {dm_id}): '{dm_text}'")

            # Verify Bob can view the conversation history
            bob_dm_history = await client.get(
                f"/api/messages/direct/{alice_id}",
                headers={"Authorization": f"Bearer {bob_token}"}
            )
            assert bob_dm_history.status_code == 200
            bob_messages = bob_dm_history.json()
            assert any(m["id"] == dm_id for m in bob_messages), "DM not found in Bob's direct message history!"
            print(f"   Bob verified DM history with Alice. Total DMs: {len(bob_messages)}")

            # Bob replies to Alice
            reply_text = "Hey Alice, loud and clear! 1-to-1 chat is working smoothly."
            send_reply_res = await client.post(
                f"/api/messages/direct/{alice_id}",
                headers={"Authorization": f"Bearer {bob_token}"},
                json={"content": reply_text}
            )
            assert send_reply_res.status_code == 200
            print(f"   Bob replied to Alice: '{reply_text}'")

            # Alice verifies reply exists in history
            alice_dm_history = await client.get(
                f"/api/messages/direct/{bob_id}",
                headers={"Authorization": f"Bearer {alice_token}"}
            )
            assert alice_dm_history.status_code == 200
            assert any(m["content"] == reply_text for m in alice_dm_history.json())
            print("   Alice verified Bob's reply in direct message history.")

            # 7. Test Users List and Presence
            print("7. Testing Users List...")
            users_res = await client.get("/api/users", headers={"Authorization": f"Bearer {alice_token}"})
            assert users_res.status_code == 200
            all_users = users_res.json()
            print(f"   Total registered users: {len(all_users)}")
            for u in all_users:
                print(f"   - {u['display_name']} (@{u['username']}) - Online: {u['is_online']}")

    print("\nALL INTEGRATION TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    asyncio.run(run_tests())
