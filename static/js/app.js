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
    unreadCounts: new Map(), // 'room-1' or 'user-2' -> number
    soundEnabled: localStorage.getItem("pulse_sound_enabled") !== "false",
    sidebarFilter: "all",
    pendingDeleteRoom: null,
    cmdPaletteItems: [],
    cmdPaletteActiveIndex: 0
  },

  elements: {},

  init() {
    this.cacheElements();
    this.closeEmojiPicker();
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
      sidebarSearchBox: document.getElementById("sidebar-search-box"),
      soundToggleBtn: document.getElementById("sound-toggle-btn"),
      soundToggleIcon: document.getElementById("sound-toggle-icon"),
      filterTabs: document.querySelectorAll(".filter-tab"),
      headerSectionRooms: document.getElementById("header-section-rooms"),
      headerSectionDms: document.getElementById("header-section-dms"),
      mobileSidebarToggle: document.getElementById("mobile-sidebar-toggle"),
      mobileBackdrop: document.getElementById("mobile-backdrop"),
      appSidebar: document.getElementById("app-sidebar"),

      // Chat area
      chatHeader: document.getElementById("chat-header"),
      chatTargetIcon: document.getElementById("chat-target-icon"),
      chatTargetTitle: document.getElementById("chat-target-title"),
      chatTargetDesc: document.getElementById("chat-target-desc"),
      chatTargetBadge: document.getElementById("chat-target-badge"),
      chatPrivacyBadge: document.getElementById("chat-privacy-badge"),
      deleteRoomHeaderBtn: document.getElementById("delete-room-header-btn"),
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
      emojiSearchInput: document.getElementById("emoji-search-input"),
      emojiSearchClear: document.getElementById("emoji-search-clear"),
      closeEmojiPickerBtn: document.getElementById("close-emoji-picker-btn"),
      emojiCategoryTabs: document.getElementById("emoji-category-tabs"),
      emojiPickerBody: document.getElementById("emoji-picker-body"),
      emojiPreviewChar: document.getElementById("emoji-preview-char"),
      emojiPreviewName: document.getElementById("emoji-preview-name"),

      // New Room Modal
      openCreateRoomBtn: document.getElementById("open-create-room-btn"),
      createRoomModal: document.getElementById("create-room-modal"),
      closeRoomModalBtn: document.getElementById("close-room-modal-btn"),
      cancelRoomBtn: document.getElementById("cancel-room-btn"),
      createRoomForm: document.getElementById("create-room-form"),
      roomNameInput: document.getElementById("room-name-input"),
      roomDescInput: document.getElementById("room-desc-input"),
      roomIconChoices: document.querySelectorAll(".icon-choice"),

      // Delete Room Confirmation Modal
      deleteRoomModal: document.getElementById("delete-room-modal"),
      deleteRoomNameTarget: document.getElementById("delete-room-name-target"),
      closeDeleteModalBtn: document.getElementById("close-delete-modal-btn"),
      cancelDeleteRoomBtn: document.getElementById("cancel-delete-room-btn"),
      confirmDeleteRoomBtn: document.getElementById("confirm-delete-room-btn"),

      // Command Palette (Ctrl+K)
      cmdPaletteModal: document.getElementById("cmd-palette-modal"),
      cmdPaletteInput: document.getElementById("cmd-palette-input"),
      cmdPaletteResults: document.getElementById("cmd-palette-results"),

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

    // Sound toggle
    this.updateSoundToggleUI();
    if (this.elements.soundToggleBtn) {
      this.elements.soundToggleBtn.addEventListener("click", () => {
        this.state.soundEnabled = !this.state.soundEnabled;
        localStorage.setItem("pulse_sound_enabled", this.state.soundEnabled);
        this.updateSoundToggleUI();
        if (this.state.soundEnabled) {
          this.playNotificationSound();
          this.showToast("Notification audio enabled", "info");
        } else {
          this.showToast("Notification audio muted", "info");
        }
      });
    }

    // Sidebar filter tabs (All / Channels / DMs)
    this.elements.filterTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        this.elements.filterTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.setSidebarFilter(tab.dataset.filter);
      });
    });

    // Mobile sidebar drawer & backdrop
    if (this.elements.mobileSidebarToggle) {
      this.elements.mobileSidebarToggle.addEventListener("click", () => {
        this.elements.appSidebar.classList.toggle("mobile-open");
        this.elements.mobileBackdrop.classList.toggle("hidden", !this.elements.appSidebar.classList.contains("mobile-open"));
      });
    }
    if (this.elements.mobileBackdrop) {
      this.elements.mobileBackdrop.addEventListener("click", () => {
        this.elements.appSidebar.classList.remove("mobile-open");
        this.elements.mobileBackdrop.classList.add("hidden");
      });
    }

    // Command Palette Trigger: Ctrl+K / Cmd+K or clicking search box
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.openCommandPalette();
      } else if (e.key === "Escape") {
        this.closeCommandPalette();
        this.hideDeleteModal();
        this.closeEmojiPicker();
      }
    });

    if (this.elements.sidebarSearchBox) {
      this.elements.sidebarSearchBox.addEventListener("click", () => {
        this.openCommandPalette();
      });
    }

    if (this.elements.cmdPaletteInput) {
      this.elements.cmdPaletteInput.addEventListener("input", (e) => {
        this.filterCommandPalette(e.target.value);
      });
      this.elements.cmdPaletteInput.addEventListener("keydown", (e) => {
        this.handleCommandPaletteKeydown(e);
      });
    }

    // Delete Room Custom Modal listeners
    if (this.elements.closeDeleteModalBtn) {
      this.elements.closeDeleteModalBtn.addEventListener("click", () => this.hideDeleteModal());
    }
    if (this.elements.cancelDeleteRoomBtn) {
      this.elements.cancelDeleteRoomBtn.addEventListener("click", () => this.hideDeleteModal());
    }
    if (this.elements.confirmDeleteRoomBtn) {
      this.elements.confirmDeleteRoomBtn.addEventListener("click", () => this.executeDeleteRoom());
    }

    // Sidebar search input inside sidebar
    if (this.elements.sidebarSearch) {
      this.elements.sidebarSearch.addEventListener("input", (e) => this.handleSearch(e.target.value));
    }

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

    // Full Emoji Picker Setup & Toggle
    this.setupEmojiPicker();
    this.elements.emojiToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleEmojiPicker();
    });

    document.addEventListener("click", (e) => {
      if (this.elements.emojiPopover && !this.elements.emojiPopover.contains(e.target) && !this.elements.emojiToggleBtn.contains(e.target)) {
        this.closeEmojiPicker();
      }
      if (this.elements.cmdPaletteModal && !this.elements.cmdPaletteModal.classList.contains("hidden")) {
        if (!this.elements.cmdPaletteModal.querySelector(".cmd-palette-card").contains(e.target) && e.target !== this.elements.sidebarSearchBox) {
          this.closeCommandPalette();
        }
      }
    });

    if (this.elements.closeEmojiPickerBtn) {
      this.elements.closeEmojiPickerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeEmojiPicker();
      });
    }

    // Delete group header button (creator only)
    if (this.elements.deleteRoomHeaderBtn) {
      this.elements.deleteRoomHeaderBtn.addEventListener("click", () => {
        if (this.state.activeChat?.type === "room") {
          this.confirmAndDeleteRoom(this.state.activeChat.id, this.state.activeChat.data.name);
        }
      });
    }

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
    wsClient.on("room:deleted", (data) => this.handleRoomDeleted(data));
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
      const isCreator = this.state.currentUser && room.created_by_id === this.state.currentUser.id;

      item.innerHTML = `
        <span class="item-icon">${room.icon || "💬"}</span>
        <span class="item-name">${room.name}</span>
        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
        ${isCreator ? `<button type="button" class="room-delete-btn" title="Delete Group (Only creator can delete)">🗑️</button>` : ''}
      `;

      if (isCreator) {
        const delBtn = item.querySelector(".room-delete-btn");
        if (delBtn) {
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.confirmAndDeleteRoom(room.id, room.name);
          });
        }
      }

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
      this.elements.chatTargetIcon.style.backgroundColor = "transparent";
      this.elements.chatTargetTitle.textContent = `#${room.name}`;
      this.elements.chatTargetDesc.textContent = room.description || "Room discussions";
      this.elements.chatTargetBadge.className = "chat-target-badge";
      this.elements.chatTargetBadge.textContent = "";

      // Privacy badge hidden in rooms
      if (this.elements.chatPrivacyBadge) {
        this.elements.chatPrivacyBadge.classList.add("hidden");
      }

      // Show Delete Group button ONLY if current user is the creator
      const isCreator = this.state.currentUser && room.created_by_id === this.state.currentUser.id;
      if (this.elements.deleteRoomHeaderBtn) {
        if (isCreator) {
          this.elements.deleteRoomHeaderBtn.classList.remove("hidden");
        } else {
          this.elements.deleteRoomHeaderBtn.classList.add("hidden");
        }
      }

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

      // Show Privacy Badge in 1-to-1 conversation
      if (this.elements.chatPrivacyBadge) {
        this.elements.chatPrivacyBadge.classList.remove("hidden");
      }

      // Hide group deletion button in 1-to-1 conversation
      if (this.elements.deleteRoomHeaderBtn) {
        this.elements.deleteRoomHeaderBtn.classList.add("hidden");
      }

      this.elements.chatInput.placeholder = `Direct message ${user.display_name}...`;

      // Update right panel
      this.renderUserDetails(user);

      // Load direct messages history
      await this.loadMessagesHistory();
    }

    // Auto-close mobile sidebar drawer on selection
    if (this.elements.appSidebar) {
      this.elements.appSidebar.classList.remove("mobile-open");
    }
    if (this.elements.mobileBackdrop) {
      this.elements.mobileBackdrop.classList.add("hidden");
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
    if (active.type === "room") {
      welcome.className = "channel-welcome-banner";
      welcome.innerHTML = `
        <h3>Welcome to #${active.data.name}!</h3>
        <p>This is the start of the #${active.data.name} room. All messages are stored permanently and delivered in real time.</p>
      `;
    } else {
      welcome.className = "privacy-banner-card";
      welcome.innerHTML = `
        <span style="font-size: 22px;">🔒</span>
        <div>
          <strong>End-to-End Private 1-on-1 Conversation</strong>
          <p style="margin-top: 3px; font-size: 12px; color: var(--text-secondary);">
            Messages here are confidential and isolated between you and <strong>${active.data.display_name}</strong> (@${active.data.username}).
          </p>
        </div>
      `;
    }
    this.elements.messagesContainer.appendChild(welcome);

    // If chat has no messages, show interactive prompt suggestions
    if (this.state.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state-card";
      const targetName = active.type === "room" ? `#${active.data.name}` : active.data.display_name;
      empty.innerHTML = `
        <div class="empty-state-icon">${active.type === 'room' ? (active.data.icon || '💬') : '💬'}</div>
        <div class="empty-state-title">No messages in ${targetName} yet</div>
        <div class="empty-state-desc">Break the ice! Choose a prompt below or start typing.</div>
        <div class="empty-state-suggestions">
          <button class="suggestion-chip" data-text="👋 Hello everyone!">👋 Hello everyone!</button>
          <button class="suggestion-chip" data-text="🚀 Sharing a quick project update...">🚀 Sharing an update</button>
          <button class="suggestion-chip" data-text="💡 Brainstorming session today?">💡 Brainstorm ideas</button>
          <button class="suggestion-chip" data-text="☕ Anyone free for a quick sync?">☕ Quick sync?</button>
        </div>
      `;
      empty.querySelectorAll(".suggestion-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          this.elements.chatInput.value = chip.dataset.text;
          this.elements.chatInput.focus();
          this.elements.chatForm.dispatchEvent(new Event("submit"));
        });
      });
      this.elements.messagesContainer.appendChild(empty);
      return;
    }

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
    row.className = `message-row ${isMe ? 'outgoing' : 'incoming'}`;
    row.dataset.msgId = msg.id;

    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formattedContent = this.formatMessageText(msg.content);

    row.innerHTML = `
      <div class="message-avatar" style="background-color: ${msg.sender_avatar_color || '#6366f1'}">
        ${msg.sender_display_name ? msg.sender_display_name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div class="message-content-wrap">
        <div class="message-reactions-bar">
          <button type="button" class="quick-react-btn" data-emoji="👍" title="React 👍">👍</button>
          <button type="button" class="quick-react-btn" data-emoji="❤️" title="React ❤️">❤️</button>
          <button type="button" class="quick-react-btn" data-emoji="😂" title="React 😂">😂</button>
          <button type="button" class="quick-react-btn" data-emoji="🚀" title="React 🚀">🚀</button>
          <button type="button" class="quick-react-btn" data-emoji="🔥" title="React 🔥">🔥</button>
        </div>
        <div class="message-meta">
          <span class="message-author">${isMe ? 'You' : msg.sender_display_name}</span>
          <span class="message-time">
            ${timeStr}
            ${isMe ? `<span class="read-receipt" title="Delivered & Read">✓✓</span>` : ''}
          </span>
        </div>
        <div class="message-bubble">
          <div class="message-text">${formattedContent}</div>
        </div>
        <div class="message-actions">
          <button class="msg-action-btn copy-btn" title="Copy message">📋</button>
        </div>
      </div>
    `;

    row.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(msg.content);
      this.showToast("Copied to clipboard", "success");
    });

    row.querySelectorAll(".quick-react-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.sendQuickReaction(btn.dataset.emoji);
      });
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
    // Privacy guarantee: ignore direct message if current user is neither sender nor recipient
    if (msg.sender_id !== this.state.currentUser?.id && msg.recipient_id !== this.state.currentUser?.id) {
      return;
    }

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

    // Strict 1-on-1 privacy check: only show typing indicator if the peer is typing TO current user
    const isMatch = (active.type === "room" && active.id === data.room_id) ||
                    (active.type === "direct" && active.id === data.user_id && data.recipient_id === this.state.currentUser?.id);

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

  handleRoomDeleted(data) {
    this.state.rooms.delete(data.room_id);
    this.renderRoomsList();

    if (this.state.activeChat?.type === "room" && this.state.activeChat.id === data.room_id) {
      this.showToast(`Room #${data.room_name} was deleted by its creator.`, "info");
      const remainingRooms = Array.from(this.state.rooms.values());
      if (remainingRooms.length > 0) {
        const generalRoom = remainingRooms.find(r => r.name === "general") || remainingRooms[0];
        this.selectChat("room", generalRoom.id);
      } else {
        this.state.activeChat = null;
        this.elements.messagesContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">No available channels. Create a new one!</div>';
      }
    }
  },

  confirmAndDeleteRoom(roomId, roomName) {
    this.state.pendingDeleteRoom = { id: roomId, name: roomName };
    if (this.elements.deleteRoomNameTarget) {
      this.elements.deleteRoomNameTarget.textContent = `#${roomName}`;
    }
    if (this.elements.deleteRoomModal) {
      this.elements.deleteRoomModal.classList.remove("hidden");
    }
  },

  hideDeleteModal() {
    this.state.pendingDeleteRoom = null;
    if (this.elements.deleteRoomModal) {
      this.elements.deleteRoomModal.classList.add("hidden");
    }
  },

  async executeDeleteRoom() {
    const pending = this.state.pendingDeleteRoom;
    if (!pending) return;

    try {
      if (this.elements.confirmDeleteRoomBtn) {
        this.elements.confirmDeleteRoomBtn.disabled = true;
        this.elements.confirmDeleteRoomBtn.textContent = "Deleting...";
      }

      await API.deleteRoom(pending.id);
      this.hideDeleteModal();
      this.handleRoomDeleted({ room_id: pending.id, room_name: pending.name });
      this.showToast(`Channel #${pending.name} deleted successfully.`, "success");
    } catch (err) {
      this.showToast(`Failed to delete room: ${err.message}`, "error");
    } finally {
      if (this.elements.confirmDeleteRoomBtn) {
        this.elements.confirmDeleteRoomBtn.disabled = false;
        this.elements.confirmDeleteRoomBtn.textContent = "Delete Channel";
      }
    }
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
    const isCreator = this.state.currentUser && room.created_by_id === this.state.currentUser.id;
    const creatorUser = room.created_by_id ? this.state.users.get(room.created_by_id) : null;
    const creatorName = isCreator ? "You" : (creatorUser ? creatorUser.display_name : "Workspace Admin");

    this.elements.detailsContent.innerHTML = `
      <div class="details-profile-card">
        <div class="details-avatar-lg" style="background: var(--accent-gradient);">
          ${room.icon || "💬"}
        </div>
        <div class="details-name">#${room.name}</div>
        <div class="details-bio">${room.description || "No topic set for this room"}</div>
        <div style="margin-top: 8px;">
          ${isCreator 
            ? `<div class="creator-badge">👑 You created this group</div>` 
            : `<div style="font-size: 11px; color: var(--text-muted);">🛡️ Created by ${creatorName} (Protected Group)</div>`
          }
        </div>
      </div>

      ${isCreator ? `
        <div style="margin-bottom: 20px;">
          <button id="delete-room-details-btn" class="btn-danger" type="button">
            <span>🗑️</span> Delete This Group
          </button>
          <div style="font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 6px;">
            Only the creator of this group has permission to delete it.
          </div>
        </div>
      ` : ''}

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

    if (isCreator) {
      const delBtn = document.getElementById("delete-room-details-btn");
      if (delBtn) {
        delBtn.addEventListener("click", () => this.confirmAndDeleteRoom(room.id, room.name));
      }
    }
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

      <!-- End-to-End Privacy Notice -->
      <div class="privacy-banner-card" style="margin-bottom: 20px;">
        <span style="font-size: 18px;">🔒</span>
        <div>
          <strong>Strictly Private Conversation</strong>
          <p style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">
            Messages exchanged here are visible only to you and @${user.username}. They are never shared with group channels.
          </p>
        </div>
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

  // Comprehensive Categorized Emoji Database ("Open all emojis")
  EMOJI_DATA: {
    smileys: [
      { char: "😀", name: "Grinning Face" },
      { char: "😃", name: "Grinning Face with Big Eyes" },
      { char: "😄", name: "Grinning Face with Smiling Eyes" },
      { char: "😁", name: "Beaming Face with Smiling Eyes" },
      { char: "😆", name: "Grinning Squinting Face" },
      { char: "😅", name: "Grinning Face with Sweat" },
      { char: "🤣", name: "Rolling on the Floor Laughing" },
      { char: "😂", name: "Face with Tears of Joy" },
      { char: "🙂", name: "Slightly Smiling Face" },
      { char: "🙃", name: "Upside-Down Face" },
      { char: "😉", name: "Winking Face" },
      { char: "😊", name: "Smiling Face with Smiling Eyes" },
      { char: "😇", name: "Smiling Face with Halo" },
      { char: "🥰", name: "Smiling Face with Hearts" },
      { char: "😍", name: "Heart Eyes" },
      { char: "🤩", name: "Star-Struck" },
      { char: "😘", name: "Face Blowing a Kiss" },
      { char: "😗", name: "Kissing Face" },
      { char: "😚", name: "Kissing Face with Closed Eyes" },
      { char: "😋", name: "Face Savoring Food" },
      { char: "😛", name: "Face with Tongue" },
      { char: "😜", name: "Winking Face with Tongue" },
      { char: "🤪", name: "Zany Face" },
      { char: "😝", name: "Squinting Face with Tongue" },
      { char: "🤗", name: "Hugging Face" },
      { char: "🤭", name: "Face with Hand Over Mouth" },
      { char: "🤫", name: "Shushing Face" },
      { char: "🤔", name: "Thinking Face" },
      { char: "🤐", name: "Zipper-Mouth Face" },
      { char: "🤨", name: "Face with Raised Eyebrow" },
      { char: "😐", name: "Neutral Face" },
      { char: "😑", name: "Expressionless Face" },
      { char: "😶", name: "Face Without Mouth" },
      { char: "😏", name: "Smirking Face" },
      { char: "😒", name: "Unamused Face" },
      { char: "🙄", name: "Face with Rolling Eyes" },
      { char: "😬", name: "Grimacing Face" },
      { char: "🤥", name: "Lying Face" },
      { char: "😌", name: "Relieved Face" },
      { char: "😔", name: "Pensive Face" },
      { char: "😪", name: "Sleepy Face" },
      { char: "🤤", name: "Drooling Face" },
      { char: "😴", name: "Sleeping Face" },
      { char: "😷", name: "Face with Medical Mask" },
      { char: "🤒", name: "Face with Thermometer" },
      { char: "🤕", name: "Face with Head-Bandage" },
      { char: "🤢", name: "Nauseated Face" },
      { char: "🤮", name: "Face Vomiting" },
      { char: "🥵", name: "Hot Face" },
      { char: "🥶", name: "Cold Face" },
      { char: "🥴", name: "Woozy Face" },
      { char: "😵", name: "Dizzy Face" },
      { char: "🤯", name: "Exploding Head" },
      { char: "🤠", name: "Cowboy Hat Face" },
      { char: "🥳", name: "Partying Face" },
      { char: "😎", name: "Sunglasses Face" },
      { char: "🤓", name: "Nerd Face" },
      { char: "🧐", name: "Face with Monocle" },
      { char: "😕", name: "Confused Face" },
      { char: "😟", name: "Worried Face" },
      { char: "😮", name: "Face with Open Mouth" },
      { char: "😲", name: "Astonished Face" },
      { char: "😳", name: "Flushed Face" },
      { char: "🥺", name: "Pleading Face" },
      { char: "😦", name: "Frowning Face" },
      { char: "😨", name: "Fearful Face" },
      { char: "😰", name: "Anxious Face with Sweat" },
      { char: "😥", name: "Sad but Relieved Face" },
      { char: "😢", name: "Crying Face" },
      { char: "😭", name: "Loudly Crying Face" },
      { char: "😱", name: "Face Screaming in Fear" },
      { char: "😖", name: "Confounded Face" },
      { char: "😣", name: "Persevering Face" },
      { char: "😞", name: "Disappointed Face" },
      { char: "😓", name: "Downcast Face with Sweat" },
      { char: "😩", name: "Weary Face" },
      { char: "😫", name: "Tired Face" },
      { char: "🥱", name: "Yawning Face" },
      { char: "😤", name: "Face with Steam From Nose" },
      { char: "😡", name: "Enraged Face" },
      { char: "😠", name: "Angry Face" },
      { char: "🤬", name: "Face with Symbols on Mouth" },
      { char: "😈", name: "Smiling Face with Horns" },
      { char: "👿", name: "Angry Face with Horns" },
      { char: "💀", name: "Skull" },
      { char: "💩", name: "Pile of Poo" },
      { char: "🤡", name: "Clown Face" },
      { char: "👻", name: "Ghost" },
      { char: "👽", name: "Alien" },
      { char: "🤖", name: "Robot" }
    ],
    people: [
      { char: "👋", name: "Waving Hand" },
      { char: "🤚", name: "Raised Back of Hand" },
      { char: "🖐", name: "Hand with Fingers Splayed" },
      { char: "✋", name: "Raised Hand" },
      { char: "🖖", name: "Vulcan Salute" },
      { char: "👌", name: "OK Hand" },
      { char: "🤏", name: "Pinching Hand" },
      { char: "✌️", name: "Victory Hand" },
      { char: "🤞", name: "Crossed Fingers" },
      { char: "🤟", name: "Love-You Gesture" },
      { char: "🤘", name: "Sign of the Horns" },
      { char: "🤙", name: "Call Me Hand" },
      { char: "👈", name: "Backhand Index Pointing Left" },
      { char: "👉", name: "Backhand Index Pointing Right" },
      { char: "👆", name: "Backhand Index Pointing Up" },
      { char: "👇", name: "Backhand Index Pointing Down" },
      { char: "☝️", name: "Index Pointing Up" },
      { char: "👍", name: "Thumbs Up" },
      { char: "👎", name: "Thumbs Down" },
      { char: "✊", name: "Raised Fist" },
      { char: "👊", name: "Oncoming Fist" },
      { char: "🤛", name: "Left-Facing Fist" },
      { char: "🤜", name: "Right-Facing Fist" },
      { char: "👏", name: "Clapping Hands" },
      { char: "🙌", name: "Raising Hands" },
      { char: "👐", name: "Open Hands" },
      { char: "🤲", name: "Palms Up Together" },
      { char: "🤝", name: "Handshake" },
      { char: "🙏", name: "Folded Hands" },
      { char: "✍️", name: "Writing Hand" },
      { char: "💅", name: "Nail Polish" },
      { char: "🤳", name: "Selfie" },
      { char: "💪", name: "Flexed Biceps" },
      { char: "🧠", name: "Brain" },
      { char: "👀", name: "Eyes" },
      { char: "👁️", name: "Eye" },
      { char: "👅", name: "Tongue" },
      { char: "👄", name: "Mouth" },
      { char: "💋", name: "Kiss Mark" },
      { char: "❤️", name: "Red Heart" },
      { char: "🧡", name: "Orange Heart" },
      { char: "💛", name: "Yellow Heart" },
      { char: "💚", name: "Green Heart" },
      { char: "💙", name: "Blue Heart" },
      { char: "💜", name: "Purple Heart" },
      { char: "🖤", name: "Black Heart" },
      { char: "🤍", name: "White Heart" },
      { char: "🤎", name: "Brown Heart" },
      { char: "💔", name: "Broken Heart" },
      { char: "💕", name: "Two Hearts" },
      { char: "💖", name: "Sparkling Heart" },
      { char: "🔥", name: "Fire" },
      { char: "✨", name: "Sparkles" },
      { char: "🌟", name: "Glowing Star" },
      { char: "⚡", name: "High Voltage" }
    ],
    animals: [
      { char: "🐶", name: "Dog Face" },
      { char: "🐱", name: "Cat Face" },
      { char: "🐭", name: "Mouse Face" },
      { char: "🐹", name: "Hamster Face" },
      { char: "🐰", name: "Rabbit Face" },
      { char: "🦊", name: "Fox" },
      { char: "🐻", name: "Bear" },
      { char: "🐼", name: "Panda" },
      { char: "🐨", name: "Koala" },
      { char: "🐯", name: "Tiger Face" },
      { char: "🦁", name: "Lion" },
      { char: "🐮", name: "Cow Face" },
      { char: "🐷", name: "Pig Face" },
      { char: "🐸", name: "Frog" },
      { char: "🐵", name: "Monkey Face" },
      { char: "🐔", name: "Chicken" },
      { char: "🐧", name: "Penguin" },
      { char: "🐦", name: "Bird" },
      { char: "🐤", name: "Baby Chick" },
      { char: "🦆", name: "Duck" },
      { char: "🦅", name: "Eagle" },
      { char: "🦉", name: "Owl" },
      { char: "🦇", name: "Bat" },
      { char: "🐺", name: "Wolf" },
      { char: "🐴", name: "Horse Face" },
      { char: "🦄", name: "Unicorn" },
      { char: "🐝", name: "Honeybee" },
      { char: "🐛", name: "Bug" },
      { char: "🦋", name: "Butterfly" },
      { char: "🐌", name: "Snail" },
      { char: "🐞", name: "Lady Beetle" },
      { char: "🐜", name: "Ant" },
      { char: "🐢", name: "Turtle" },
      { char: "🐍", name: "Snake" },
      { char: "🐙", name: "Octopus" },
      { char: "🐬", name: "Dolphin" },
      { char: "🐳", name: "Spouting Whale" },
      { char: "🦈", name: "Shark" },
      { char: "🐊", name: "Crocodile" },
      { char: "🐅", name: "Tiger" },
      { char: "🐆", name: "Leopard" },
      { char: "🦓", name: "Zebra" },
      { char: "🦍", name: "Gorilla" },
      { char: "🐘", name: "Elephant" },
      { char: "🦛", name: "Hippopotamus" },
      { char: "🦏", name: "Rhinoceros" },
      { char: "🐪", name: "Camel" },
      { char: "🦒", name: "Giraffe" },
      { char: "🦘", name: "Kangaroo" },
      { char: "🌲", name: "Evergreen Tree" },
      { char: "🌳", name: "Deciduous Tree" },
      { char: "🌴", name: "Palm Tree" },
      { char: "🌵", name: "Cactus" },
      { char: "🌷", name: "Tulip" },
      { char: "🌸", name: "Cherry Blossom" },
      { char: "🌹", name: "Rose" },
      { char: "🌺", name: "Hibiscus" },
      { char: "🌻", name: "Sunflower" },
      { char: "🌼", name: "Blossom" },
      { char: "🍀", name: "Four Leaf Clover" }
    ],
    food: [
      { char: "🍏", name: "Green Apple" },
      { char: "🍎", name: "Red Apple" },
      { char: "🍐", name: "Pear" },
      { char: "🍊", name: "Tangerine" },
      { char: "🍋", name: "Lemon" },
      { char: "🍌", name: "Banana" },
      { char: "🍉", name: "Watermelon" },
      { char: "🍇", name: "Grapes" },
      { char: "🍓", name: "Strawberry" },
      { char: "🫐", name: "Blueberries" },
      { char: "🍒", name: "Cherries" },
      { char: "🍑", name: "Peach" },
      { char: "🥭", name: "Mango" },
      { char: "🍍", name: "Pineapple" },
      { char: "🥥", name: "Coconut" },
      { char: "🥝", name: "Kiwi Fruit" },
      { char: "🍅", name: "Tomato" },
      { char: "🥑", name: "Avocado" },
      { char: "🥦", name: "Broccoli" },
      { char: "🌽", name: "Ear of Corn" },
      { char: "🥕", name: "Carrot" },
      { char: "🥐", name: "Croissant" },
      { char: "🍞", name: "Bread" },
      { char: "🥨", name: "Pretzel" },
      { char: "🧀", name: "Cheese Wedge" },
      { char: "🥚", name: "Egg" },
      { char: "🍳", name: "Cooking" },
      { char: "🥞", name: "Pancakes" },
      { char: "🥓", name: "Bacon" },
      { char: "🥩", name: "Cut of Meat" },
      { char: "🍗", name: "Poultry Leg" },
      { char: "🍔", name: "Hamburger" },
      { char: "🍟", name: "French Fries" },
      { char: "🍕", name: "Pizza" },
      { char: "🥪", name: "Sandwich" },
      { char: "🌮", name: "Taco" },
      { char: "🌯", name: "Burrito" },
      { char: "🥗", name: "Green Salad" },
      { char: "🍝", name: "Spaghetti" },
      { char: "🍜", name: "Steaming Bowl" },
      { char: "🍲", name: "Pot of Food" },
      { char: "🍛", name: "Curry Rice" },
      { char: "🍣", name: "Sushi" },
      { char: "🍱", name: "Bento Box" },
      { char: "🥟", name: "Dumpling" },
      { char: "🍤", name: "Fried Shrimp" },
      { char: "🍦", name: "Soft Ice Cream" },
      { char: "🍩", name: "Doughnut" },
      { char: "🍪", name: "Cookie" },
      { char: "🎂", name: "Birthday Cake" },
      { char: "🍰", name: "Shortcake" },
      { char: "🧁", name: "Cupcake" },
      { char: "🍫", name: "Chocolate Bar" },
      { char: "🍿", name: "Popcorn" },
      { char: "☕", name: "Hot Beverage" },
      { char: "🍵", name: "Teacup" },
      { char: "🧃", name: "Beverage Box" },
      { char: "🥤", name: "Cup with Straw" },
      { char: "🧋", name: "Bubble Tea" },
      { char: "🍺", name: "Beer Mug" },
      { char: "🍻", name: "Clinking Beer Mugs" },
      { char: "🥂", name: "Clinking Glasses" },
      { char: "🍷", name: "Wine Glass" }
    ],
    activities: [
      { char: "⚽", name: "Soccer Ball" },
      { char: "🏀", name: "Basketball" },
      { char: "🏈", name: "American Football" },
      { char: "⚾", name: "Baseball" },
      { char: "🎾", name: "Tennis" },
      { char: "🏐", name: "Volleyball" },
      { char: "🏉", name: "Rugby Football" },
      { char: "🥏", name: "Flying Disc" },
      { char: "🎱", name: "Pool 8 Ball" },
      { char: "🏓", name: "Ping Pong" },
      { char: "🏸", name: "Badminton" },
      { char: "🏒", name: "Ice Hockey" },
      { char: "🏏", name: "Cricket" },
      { char: "⛳", name: "Golf" },
      { char: "🏹", name: "Bow and Arrow" },
      { char: "🎣", name: "Fishing" },
      { char: "🥊", name: "Boxing Glove" },
      { char: "🥋", name: "Martial Arts" },
      { char: "🛹", name: "Skateboard" },
      { char: "🛼", name: "Roller Skate" },
      { char: "🎿", name: "Skis" },
      { char: "🏂", name: "Snowboarder" },
      { char: "🏋️", name: "Weight Lifting" },
      { char: "🏄", name: "Surfing" },
      { char: "🏊", name: "Swimming" },
      { char: "🚴", name: "Biking" },
      { char: "🏆", name: "Trophy" },
      { char: "🥇", name: "1st Place Medal" },
      { char: "🥈", name: "2nd Place Medal" },
      { char: "🥉", name: "3rd Place Medal" },
      { char: "🏅", name: "Sports Medal" },
      { char: "🎟️", name: "Admission Tickets" },
      { char: "🎪", name: "Circus Tent" },
      { char: "🎭", name: "Performing Arts" },
      { char: "🎨", name: "Artist Palette" },
      { char: "🎬", name: "Clapper Board" },
      { char: "🎤", name: "Microphone" },
      { char: "🎧", name: "Headphone" },
      { char: "🎼", name: "Musical Score" },
      { char: "🎹", name: "Musical Keyboard" },
      { char: "🥁", name: "Drum" },
      { char: "🎷", name: "Saxophone" },
      { char: "🎸", name: "Guitar" },
      { char: "🎲", name: "Game Die" },
      { char: "🎯", name: "Bullseye" },
      { char: "🎳", name: "Bowling" },
      { char: "🎮", name: "Video Game" },
      { char: "🎰", name: "Slot Machine" },
      { char: "🧩", name: "Puzzle Piece" }
    ],
    objects: [
      { char: "💡", name: "Light Bulb" },
      { char: "🔦", name: "Flashlight" },
      { char: "🕯️", name: "Candle" },
      { char: "📱", name: "Mobile Phone" },
      { char: "💻", name: "Laptop" },
      { char: "🖥️", name: "Desktop Computer" },
      { char: "🖨️", name: "Printer" },
      { char: "⌨️", name: "Keyboard" },
      { char: "🖱️", name: "Mouse" },
      { char: "📷", name: "Camera" },
      { char: "🎥", name: "Movie Camera" },
      { char: "📺", name: "Television" },
      { char: "📻", name: "Radio" },
      { char: "🔍", name: "Magnifying Glass Left" },
      { char: "🔎", name: "Magnifying Glass Right" },
      { char: "🔮", name: "Crystal Ball" },
      { char: "💎", name: "Gem Stone" },
      { char: "⏳", name: "Hourglass Done" },
      { char: "⌛", name: "Hourglass Running" },
      { char: "⏰", name: "Alarm Clock" },
      { char: "⏱️", name: "Stopwatch" },
      { char: "🎁", name: "Wrapped Gift" },
      { char: "🎈", name: "Balloon" },
      { char: "🎉", name: "Party Popper" },
      { char: "🎊", name: "Confetti Ball" },
      { char: "✉️", name: "Envelope" },
      { char: "📦", name: "Package" },
      { char: "📝", name: "Memo" },
      { char: "📁", name: "File Folder" },
      { char: "📂", name: "Open File Folder" },
      { char: "📅", name: "Calendar" },
      { char: "📌", name: "Pushpin" },
      { char: "📍", name: "Round Pushpin" },
      { char: "📎", name: "Paperclip" },
      { char: "🔒", name: "Locked" },
      { char: "🔓", name: "Unlocked" },
      { char: "🔑", name: "Key" },
      { char: "🗝️", name: "Old Key" },
      { char: "🔨", name: "Hammer" },
      { char: "🔧", name: "Wrench" },
      { char: "⚙️", name: "Gear" },
      { char: "🧱", name: "Brick" },
      { char: "💣", name: "Bomb" },
      { char: "🛡️", name: "Shield" },
      { char: "🚗", name: "Car" },
      { char: "🚕", name: "Taxi" },
      { char: "🚙", name: "SUV" },
      { char: "🚌", name: "Bus" },
      { char: "🏎️", name: "Racing Car" },
      { char: "🚓", name: "Police Car" },
      { char: "🚑", name: "Ambulance" },
      { char: "🚒", name: "Fire Engine" },
      { char: "🏍️", name: "Motorcycle" },
      { char: "🚲", name: "Bicycle" },
      { char: "🚀", name: "Rocket" },
      { char: "🛸", name: "Flying Saucer" },
      { char: "🚁", name: "Helicopter" },
      { char: "⛵", name: "Sailboat" },
      { char: "🚤", name: "Speedboat" },
      { char: "🛳️", name: "Passenger Ship" },
      { char: "⚓", name: "Anchor" }
    ],
    symbols: [
      { char: "❤️", name: "Red Heart" },
      { char: "🧡", name: "Orange Heart" },
      { char: "💛", name: "Yellow Heart" },
      { char: "💚", name: "Green Heart" },
      { char: "💙", name: "Blue Heart" },
      { char: "💜", name: "Purple Heart" },
      { char: "🖤", name: "Black Heart" },
      { char: "🤍", name: "White Heart" },
      { char: "🤎", name: "Brown Heart" },
      { char: "💔", name: "Broken Heart" },
      { char: "❣️", name: "Heart Exclamation" },
      { char: "💕", name: "Two Hearts" },
      { char: "💞", name: "Revolving Hearts" },
      { char: "💓", name: "Beating Heart" },
      { char: "💗", name: "Growing Heart" },
      { char: "💖", name: "Sparkling Heart" },
      { char: "💘", name: "Heart with Arrow" },
      { char: "💝", name: "Heart with Ribbon" },
      { char: "⚠️", name: "Warning" },
      { char: "🛑", name: "Stop Sign" },
      { char: "⛔", name: "No Entry" },
      { char: "🚫", name: "Prohibited" },
      { char: "💯", name: "Hundred Points" },
      { char: "💢", name: "Anger Symbol" },
      { char: "♨️", name: "Hot Springs" },
      { char: "❗", name: "Exclamation Mark" },
      { char: "❓", name: "Question Mark" },
      { char: "‼️", name: "Double Exclamation Mark" },
      { char: "⁉️", name: "Exclamation Question Mark" },
      { char: "✅", name: "Check Mark Button" },
      { char: "❇️", name: "Sparkle" },
      { char: "✳️", name: "Eight-Spoked Asterisk" },
      { char: "❎", name: "Cross Mark Button" },
      { char: "🌐", name: "Globe with Meridians" },
      { char: "💤", name: "Zzz" },
      { char: "🏧", name: "ATM Sign" },
      { char: "🚾", name: "Water Closet" },
      { char: "♿", name: "Wheelchair Symbol" },
      { char: "🅿️", name: "P Button" },
      { char: "📶", name: "Antenna Bars" },
      { char: "🆖", name: "NG Button" },
      { char: "🆗", name: "OK Button" },
      { char: "🆙", name: "UP! Button" },
      { char: "🆒", name: "COOL Button" },
      { char: "🆕", name: "NEW Button" },
      { char: "🆓", name: "FREE Button" },
      { char: "0️⃣", name: "Keycap 0" },
      { char: "1️⃣", name: "Keycap 1" },
      { char: "2️⃣", name: "Keycap 2" },
      { char: "3️⃣", name: "Keycap 3" },
      { char: "4️⃣", name: "Keycap 4" },
      { char: "5️⃣", name: "Keycap 5" },
      { char: "6️⃣", name: "Keycap 6" },
      { char: "7️⃣", name: "Keycap 7" },
      { char: "8️⃣", name: "Keycap 8" },
      { char: "9️⃣", name: "Keycap 9" },
      { char: "🔟", name: "Keycap 10" },
      { char: "▶️", name: "Play Button" },
      { char: "⏸️", name: "Pause Button" },
      { char: "⏹️", name: "Stop Button" },
      { char: "🔁", name: "Repeat Button" },
      { char: "🔀", name: "Shuffle Tracks Button" },
      { char: "🎵", name: "Musical Note" },
      { char: "🎶", name: "Musical Notes" },
      { char: "➕", name: "Plus" },
      { char: "➖", name: "Minus" },
      { char: "➗", name: "Divide" },
      { char: "✖️", name: "Multiply" },
      { char: "♾️", name: "Infinity" },
      { char: "💲", name: "Heavy Dollar Sign" },
      { char: "🏁", name: "Chequered Flag" },
      { char: "🚩", name: "Triangular Flag" },
      { char: "🏳️‍🌈", name: "Rainbow Flag" }
    ]
  },

  activeEmojiCategory: "smileys",

  setupEmojiPicker() {
    this.renderEmojiCategory(this.activeEmojiCategory);

    // Tab buttons
    document.querySelectorAll(".emoji-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".emoji-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeEmojiCategory = btn.dataset.category;
        if (this.elements.emojiSearchInput.value.trim()) {
          this.elements.emojiSearchInput.value = "";
          this.elements.emojiSearchClear.classList.add("hidden");
        }
        this.renderEmojiCategory(this.activeEmojiCategory);
      });
    });

    // Search input
    if (this.elements.emojiSearchInput) {
      this.elements.emojiSearchInput.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (q) {
          this.elements.emojiSearchClear.classList.remove("hidden");
          this.searchEmojis(q);
        } else {
          this.elements.emojiSearchClear.classList.add("hidden");
          this.renderEmojiCategory(this.activeEmojiCategory);
        }
      });
    }

    // Clear search
    if (this.elements.emojiSearchClear) {
      this.elements.emojiSearchClear.addEventListener("click", () => {
        this.elements.emojiSearchInput.value = "";
        this.elements.emojiSearchClear.classList.add("hidden");
        this.renderEmojiCategory(this.activeEmojiCategory);
        this.elements.emojiSearchInput.focus();
      });
    }
  },

  toggleEmojiPicker() {
    const isHidden = this.elements.emojiPopover.classList.contains("hidden");
    if (isHidden) {
      this.elements.emojiPopover.classList.remove("hidden");
      if (this.elements.emojiSearchInput) {
        this.elements.emojiSearchInput.focus();
      }
    } else {
      this.closeEmojiPicker();
    }
  },

  closeEmojiPicker() {
    if (this.elements.emojiPopover) {
      this.elements.emojiPopover.classList.add("hidden");
    }
  },

  renderEmojiCategory(catKey) {
    if (!this.elements.emojiPickerBody) return;
    const emojis = this.EMOJI_DATA[catKey] || [];
    this.elements.emojiPickerBody.innerHTML = `
      <div class="emoji-category-title">${catKey.toUpperCase()} (${emojis.length})</div>
      <div class="emoji-grid">
        ${emojis.map(e => `
          <div class="emoji-grid-item" data-char="${e.char}" data-name="${e.name}" title="${e.name}">
            ${e.char}
          </div>
        `).join('')}
      </div>
    `;
    this.attachEmojiClickHandlers();
  },

  searchEmojis(query) {
    if (!this.elements.emojiPickerBody) return;
    const results = [];
    Object.values(this.EMOJI_DATA).forEach(list => {
      list.forEach(e => {
        if (e.name.toLowerCase().includes(query)) {
          results.push(e);
        }
      });
    });

    if (results.length === 0) {
      this.elements.emojiPickerBody.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">
          No emojis found for "${query}"
        </div>
      `;
      return;
    }

    this.elements.emojiPickerBody.innerHTML = `
      <div class="emoji-category-title">Matching Emojis (${results.length})</div>
      <div class="emoji-grid">
        ${results.map(e => `
          <div class="emoji-grid-item" data-char="${e.char}" data-name="${e.name}" title="${e.name}">
            ${e.char}
          </div>
        `).join('')}
      </div>
    `;
    this.attachEmojiClickHandlers();
  },

  attachEmojiClickHandlers() {
    this.elements.emojiPickerBody.querySelectorAll(".emoji-grid-item").forEach(item => {
      item.addEventListener("click", () => {
        const char = item.dataset.char;
        this.insertEmoji(char);
      });

      item.addEventListener("mouseenter", () => {
        if (this.elements.emojiPreviewChar) {
          this.elements.emojiPreviewChar.textContent = item.dataset.char;
        }
        if (this.elements.emojiPreviewName) {
          this.elements.emojiPreviewName.textContent = item.dataset.name;
        }
      });
    });
  },

  insertEmoji(char) {
    const input = this.elements.chatInput;
    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const text = input.value;
    input.value = text.substring(0, start) + char + text.substring(end);
    input.selectionStart = input.selectionEnd = start + char.length;
    input.focus();
    input.dispatchEvent(new Event("input"));
    this.closeEmojiPicker();
  },

  playNotificationSound() {
    if (!this.state.soundEnabled) return;
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

  updateSoundToggleUI() {
    if (!this.elements.soundToggleIcon) return;
    if (this.state.soundEnabled) {
      this.elements.soundToggleIcon.textContent = "🔔";
      this.elements.soundToggleBtn?.classList.remove("muted");
      this.elements.soundToggleBtn?.setAttribute("title", "Audio notifications enabled (Click to mute)");
    } else {
      this.elements.soundToggleIcon.textContent = "🔕";
      this.elements.soundToggleBtn?.classList.add("muted");
      this.elements.soundToggleBtn?.setAttribute("title", "Audio notifications muted (Click to enable)");
    }
  },

  setSidebarFilter(filter) {
    this.state.sidebarFilter = filter;
    const showRooms = filter === "all" || filter === "channels";
    const showDms = filter === "all" || filter === "direct";

    if (this.elements.headerSectionRooms) {
      this.elements.headerSectionRooms.style.display = showRooms ? "flex" : "none";
    }
    if (this.elements.channelList) {
      this.elements.channelList.style.display = showRooms ? "flex" : "none";
    }
    if (this.elements.headerSectionDms) {
      this.elements.headerSectionDms.style.display = showDms ? "flex" : "none";
    }
    if (this.elements.userList) {
      this.elements.userList.style.display = showDms ? "flex" : "none";
    }
  },

  async sendQuickReaction(emoji) {
    const active = this.state.activeChat;
    if (!active) return;

    try {
      if (active.type === "room") {
        const sentViaWs = wsClient.sendRoomMessage(active.id, emoji);
        if (!sentViaWs) await API.sendRoomMessage(active.id, emoji);
      } else {
        const sentViaWs = wsClient.sendDirectMessage(active.id, emoji);
        if (!sentViaWs) await API.sendDirectMessage(active.id, emoji);
      }
    } catch (err) {
      this.showToast("Failed to react: " + err.message, "error");
    }
  },

  openCommandPalette() {
    if (!this.elements.cmdPaletteModal) return;
    this.elements.cmdPaletteModal.classList.remove("hidden");
    if (this.elements.cmdPaletteInput) {
      this.elements.cmdPaletteInput.value = "";
      this.elements.cmdPaletteInput.focus();
    }
    this.filterCommandPalette("");
  },

  closeCommandPalette() {
    if (!this.elements.cmdPaletteModal) return;
    this.elements.cmdPaletteModal.classList.add("hidden");
  },

  filterCommandPalette(query) {
    const q = (query || "").toLowerCase().trim();
    const items = [];

    // Add channels
    this.state.rooms.forEach(room => {
      if (!q || room.name.toLowerCase().includes(q) || (room.description && room.description.toLowerCase().includes(q))) {
        items.push({
          type: "room",
          id: room.id,
          title: `#${room.name}`,
          sub: room.description || "Channel",
          icon: room.icon || "💬",
          badge: "Channel"
        });
      }
    });

    // Add colleagues
    this.state.users.forEach(user => {
      if (user.id !== this.state.currentUser?.id) {
        if (!q || user.display_name.toLowerCase().includes(q) || user.username.toLowerCase().includes(q)) {
          items.push({
            type: "direct",
            id: user.id,
            title: user.display_name,
            sub: `@${user.username} • ${user.is_online ? 'Online' : 'Offline'}`,
            icon: user.display_name.charAt(0).toUpperCase(),
            color: user.avatar_color || "#6366f1",
            badge: "Direct"
          });
        }
      }
    });

    this.state.cmdPaletteItems = items;
    this.state.cmdPaletteActiveIndex = 0;
    this.renderCommandPaletteResults();
  },

  renderCommandPaletteResults() {
    const container = this.elements.cmdPaletteResults;
    if (!container) return;

    if (this.state.cmdPaletteItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">
          No channels or colleagues match your search
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.cmdPaletteItems.map((item, idx) => `
      <div class="cmd-palette-item ${idx === this.state.cmdPaletteActiveIndex ? 'active' : ''}" data-idx="${idx}">
        <div class="cmd-palette-item-icon" style="${item.color ? `background-color: ${item.color}; color: #fff; font-weight: 700;` : ''}">
          ${item.icon}
        </div>
        <div class="cmd-palette-item-content">
          <div class="cmd-palette-item-title">${item.title}</div>
          <div class="cmd-palette-item-sub">${item.sub}</div>
        </div>
        <span class="cmd-palette-item-badge">${item.badge}</span>
      </div>
    `).join('');

    container.querySelectorAll(".cmd-palette-item").forEach(el => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.idx, 10);
        this.selectCommandPaletteItem(idx);
      });
      el.addEventListener("mouseenter", () => {
        this.state.cmdPaletteActiveIndex = parseInt(el.dataset.idx, 10);
        container.querySelectorAll(".cmd-palette-item").forEach((it, i) => {
          it.classList.toggle("active", i === this.state.cmdPaletteActiveIndex);
        });
      });
    });
  },

  handleCommandPaletteKeydown(e) {
    const total = this.state.cmdPaletteItems.length;
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.state.cmdPaletteActiveIndex = (this.state.cmdPaletteActiveIndex + 1) % total;
      this.renderCommandPaletteResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.state.cmdPaletteActiveIndex = (this.state.cmdPaletteActiveIndex - 1 + total) % total;
      this.renderCommandPaletteResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.selectCommandPaletteItem(this.state.cmdPaletteActiveIndex);
    }
  },

  selectCommandPaletteItem(idx) {
    const item = this.state.cmdPaletteItems[idx];
    if (!item) return;

    this.closeCommandPalette();
    this.selectChat(item.type, item.id);
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
