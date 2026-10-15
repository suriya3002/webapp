import asyncio
import httpx
import websockets
import json

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws"

async def test_live_ws_reactions():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # Login Alice and Bob
        alice_login = (await client.post("/api/auth/demo-login/alice")).json()
        bob_login = (await client.post("/api/auth/demo-login/bob")).json()
        alice_token = alice_login["access_token"]
        bob_token = bob_login["access_token"]

        # Post a message from Alice in Room 1
        msg_resp = (await client.post(
            "/api/rooms/1/messages",
            headers={"Authorization": f"Bearer {alice_token}"},
            json={"content": "React to me over WebSocket!"}
        )).json()
        msg_id = msg_resp["id"]
        print(f"Alice posted message #{msg_id}: {msg_resp['content']}")

    # Connect Bob to WebSocket
    async with websockets.connect(f"{WS_URL}?token={bob_token}") as bob_ws:
        # Connect Alice to WebSocket
        async with websockets.connect(f"{WS_URL}?token={alice_token}") as alice_ws:
            # Drain initial presence frames
            await bob_ws.recv()
            await alice_ws.recv()

            # Bob sends react_message action over WebSocket
            react_payload = {
                "action": "react_message",
                "message_id": msg_id,
                "emoji": "🔥"
            }
            await bob_ws.send(json.dumps(react_payload))
            print("Bob sent react_message event over WS")

            # Alice should receive message_reaction broadcast
            alice_event = None
            for _ in range(8):
                try:
                    raw = await asyncio.wait_for(alice_ws.recv(), timeout=3.0)
                    msg = json.loads(raw)
                    print("Alice received WS frame:", msg.get("type"))
                    if msg.get("type") == "message_reaction":
                        alice_event = msg
                        break
                except asyncio.TimeoutError:
                    break

            assert alice_event is not None, "Alice did not receive message_reaction frame!"
            print(f"Alice received message_reaction frame: {alice_event}")
            assert alice_event["message_id"] == msg_id
            assert any(r["emoji"] == "🔥" and r["count"] >= 1 for r in alice_event["reactions"])

            # Bob sends quoted reply over WebSocket
            reply_payload = {
                "action": "send_room_message",
                "room_id": 1,
                "content": "Quoted reply over WebSocket!",
                "reply_to_id": msg_id
            }
            await bob_ws.send(json.dumps(reply_payload))
            print("Bob sent quoted reply over WS")

            # Alice should receive room_message with reply_to
            reply_msg = None
            for _ in range(8):
                try:
                    raw = await asyncio.wait_for(alice_ws.recv(), timeout=3.0)
                    msg = json.loads(raw)
                    print("Alice received WS frame for reply:", msg.get("type"))
                    inner_msg = msg.get("message") or {}
                    if msg.get("type") == "room_message" and inner_msg.get("reply_to"):
                        reply_msg = inner_msg
                        break
                except asyncio.TimeoutError:
                    break

            assert reply_msg is not None, "Alice did not receive room_message with reply_to!"
            print(f"Alice received quoted reply: ID={reply_msg['id']}, ReplyTo={reply_msg['reply_to']['id']}, Content={reply_msg['content']}")
            assert reply_msg["reply_to"]["id"] == msg_id

    print("\n>>> LIVE WEBSOCKET EMOJI REACTIONS & QUOTED REPLIES VERIFIED 100%! <<<")

if __name__ == "__main__":
    asyncio.run(test_live_ws_reactions())
