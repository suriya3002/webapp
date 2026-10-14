// API Client for FastAPI backend
const API = {
  TOKEN_KEY: "chat_app_jwt_token",

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401 && !endpoint.includes("/api/auth/login") && !endpoint.includes("/api/auth/demo-login")) {
        this.clearToken();
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
        throw new Error("Session expired. Please log in again.");
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "An unexpected error occurred");
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async register(userData) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  },

  async login(username, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },

  async demoLogin(username) {
    return this.request(`/api/auth/demo-login/${username}`, {
      method: "POST"
    });
  },

  async getMe() {
    return this.request("/api/auth/me");
  },

  // Users Endpoints
  async getUsers() {
    return this.request("/api/users");
  },

  async getUser(userId) {
    return this.request(`/api/users/${userId}`);
  },

  // Rooms Endpoints
  async getRooms() {
    return this.request("/api/rooms");
  },

  async createRoom(roomData) {
    return this.request("/api/rooms", {
      method: "POST",
      body: JSON.stringify(roomData)
    });
  },

  async deleteRoom(roomId) {
    return this.request(`/api/rooms/${roomId}`, {
      method: "DELETE"
    });
  },

  async getRoomMessages(roomId) {
    return this.request(`/api/rooms/${roomId}/messages`);
  },

  async sendRoomMessage(roomId, content) {
    return this.request(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  },

  // Direct Message Endpoints
  async getDirectMessages(otherUserId) {
    return this.request(`/api/messages/direct/${otherUserId}`);
  },

  async sendDirectMessage(otherUserId, content) {
    return this.request(`/api/messages/direct/${otherUserId}`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
  },

  // Message Edit & Delete Endpoints
  async editMessage(messageId, content) {
    return this.request(`/api/messages/${messageId}`, {
      method: "PUT",
      body: JSON.stringify({ content })
    });
  },

  async deleteMessage(messageId) {
    return this.request(`/api/messages/${messageId}`, {
      method: "DELETE"
    });
  }
};
