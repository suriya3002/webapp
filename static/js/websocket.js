// Real-time WebSocket Client
class ChatWebSocketClient {
  constructor() {
    this.socket = null;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token) {
    if (!token) return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    console.log("Connecting to WebSocket:", wsUrl);
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log("WebSocket connected successfully.");
      this.isConnected = true;
      this.emit("connection:change", { status: "connected" });
      this.startHeartbeat();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error("Error parsing WS frame:", e);
      }
    };

    this.socket.onclose = (event) => {
      console.warn("WebSocket closed. Code:", event.code, "Reason:", event.reason);
      this.isConnected = false;
      this.emit("connection:change", { status: "disconnected" });
      this.stopHeartbeat();
      
      // Attempt reconnect if token is still available and not intentional auth failure
      if (API.getToken() && event.code !== 4001 && event.code !== 1008) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      console.log("Attempting WebSocket reconnection...");
      this.connect(API.getToken());
    }, 3000);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close(1000, "User logged out");
      this.socket = null;
    }
    this.isConnected = false;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ action: "ping" }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendRoomMessage(roomId, content, replyToId = null) {
    return this.send({
      action: "send_room_message",
      room_id: roomId,
      content: content,
      reply_to_id: replyToId
    });
  }

  sendDirectMessage(recipientId, content, replyToId = null) {
    return this.send({
      action: "send_direct_message",
      recipient_id: recipientId,
      content: content,
      reply_to_id: replyToId
    });
  }

  sendToggleReaction(messageId, emoji) {
    return this.send({
      action: "react_message",
      message_id: messageId,
      emoji: emoji
    });
  }

  sendTyping(roomId, recipientId, isTyping) {
    return this.send({
      action: "typing",
      room_id: roomId,
      recipient_id: recipientId,
      is_typing: isTyping
    });
  }

  sendEditMessage(messageId, content) {
    return this.send({
      action: "edit_message",
      message_id: messageId,
      content: content
    });
  }

  sendDeleteMessage(messageId) {
    return this.send({
      action: "delete_message",
      message_id: messageId
    });
  }

  handleMessage(data) {
    const type = data.type;
    switch (type) {
      case "init_presence":
        this.emit("presence:init", data.online_user_ids);
        break;
      case "user_status":
        this.emit("presence:status", data);
        break;
      case "room_message":
        this.emit("chat:room_message", data.message);
        break;
      case "direct_message":
        this.emit("chat:direct_message", data.message);
        break;
      case "message_reaction":
        this.emit("chat:message_reaction", data);
        break;
      case "message_edited":
        this.emit("chat:message_edited", data.message);
        break;
      case "message_deleted":
        this.emit("chat:message_deleted", data);
        break;
      case "user_typing":
        this.emit("chat:typing", data);
        break;
      case "new_room_created":
        this.emit("room:created", data.room);
        break;
      case "room_deleted":
        this.emit("room:deleted", data);
        break;
      case "pong":
        break;
      default:
        console.log("Unhandled WS message type:", type, data);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event callback for ${event}:`, e);
        }
      });
    }
  }
}

const wsClient = new ChatWebSocketClient();
