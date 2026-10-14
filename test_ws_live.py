import asyncio
import json
import websockets
import httpx

async def test_live_websocket():
    print("Testing live WebSocket on running server http://127.0.0.1:8000 ...")
    async with httpx.AsyncClient() as client:
        # 1. Login Alice
        res_alice = await client.post("http://127.0.0.1:8000/api/auth/demo-login/alice")
        assert res_alice.status_code == 200
        alice_data = res_alice.json()
        alice_token = alice_data["access_token"]
        alice_id = alice_data["user"]["id"]

        # 2. Login Bob
        res_bob = await client.post("http://127.0.0.1:8000/api/auth/demo-login/bob")
        assert res_bob.status_code == 200
        bob_data = res_bob.json()
        bob_token = bob_data["access_token"]
        bob_id = bob_data["user"]["id"]

        # 3. Connect Alice via WebSocket
        ws_alice_url = f"ws://127.0.0.1:8000/ws?token={alice_token}"
        ws_bob_url = f"ws://127.0.0.1:8000/ws?token={bob_token}"

        async with websockets.connect(ws_alice_url) as ws_alice:
            # Alice receives presence init
            msg1 = json.loads(await ws_alice.recv())
            print("Alice received WS message 1:", msg1)
            assert msg1["type"] == "init_presence"

            # Connect Bob via WebSocket
            async with websockets.connect(ws_bob_url) as ws_bob:
                # Bob receives init presence
                bob_init = json.loads(await ws_bob.recv())
                print("Bob received WS message:", bob_init)
                assert bob_init["type"] == "init_presence"

                # Alice should receive notification that Bob came online
                bob_status_for_alice = json.loads(await ws_alice.recv())
                print("Alice received Bob presence event:", bob_status_for_alice)
                assert bob_status_for_alice["type"] == "user_status"
                assert bob_status_for_alice["user_id"] == bob_id
                assert bob_status_for_alice["is_online"] is True

                # Alice sends a direct message to Bob over WebSocket
                await ws_alice.send(json.dumps({
                    "action": "send_direct_message",
                    "recipient_id": bob_id,
                    "content": "Live WebSocket DM from Alice to Bob!"
                }))

                # Both Alice and Bob should receive the DM frame
                alice_dm = json.loads(await ws_alice.recv())
                bob_dm = json.loads(await ws_bob.recv())
                print("Alice received DM ack/copy:", alice_dm["message"]["content"])
                print("Bob received live DM:", bob_dm["message"]["content"])
                assert bob_dm["message"]["content"] == "Live WebSocket DM from Alice to Bob!"

                # Alice sends a room message in #general (room_id 1)
                await ws_alice.send(json.dumps({
                    "action": "send_room_message",
                    "room_id": 1,
                    "content": "Live WebSocket Room Broadcast in #general!"
                }))

                # Both receive room message
                alice_rm = json.loads(await ws_alice.recv())
                bob_rm = json.loads(await ws_bob.recv())
                print("Alice received Room message:", alice_rm["message"]["content"])
                print("Bob received Room message:", bob_rm["message"]["content"])
                assert bob_rm["message"]["content"] == "Live WebSocket Room Broadcast in #general!"

    print("\n>>> LIVE WEBSOCKET PRESENCE, GROUP CHAT & 1-TO-1 DM VERIFIED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    asyncio.run(test_live_websocket())
