import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db

async def test_whatsapp_features():
    print("=== TESTING WHATSAPP-STYLE REACTIONS & QUOTED REPLIES ===")
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login Alice & Bob
        res_alice = await client.post("/api/auth/demo-login/alice")
        assert res_alice.status_code == 200
        alice_token = res_alice.json()["access_token"]
        alice_id = res_alice.json()["user"]["id"]

        res_bob = await client.post("/api/auth/demo-login/bob")
        assert res_bob.status_code == 200
        bob_token = res_bob.json()["access_token"]
        bob_id = res_bob.json()["user"]["id"]

        # 2. Alice sends a room message in #general (room 1)
        r_post = await client.post(
            "/api/rooms/1/messages",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"content": "Alice's original question for Bob: Are you ready?"}
        )
        assert r_post.status_code == 200
        orig_msg = r_post.json()
        orig_msg_id = orig_msg["id"]
        print(f"1. Alice posted original message {orig_msg_id}: '{orig_msg['content']}'")

        # 3. Bob reacts with ❤️ to Alice's message (WhatsApp-style reaction)
        r_react1 = await client.post(
            f"/api/messages/{orig_msg_id}/react",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={"emoji": "❤️"}
        )
        assert r_react1.status_code == 200
        react_data = r_react1.json()
        assert react_data["action"] == "added"
        assert len(react_data["reactions"]) == 1
        assert react_data["reactions"][0]["emoji"] == "❤️"
        assert react_data["reactions"][0]["count"] == 1
        print("2. Bob reacted with ❤️ -> Reaction successfully added to message, NOT sent as a message!")

        # 4. Alice also reacts with ❤️ to the same message
        r_react_alice = await client.post(
            f"/api/messages/{orig_msg_id}/react",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"emoji": "❤️"}
        )
        assert r_react_alice.status_code == 200
        react_data_alice = r_react_alice.json()
        assert react_data_alice["reactions"][0]["count"] == 2
        print("3. Alice also reacted with ❤️ -> Count incremented to 2!")

        # 5. Bob clicks ❤️ again to toggle off / un-react
        r_react_toggle = await client.post(
            f"/api/messages/{orig_msg_id}/react",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={"emoji": "❤️"}
        )
        assert r_react_toggle.status_code == 200
        assert r_react_toggle.json()["action"] == "removed"
        assert r_react_toggle.json()["reactions"][0]["count"] == 1
        print("4. Bob clicked ❤️ again -> Toggled off cleanly, count reduced to 1!")

        # 6. Bob replies to Alice's message (WhatsApp-style quote reply)
        r_reply = await client.post(
            "/api/rooms/1/messages",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={
                "content": "Yes Alice, I am 100% ready!",
                "reply_to_id": orig_msg_id
            }
        )
        assert r_reply.status_code == 200
        reply_msg = r_reply.json()
        assert reply_msg["reply_to_id"] == orig_msg_id
        assert reply_msg["reply_to"] is not None
        assert reply_msg["reply_to"]["id"] == orig_msg_id
        assert "Alice" in reply_msg["reply_to"]["sender_name"]
        print(f"5. Bob quoted Alice's message in reply: '{reply_msg['content']}'")
        print(f"   -> Quoted info: ID={reply_msg['reply_to']['id']}, Sender={reply_msg['reply_to']['sender_name']}, Text='{reply_msg['reply_to']['content']}'")

        # 7. Check message history in #general has the reply and reactions preserved
        r_history = await client.get("/api/rooms/1/messages", headers={"Authorization": f"Bearer {alice_token}"})
        assert r_history.status_code == 200
        all_msgs = r_history.json()
        saved_orig = next(m for m in all_msgs if m["id"] == orig_msg_id)
        saved_reply = next(m for m in all_msgs if m["id"] == reply_msg["id"])
        assert len(saved_orig["reactions"]) == 1
        assert saved_reply["reply_to"]["id"] == orig_msg_id
        print("6. Database persistence verified for reactions and quoted replies in message history!")

        # 8. 1-to-1 Direct Messaging Quoted Reply & Reaction
        r_dm = await client.post(
            f"/api/messages/direct/{bob_id}",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"content": "Private DM from Alice to Bob"}
        )
        assert r_dm.status_code == 200
        dm_orig = r_dm.json()

        # Bob reacts to DM
        r_dm_react = await client.post(
            f"/api/messages/{dm_orig['id']}/react",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={"emoji": "🔥"}
        )
        assert r_dm_react.status_code == 200
        assert r_dm_react.json()["reactions"][0]["emoji"] == "🔥"
        print("7. Bob reacted with 🔥 to 1-to-1 private DM successfully!")

        # Bob replies to Alice's private DM
        r_dm_reply = await client.post(
            f"/api/messages/direct/{alice_id}",
            headers={"Authorization": f"Bearer {bob_token}"},
            json={
                "content": "Bob's private reply quoting Alice",
                "reply_to_id": dm_orig["id"]
            }
        )
        assert r_dm_reply.status_code == 200
        assert r_dm_reply.json()["reply_to"]["id"] == dm_orig["id"]
        print("8. Bob sent WhatsApp-style quoted reply in 1-to-1 private DM successfully!")

    print("\n>>> ALL WHATSAPP-STYLE FEATURES VERIFIED 100% SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(test_whatsapp_features())
