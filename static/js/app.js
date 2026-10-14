// Main Application Logic
const App = {
  state: {
    currentUser: null,
    users: new Map(), // userId -> user object
    rooms: new Map(), // roomId -> room object
    activeChat: null, // { type: 'room' | 'direct', id: number, data: object }
    messages: [],
    typingTimers: new Map(),
    myTypingTimeout: null,
    unreadCounts: new Map() // 'room-1' or 'user-2' -> number
  },

  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.checkSession();
  },

  cacheElements() {
    this.elements = {
      // Auth
      authOverlay: document.getElementById("auth-overlay"),
      authForm: document.getElementById("auth-form"),
      authTitle: document.getElementById("auth-title"),
      authSubtitle: document.getElementById("auth-subtitle"),
      authSubmitBtn: document.getElementById("auth-submit-btn"),
      tabSignIn: document.getElementById("tab-sign-in"),
      tabSignUp: document.getElementById("tab-sign-up"),
      displayNameGroup: document.getElementById("group-display-name"),
      colorPickerGroup: document.getElementById("group-avatar-color"),
      authUsernameInput: document.getElementById("auth-username"),
      authEmailInput: document.getElementById("auth-email"),
      authPasswordInput: document.getElementById("auth-password"),
      authDisplayNameInput: document.getElementById("auth-display-name"),
      avatarColorOptions: document.querySelectorAll(".color-option"),
      demoAliceBtn: document.getElementById("demo-alice"),
      demoBobBtn: document.getElementById("demo-bob"),
      demoCharlieBtn: document.getElementById("demo-charlie"),

      // App UI
      appContainer: document.getElementById("app-container"),
      sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
      sidebarUserName: document.getElementById("sidebar-user-name"),
      sidebarUserTag: document.getElementById("sidebar-user-tag"),
      sidebarUserBadge: document.getElementById("sidebar-user-badge"),
      railUserAvatar: document.getElementById("rail-user-avatar"),
      railUserBadge: document.getElementById("rail-user-badge"),
      logoutBtn: document.getElementById("logout-btn"),
      channelList: document.getElementById("channel-list"),
      userList: document.getElementById("user-list"),
      channelCount: document.getElementById("channel-count"),
      onlineUserCount: document.getElementById("online-user-count"),
      sidebarSearch: document.getElementById("sidebar-search-input"),

      // Chat area
      chatHeader: document.getElementById("chat-header"),
      chatTargetIcon: document.getElementById("chat-target-icon"),
      chatTargetTitle: document.getElementById("chat-target-title"),
      chatTargetDesc: document.getElementById("chat-target-desc"),
      chatTargetBadge: document.getElementById("chat-target-badge"),
      toggleDetailsBtn: document.getElementById("toggle-details-btn"),
      detailsPanel: document.getElementById("details-panel"),
      closeDetailsBtn: document.getElementById("close-details-btn"),
      detailsContent: document.getElementById("details-content"),

      // Messages feed
      messagesContainer: document.getElementById("messages-container"),
      typingBar: document.getElementById("typing-bar"),
      typingText: document.getElementById("typing-text"),

      // Input area
      chatForm: document.getElementById("chat-form"),
      chatInput: document.getElementById("chat-input"),
      sendBtn: document.getElementById("send-btn"),
      emojiToggleBtn: document.getElementById("emoji-toggle-btn"),
      emojiPopover: document.getElementById("emoji-popover"),

      // New Room Modal
      openCreateRoomBtn: document.getElementById("open-create-room-btn"),
      createRoomModal: document.getElementById("create-room-modal"),
      closeRoomModalBtn: document.getElementById("close-room-modal-btn"),
      cancelRoomBtn: document.getElementById("cancel-room-btn"),
      createRoomForm: document.getElementById("create-room-form"),
      roomNameInput: document.getElementById("room-name-input"),
      roomDescInput: document.getElementById("room-desc-input"),
      roomIconChoices: document.querySelectorAll(".icon-choice"),

      // Toast
      toastContainer: document.getElementById("toast-container")
    };
  },

  bindEvents() {
    // Auth Tab Switch
    this.elements.tabSignIn.addEventListener("click", () => this.setAuthMode("login"));
    this.elements.tabSignUp.addEventListener("click", () => this.setAuthMode("signup"));

    // Avatar color choices
    this.elements.avatarColorOptions.forEach(opt => {
      opt.addEventListener("click", () => {
        this.elements.avatarColorOptions.forEach(o => o.classList.remove("selected"));
        opt.classList.add("selected");
      });
    });

    // Auth Form submit
    this.elements.authForm.addEventListener("submit", (e) => this.handleAuthSubmit(e));

    // Demo user quick login
    this.elements.demoAliceBtn.addEventListener("click", () => this.handleDemoLogin("alice"));
    this.elements.demoBobBtn.addEventListener("click", () => this.handleDemoLogin("bob"));
    this.elements.demoCharlieBtn.addEventListener("click", () => this.handleDemoLogin("charlie"));

    // Logout
    this.elements.logoutBtn.addEventListener("click", () => this.logout());

    // Sidebar search
    this.elements.sidebarSearch.addEventListener("input", (e) => this.handleSearch(e.target.value));

    // Chat input auto-expand & submit
    this.elements.chatInput.addEventListener("input", () => {
      this.elements.chatInput.style.height = "auto";
      this.elements.chatInput.style.height = `${Math.min(this.elements.chatInput.scrollHeight, 140)}px`;
      this.handleTypingActivity();
    });

    this.elements.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.elements.chatForm.dispatchEvent(new Event("submit"));
      }
    });

    this.elements.chatForm.addEventListener("submit", (e) => this.handleSendMessage(e));

    // Emoji picker toggle
    this.elements.emojiToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.elements.emojiPopover.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!this.elements.emojiPopover.contains(e.target) && e.target !== this.elements.emojiToggleBtn) {
        this.elements.emojiPopover.classList.add("hidden");
      }
    });

    document.querySelectorAll(".emoji-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.elements.chatInput.value += btn.textContent;
        this.elements.chatInput.focus();
        this.elements.emojiPopover.classList.add("hidden");
      });
    });

    // Right details panel toggle
    this.elements.toggleDetailsBtn.addEventListener("click", () => {
      this.elements.detailsPanel.classList.toggle("collapsed");
      this.elements.toggleDetailsBtn.classList.toggle("active");
    });
    this.elements.closeDetailsBtn.addEventListener("click", () => {
      this.elements.detailsPanel.classList.add("collapsed");
      this.elements.toggleDetailsBtn.classList.remove("active");
    });

    // Create Room Modal
    this.elements.openCreateRoomBtn.addEventListener("click", () => {
      this.elements.createRoomModal.classList.remove("hidden");
      this.elements.roomNameInput.focus();
    });
    this.elements.closeRoomModalBtn.addEventListener("click", () => this.elements.createRoomModal.classList.add("hidden"));
    this.elements.cancelRoomBtn.addEventListener("click", () => this.elements.createRoomModal.classList.add("hidden"));

    this.elements.roomIconChoices.forEach(ic => {
      ic.addEventListener("click", () => {
        this.elements.roomIconChoices.forEach(c => c.classList.remove("selected"));
        ic.classList.add("selected");
      });
    });

    this.elements.createRoomForm.addEventListener("submit", (e) => this.handleCreateRoom(e));

    // WebSocket event listeners
    wsClient.on("presence:init", (onlineIds) => this.handlePresenceInit(onlineIds));
    wsClient.on("presence:status", (statusData) => this.handlePresenceStatus(statusData));
    wsClient.on("chat:room_message", (msg) => this.handleIncomingRoomMessage(msg));
    wsClient.on("chat:direct_message", (msg) => this.handleIncomingDirectMessage(msg));
    wsClient.on("chat:typing", (typingData) => this.handleIncomingTyping(typingData));
    wsClient.on("room:created", (room) => this.handleRoomCreated(room));
    wsClient.on("connection:change", ({ status }) => {
      console.log("WebSocket status changed:", status);
    });

    // Global unauthorized listener
    window.addEventListener("auth:unauthorized", () => {
      this.showToast("Your session has expired. Please sign in again.", "error");
      this.showAuthModal();
    });
  },

  setAuthMode(mode) {
    if (mode === "login") {
      this.elements.tabSignIn.classList.add("active");
      this.elements.tabSignUp.classList.remove("active");
      this.elements.authTitle.textContent = "Welcome Back";
      this.elements.authSubtitle.textContent = "Sign in to join real-time rooms and conversations";
      this.elements.authSubmitBtn.textContent = "Sign In";
      this.elements.displayNameGroup.style.display = "none";
      this.elements.colorPickerGroup.style.display = "none";
      this.elements.authEmailInput.removeAttribute("required");
      this.elements.authEmailInput.closest(".form-group").style.display = "none";
    } else {
      this.elements.tabSignUp.classList.add("active");
      this.elements.tabSignIn.classList.remove("active");
      this.elements.authTitle.textContent = "Create an Account";
      this.elements.authSubtitle.textContent = "Start chatting in real time with group rooms & DMs";
      this.elements.authSubmitBtn.textContent = "Create Account";
      this.elements.displayNameGroup.style.display = "block";
      this.elements.colorPickerGroup.style.display = "block";
      this.elements.authEmailInput.setAttribute("required", "true");
      this.elements.authEmailInput.closest(".form-group").style.display = "block";
    }
  },

  async checkSession() {
    const token = API.getToken();
    if (!token) {
      this.showAuthModal();
      return;
    }

    try {
      const user = await API.getMe();
      this.state.currentUser = user;
      this.onLoginSuccess(token);
    } catch (e) {
      API.clearToken();
      this.showAuthModal();
    }
  },

  showAuthModal() {
    this.elements.authOverlay.classList.remove("hidden");
    this.elements.appContainer.style.filter = "blur(4px)";
  },

  hideAuthModal() {
    this.elements.authOverlay.classList.add("hidden");
    this.elements.appContainer.style.filter = "none";
  },

  async handleAuthSubmit(e) {
    e.preventDefault();
    const isSignUp = this.elements.tabSignUp.classList.contains("active");
    const username = this.elements.authUsernameInput.value.trim();
    const password = this.elements.authPasswordInput.value;

    try {
      this.elements.authSubmitBtn.disabled = true;
      this.elements.authSubmitBtn.textContent = "Please wait...";

      let response;
      if (isSignUp) {
        const email = this.elements.authEmailInput.value.trim();
        const displayName = this.elements.authDisplayNameInput.value.trim() || username;
        const selectedColorEl = document.querySelector(".color-option.selected");
        const avatarColor = selectedColorEl ? selectedColorEl.dataset.color : "#6366f1";

        response = await API.register({
          username,
          email,
          password,
          display_name: displayName,
          avatar_color: avatarColor
        });
      } else {
        response = await API.login(username, password);
      }

      API.setToken(response.access_token);
      this.state.currentUser = response.user;
      this.onLoginSuccess(response.access_token);
      this.showToast(`Welcome back, ${this.state.currentUser.display_name}!`, "success");
    } catch (err) {
      this.showToast(err.message || "Authentication failed", "error");
    } finally {
      this.elements.authSubmitBtn.disabled = false;
      this.elements.authSubmitBtn.textContent = isSignUp ? "Create Account" : "Sign In";
    }
  },

  async handleDemoLogin(username) {
    try {
      const response = await API.demoLogin(username);
      API.setToken(response.access_token);
      this.state.currentUser = response.user;
      this.onLoginSuccess(response.access_token);
      this.showToast(`Signed in as ${response.user.display_name}`, "success");
    } catch (err) {
      this.showToast("Demo sign in failed: " + err.message, "error");
    }
  },

  async onLoginSuccess(token) {
    this.hideAuthModal();
    this.renderCurrentUserInfo();
    wsClient.connect(token);
    await this.loadInitialData();
  },

  logout() {
    wsClient.disconnect();
    API.clearToken();
    this.state.currentUser = null;
    this.state.activeChat = null;
    this.showAuthModal();
    this.showToast("You have been signed out.", "success");
  },

  renderCurrentUserInfo() {
    const user = this.state.currentUser;
    if (!user) return;

    this.elements.sidebarUserName.textContent = user.display_name;
    this.elements.sidebarUserTag.textContent = `@${user.username}`;
    this.elements.sidebarUserAvatar.textContent = user.display_name.charAt(0).toUpperCase();
    this.elements.sidebarUserAvatar.style.backgroundColor = user.avatar_color || "#6366f1";

    this.elements.railUserAvatar.textContent = user.display_name.charAt(0).toUpperCase();
    this.elements.railUserAvatar.style.backgroundColor = user.avatar_color || "#6366f1";
    this.elements.railUserAvatar.title = `${user.display_name} (@${user.username})`;
  },

  async loadInitialData() {
    try {
      const [rooms, users] = await Promise.all([
        API.getRooms(),
        API.getUsers()
      ]);

      // Cache rooms
      this.state.rooms.clear();
      rooms.forEach(r => this.state.rooms.set(r.id, r));

      // Cache users
      this.state.users.clear();
      users.forEach(u => this.state.users.set(u.id, u));

      this.renderRoomsList();
      this.renderUsersList();

      // Open general room by default or first room
      if (rooms.length > 0) {
        const generalRoom = rooms.find(r => r.name === "general") || rooms[0];
        this.selectChat("room", generalRoom.id);
      }
    } catch (err) {
      this.showToast("Error loading chat data: " + err.message, "error");
    }
  },

  renderRoomsList() {
    this.elements.channelList.innerHTML = "";
    this.elements.channelCount.textContent = `(${this.state.rooms.size})`;

    this.state.rooms.forEach(room => {
      const item = document.createElement("div");
      item.className = `nav-item ${this.state.activeChat?.type === 'room' && this.state.activeChat?.id === room.id ? 'active' : ''}`;
      item.dataset.roomId = room.id;

      const unread = this.state.unreadCounts.get(`room-${room.id}`) || 0;

      item.innerHTML = `
        <span class="item-icon">${room.icon || "💬"}</span>
        <span class="item-name">${room.name}</span>
        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
      `;

      item.addEventListener("click", () => this.selectChat("room", room.id));
      this.elements.channelList.appendChild(item);
    });
  },

  renderUsersList() {
    this.elements.userList.innerHTML = "";
    let onlineCount = 0;

    // Filter out current user from the direct message list
    const otherUsers = Array.from(this.state.users.values())
      .filter(u => u.id !== this.state.currentUser?.id);

    // Sort: online users first, then alphabetically
    otherUsers.sort((a, b) => {
      if (a.is_online === b.is_online) {
        return a.display_name.localeCompare(b.display_name);
      }
      return a.is_online ? -1 : 1;
    });

    otherUsers.forEach(user => {
      if (user.is_online) onlineCount++;

      const item = document.createElement("div");
      item.className = `nav-item ${this.state.activeChat?.type === 'direct' && this.state.activeChat?.id === user.id ? 'active' : ''}`;
      item.dataset.userId = user.id;

      const unread = this.state.unreadCounts.get(`user-${user.id}`) || 0;

      item.innerHTML = `
        <div class="user-avatar-wrap">
          <div class="user-avatar" style="background-color: ${user.avatar_color || '#6366f1'}">
            ${user.display_name.charAt(0).toUpperCase()}
          </div>
          <span class="user-presence-dot ${user.is_online ? 'online' : ''}" data-presence-id="${user.id}"></span>
        </div>
        <span class="item-name">${user.display_name}</span>
        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
      `;

      item.addEventListener("click", () => this.selectChat("direct", user.id));
      this.elements.userList.appendChild(item);
    });

    this.elements.onlineUserCount.textContent = `(${onlineCount} online)`;
  },

  async selectChat(type, id) {
    if (type === "room") {
      const room = this.state.rooms.get(id);
      if (!room) return;

      this.state.activeChat = { type: "room", id, data: room };
      this.state.unreadCounts.delete(`room-${id}`);
      this.renderRoomsList();

      this.elements.chatTargetIcon.textContent = room.icon || "💬";
      this.elements.chatTargetTitle.textContent = `#${room.name}`;
      this.elements.chatTargetDesc.textContent = room.description || "Room discussions";
      this.elements.chatTargetBadge.className = "chat-target-badge";
      this.elements.chatTargetBadge.textContent = "";

      this.elements.chatInput.placeholder = `Message #${room.name}...`;

      // Update right panel
      this.renderRoomDetails(room);

      // Tell WebSocket client our current room
      wsClient.send({ action: "join_room", room_id: id });

      // Load messages history
      await this.loadMessagesHistory();
    } else {
      const user = this.state.users.get(id);
      if (!user) return;

      this.state.activeChat = { type: "direct", id, data: user };
      this.state.unreadCounts.delete(`user-${id}`);
      this.renderUsersList();

      this.elements.chatTargetIcon.textContent = user.display_name.charAt(0).toUpperCase();
      this.elements.chatTargetIcon.style.backgroundColor = user.avatar_color || "#6366f1";
      this.elements.chatTargetTitle.textContent = user.display_name;
      this.elements.chatTargetDesc.textContent = `@${user.username} • ${user.bio || "Available"}`;
      
      this.updateChatHeaderOnlineStatus(user.is_online);

      this.elements.chatInput.placeholder = `Direct message ${user.display_name}...`;

      // Update right panel
      this.renderUserDetails(user);

      // Load direct messages history
      await this.loadMessagesHistory();
    }

    this.elements.chatInput.focus();
  },

  updateChatHeaderOnlineStatus(isOnline) {
    if (this.state.activeChat?.type === "direct") {
      this.elements.chatTargetBadge.className = `chat-target-badge ${isOnline ? 'online' : 'offline'}`;
      this.elements.chatTargetBadge.innerHTML = `
        <span class="user-presence-dot ${isOnline ? 'online' : ''}"></span>
        <span>${isOnline ? 'Online' : 'Offline'}</span>
      `;
    }
  },

  async loadMessagesHistory() {
    const active = this.state.activeChat;
    if (!active) return;

    this.elements.messagesContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">
        Loading message history...
      </div>
    `;

    try {
      let messages = [];
      if (active.type === "room") {
        messages = await API.getRoomMessages(active.id);
      } else {
        messages = await API.getDirectMessages(active.id);
      }

      this.state.messages = messages;
      this.renderMessages();
      this.scrollToBottom();
    } catch (err) {
      this.elements.messagesContainer.innerHTML = `
        <div style="text-align: center; color: #ef4444; padding: 30px;">
          Failed to load messages: ${err.message}
        </div>
      `;
    }
  },

  renderMessages() {
    this.elements.messagesContainer.innerHTML = "";
    const active = this.state.activeChat;
    if (!active) return;

    // Welcome banner
    const welcome = document.createElement("div");
    welcome.className = "channel-welcome-banner";
    if (active.type === "room") {
      welcome.innerHTML = `
        <h3>Welcome to #${active.data.name}!</h3>
        <p>This is the start of the #${active.data.name} room. All messages are stored permanently and delivered in real time.</p>
      `;
    } else {
      welcome.innerHTML = `
        <h3>Direct Conversation with ${active.data.display_name}</h3>
        <p>This is the start of your 1-on-1 private conversation history with @${active.data.username}.</p>
      `;
    }
    this.elements.messagesContainer.appendChild(welcome);

    let lastDate = "";

    this.state.messages.forEach(msg => {
      // Date divider
      const msgDate = new Date(msg.created_at).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });

      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const dateDivider = document.createElement("div");
        dateDivider.className = "date-divider";
        dateDivider.innerHTML = `<span>${msgDate}</span>`;
        this.elements.messagesContainer.appendChild(dateDivider);
      }

      const msgEl = this.createMessageElement(msg);
      this.elements.messagesContainer.appendChild(msgEl);
    });
  },

  createMessageElement(msg) {
    const isMe = msg.sender_id === this.state.currentUser?.id;
    const row = document.createElement("div");
    row.className = "message-row";
    row.dataset.msgId = msg.id;

    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Format content: convert backtick code blocks & links safely
    const formattedContent = this.formatMessageText(msg.content);

    row.innerHTML = `
      <div class="message-avatar" style="background-color: ${msg.sender_avatar_color || '#6366f1'}">
        ${msg.sender_display_name ? msg.sender_display_name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div class="message-content-wrap">
        <div class="message-meta">
          <span class="message-author" style="${isMe ? 'color: #a5b4fc;' : ''}">${msg.sender_display_name}</span>
          <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-text">${formattedContent}</div>
      </div>
      <div class="message-actions">
        <button class="msg-action-btn copy-btn" title="Copy message">📋</button>
      </div>
    `;

    row.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(msg.content);
      this.showToast("Copied to clipboard", "success");
    });

    return row;
  },

  formatMessageText(text) {
    // Escape HTML to prevent XSS
    const div = document.createElement("div");
    div.textContent = text;
    let safe = div.innerHTML;

    // Code blocks `code`
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Auto linkify URLs
    safe = safe.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: underline;">$1</a>');

    // Preserve newlines
    safe = safe.replace(/\n/g, '<br/>');

    return safe;
  },

  scrollToBottom() {
    setTimeout(() => {
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }, 20);
  },

  async handleSendMessage(e) {
    e.preventDefault();
    const content = this.elements.chatInput.value.trim();
    if (!content) return;

    const active = this.state.activeChat;
    if (!active) {
      this.showToast("Select a room or conversation to send messages", "error");
      return;
    }

    // Reset textarea immediately
    this.elements.chatInput.value = "";
    this.elements.chatInput.style.height = "auto";

    // Notify stopped typing
    this.sendTypingIndicator(false);

    try {
      if (active.type === "room") {
        const sentViaWs = wsClient.sendRoomMessage(active.id, content);
        if (!sentViaWs) {
          // Fallback to REST API if WS not ready
          await API.sendRoomMessage(active.id, content);
        }
      } else {
        const sentViaWs = wsClient.sendDirectMessage(active.id, content);
        if (!sentViaWs) {
          // Fallback to REST API
          await API.sendDirectMessage(active.id, content);
        }
      }
    } catch (err) {
      this.showToast("Failed to send message: " + err.message, "error");
    }
  },

  handleTypingActivity() {
    this.sendTypingIndicator(true);

    if (this.state.myTypingTimeout) clearTimeout(this.state.myTypingTimeout);
    this.state.myTypingTimeout = setTimeout(() => {
      this.sendTypingIndicator(false);
    }, 2000);
  },

  sendTypingIndicator(isTyping) {
    const active = this.state.activeChat;
    if (!active) return;

    if (active.type === "room") {
      wsClient.sendTyping(active.id, null, isTyping);
    } else {
      wsClient.sendTyping(null, active.id, isTyping);
    }
  },

  // Inbound WS Handlers
  handlePresenceInit(onlineIds) {
    const onlineSet = new Set(onlineIds);
    this.state.users.forEach(user => {
      user.is_online = onlineSet.has(user.id);
    });
    this.renderUsersList();
    if (this.state.activeChat?.type === "direct") {
      const activeUser = this.state.users.get(this.state.activeChat.id);
      if (activeUser) this.updateChatHeaderOnlineStatus(activeUser.is_online);
    }
  },

  handlePresenceStatus(data) {
    const user = this.state.users.get(data.user_id);
    if (user) {
      user.is_online = data.is_online;
      this.renderUsersList();

      if (this.state.activeChat?.type === "direct" && this.state.activeChat.id === data.user_id) {
        this.updateChatHeaderOnlineStatus(data.is_online);
        this.renderUserDetails(user);
      }
    }
  },

  handleIncomingRoomMessage(msg) {
    const active = this.state.activeChat;
    if (active?.type === "room" && active.id === msg.room_id) {
      // Append directly to active room
      this.state.messages.push(msg);
      const msgEl = this.createMessageElement(msg);
      this.elements.messagesContainer.appendChild(msgEl);
      this.scrollToBottom();
    } else {
      // Increment unread count for that room
      const key = `room-${msg.room_id}`;
      const count = (this.state.unreadCounts.get(key) || 0) + 1;
      this.state.unreadCounts.set(key, count);
      this.renderRoomsList();
      this.playNotificationSound();
    }
  },

  handleIncomingDirectMessage(msg) {
    const active = this.state.activeChat;
    const isRelevantToActive = active?.type === "direct" && 
      (msg.sender_id === active.id || (msg.sender_id === this.state.currentUser?.id && msg.recipient_id === active.id));

    if (isRelevantToActive) {
      this.state.messages.push(msg);
      const msgEl = this.createMessageElement(msg);
      this.elements.messagesContainer.appendChild(msgEl);
      this.scrollToBottom();
    } else {
      // Unread from sender
      const senderId = msg.sender_id === this.state.currentUser?.id ? msg.recipient_id : msg.sender_id;
      const key = `user-${senderId}`;
      const count = (this.state.unreadCounts.get(key) || 0) + 1;
      this.state.unreadCounts.set(key, count);
      this.renderUsersList();
      this.playNotificationSound();
    }
  },

  handleIncomingTyping(data) {
    const active = this.state.activeChat;
    if (!active) return;

    const isMatch = (active.type === "room" && active.id === data.room_id) ||
                    (active.type === "direct" && active.id === data.user_id);

    if (!isMatch) return;

    if (data.is_typing) {
      this.elements.typingText.textContent = `${data.display_name} is typing...`;
      this.elements.typingBar.style.visibility = "visible";

      // Clear existing timer
      if (this.state.typingTimers.has(data.user_id)) {
        clearTimeout(this.state.typingTimers.get(data.user_id));
      }
      // Auto clear after 3s
      const timer = setTimeout(() => {
        this.elements.typingBar.style.visibility = "hidden";
      }, 3000);
      this.state.typingTimers.set(data.user_id, timer);
    } else {
      this.elements.typingBar.style.visibility = "hidden";
    }
  },

  handleRoomCreated(room) {
    this.state.rooms.set(room.id, room);
    this.renderRoomsList();
    this.showToast(`New channel #${room.name} created!`, "success");
  },

  async handleCreateRoom(e) {
    e.preventDefault();
    const name = this.elements.roomNameInput.value.trim();
    const description = this.elements.roomDescInput.value.trim();
    const selectedIcon = document.querySelector(".icon-choice.selected");
    const icon = selectedIcon ? selectedIcon.textContent : "💬";

    if (!name) return;

    try {
      const newRoom = await API.createRoom({ name, description, icon });
      this.state.rooms.set(newRoom.id, newRoom);
      this.renderRoomsList();
      this.elements.createRoomModal.classList.add("hidden");
      this.elements.createRoomForm.reset();
      this.selectChat("room", newRoom.id);
      this.showToast(`Channel #${newRoom.name} created!`, "success");
    } catch (err) {
      this.showToast("Failed to create room: " + err.message, "error");
    }
  },

  renderRoomDetails(room) {
    const membersList = Array.from(this.state.users.values());
    const onlineMembers = membersList.filter(u => u.is_online);

    this.elements.detailsContent.innerHTML = `
      <div class="details-profile-card">
        <div class="details-avatar-lg" style="background: var(--accent-gradient);">
          ${room.icon || "💬"}
        </div>
        <div class="details-name">#${room.name}</div>
        <div class="details-bio">${room.description || "No topic set for this room"}</div>
      </div>
      <div class="details-section-title">Members (${onlineMembers.length} online / ${membersList.length} total)</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${membersList.map(u => `
          <div style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px; border-radius: 6px;" onclick="App.selectChat('direct', ${u.id})">
            <div class="user-avatar-wrap">
              <div class="user-avatar" style="background-color: ${u.avatar_color || '#6366f1'}">${u.display_name.charAt(0).toUpperCase()}</div>
              <span class="user-presence-dot ${u.is_online ? 'online' : ''}"></span>
            </div>
            <div style="flex: 1; overflow: hidden;">
              <div style="font-size: 13px; font-weight: 500; color: #fff;">${u.display_name}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${u.is_online ? 'Online' : 'Offline'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderUserDetails(user) {
    this.elements.detailsContent.innerHTML = `
      <div class="details-profile-card">
        <div class="details-avatar-lg" style="background-color: ${user.avatar_color || '#6366f1'}">
          ${user.display_name.charAt(0).toUpperCase()}
          <span class="details-online-dot ${user.is_online ? 'online' : ''}"></span>
        </div>
        <div class="details-name">${user.display_name}</div>
        <div class="details-username">@${user.username}</div>
        <div class="details-bio">${user.bio || "No status set"}</div>
      </div>
      <div class="details-section-title">User Information</div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
        <div>
          <span style="color: var(--text-muted); display: block; font-size: 11px; text-transform: uppercase;">Status</span>
          <span style="color: ${user.is_online ? 'var(--status-online)' : 'var(--text-muted)'}; font-weight: 600;">
            ${user.is_online ? '● Online Right Now' : '○ Offline'}
          </span>
        </div>
        <div>
          <span style="color: var(--text-muted); display: block; font-size: 11px; text-transform: uppercase;">Email</span>
          <span style="color: var(--text-secondary);">${user.email}</span>
        </div>
      </div>
    `;
  },

  handleSearch(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll("#channel-list .nav-item").forEach(item => {
      const name = item.querySelector(".item-name").textContent.toLowerCase();
      item.style.display = name.includes(q) ? "flex" : "none";
    });
    document.querySelectorAll("#user-list .nav-item").forEach(item => {
      const name = item.querySelector(".item-name").textContent.toLowerCase();
      item.style.display = name.includes(q) ? "flex" : "none";
    });
  },

  playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      // AudioContext might be blocked until user interaction, ignore safely
    }
  },

  showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
