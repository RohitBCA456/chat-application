// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let isSocketReady = false;
const pendingMessages = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Initialize chat when DOM loads
document.addEventListener("DOMContentLoaded", initializeChat);

/* ========== CORE FUNCTIONS ========== */

function initializeChat() {
  try {
    // Load and validate user data
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user data found");
    
    currentUser = JSON.parse(userData);
    if (!currentUser?.roomId || !currentUser?.username) {
      throw new Error("Invalid user data");
    }
    currentRoomId = currentUser.roomId;

    // Setup UI and connections
    updateUI();
    setupSocketConnection();
    setupEventListeners();

  } catch (error) {
    console.error("Initialization error:", error);
    alert("Error initializing chat: " + error.message);
    redirectToMainPage();
  }
}

function setupSocketConnection() {
  // Cleanup previous connection if exists
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  // Configure new connection
  socket = io("https://chat-application-howg.onrender.com", {
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    auth: {
      username: currentUser.username,
      roomId: currentRoomId,
      lastDisconnect: performance.now()
    }
  });

  // Connection event handlers
  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("reconnect", handleReconnect);
  socket.on("reconnecting", handleReconnecting);
  socket.on("reconnect_failed", handleReconnectFailed);
  
  // Message handlers
  socket.on("load-messages", handleLoadMessages);
  socket.on("new-message", handleNewMessage);
  socket.on("room-deleted", handleRoomDeleted);

  // Heartbeat monitoring
  startHeartbeat();
  startLatencyMonitoring();
}

function setupEventListeners() {
  // Message input handler
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Window beforeunload handler
  window.addEventListener("beforeunload", () => {
    if (socket) socket.emit("leave-room", currentRoomId);
  });
}

/* ========== SOCKET EVENT HANDLERS ========== */

function handleConnect() {
  console.log("✅ Connected to server with ID:", socket.id);
  isSocketReady = true;
  reconnectAttempts = 0;
  updateConnectionStatus("connected");
  
  socket.emit("join-room", currentRoomId, currentUser.username, (response) => {
    if (response?.status !== "success") {
      console.error("Join room failed:", response?.message);
      handleConnectionFailure();
    }
  });
}

function handleDisconnect(reason) {
  console.log("Disconnected:", reason);
  isSocketReady = false;
  updateConnectionStatus("disconnected");
  
  if (reason === "io server disconnect") {
    setTimeout(() => socket.connect(), 1000);
  }
}

function handleReconnect(attempt) {
  console.log(`♻️ Reconnected after ${attempt} attempts`);
  isSocketReady = true;
  updateConnectionStatus("connected");
}

function handleReconnecting(attempt) {
  console.log(`Attempting to reconnect (${attempt})...`);
  updateConnectionStatus("reconnecting");
}

function handleReconnectFailed() {
  console.error("Reconnection failed");
  updateConnectionStatus("disconnected");
  alert("Connection lost. Please refresh the page.");
  window.location.reload();
}

function handleLoadMessages(messages) {
  const chat = document.getElementById("chat");
  chat.innerHTML = messages.map(msg => createMessageElement(msg)).join("");
  chat.scrollTop = chat.scrollHeight;
}

function handleNewMessage(message) {
  const chat = document.getElementById("chat");
  
  // Check if this replaces a pending message
  if (message.tempId && pendingMessages.has(message.tempId)) {
    const tempEl = document.querySelector(`[data-id="${message.tempId}"]`);
    if (tempEl) {
      tempEl.dataset.id = message._id;
      tempEl.querySelector(".timestamp").textContent = formatTime(message.createdAt);
      pendingMessages.delete(message.tempId);
      return;
    }
  }
  
  // Only add if new message and not from current user
  if (!document.querySelector(`[data-id="${message._id}"]`) && 
      message.sender !== currentUser.username) {
    chat.insertAdjacentHTML("beforeend", createMessageElement(message));
    chat.scrollTop = chat.scrollHeight;
  }
}

function handleRoomDeleted() {
  alert("Room deleted by owner. Redirecting...");
  redirectToMainPage();
}

/* ========== MESSAGE FUNCTIONS ========== */

function sendMessage() {
  if (!isSocketReady) {
    showTemporaryMessage("Connecting... Please wait");
    return;
  }

  const input = document.getElementById("message");
  const content = input.value.trim();
  if (!content) return;

  // Create temporary message
  const tempId = "temp-" + Date.now();
  pendingMessages.set(tempId, true);
  
  const chat = document.getElementById("chat");
  chat.insertAdjacentHTML("beforeend", createMessageElement({
    _id: tempId,
    sender: currentUser.username,
    content,
    createdAt: new Date()
  }));
  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  // Send to server with delivery tracking
  socket.emit("send-message", {
    content,
    roomId: currentRoomId,
    username: currentUser.username,
    tempId
  }, (response) => {
    if (response?.status === "failed") {
      document.querySelector(`[data-id="${tempId}"]`)?.remove();
      pendingMessages.delete(tempId);
      showTemporaryMessage("Failed to send: " + response.message);
    }
  });
}

function createMessageElement(message) {
  const isCurrentUser = message.sender === currentUser.username;
  return `
    <div class="message ${isCurrentUser ? "mine" : "other"}" data-id="${message._id || message.tempId}">
      <div class="message-content">
        <p><strong>${message.sender}:</strong> <span>${linkify(message.content)}</span></p>
      </div>
      <div class="timestamp">${formatTime(message.createdAt)}</div>
    </div>
  `;
}

/* ========== UTILITY FUNCTIONS ========== */

function updateUI() {
  document.getElementById("room-id").textContent = currentRoomId;
  document.getElementById("username").textContent = currentUser.username;
  document.getElementById(
    currentUser.isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";
}

function updateConnectionStatus(status) {
  const statusElement = document.getElementById("connection-status") || createStatusElement();
  statusElement.className = `connection-status ${status}`;
  statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

function createStatusElement() {
  const element = document.createElement("div");
  element.id = "connection-status";
  document.body.appendChild(element);
  return element;
}

function showTemporaryMessage(text) {
  const chat = document.getElementById("chat");
  const msg = document.createElement("div");
  msg.className = "system-message";
  msg.textContent = text;
  chat.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

function startHeartbeat() {
  setInterval(() => {
    if (socket.connected) {
      socket.emit("heartbeat");
    }
  }, 20000);
}

function startLatencyMonitoring() {
  setInterval(() => {
    if (socket.connected) {
      const start = Date.now();
      socket.emit("latency-check", () => {
        const latency = Date.now() - start;
        console.log("Current latency:", latency + "ms");
      });
    }
  }, 30000);
}

function handleConnectionFailure() {
  setTimeout(() => {
    if (!isSocketReady) {
      alert("Connection issues. Please refresh the page.");
      redirectToMainPage();
    }
  }, 5000);
}

function redirectToMainPage() {
  localStorage.removeItem("user");
  if (socket) socket.disconnect();
  window.location.href = "mainPage.html";
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

function linkify(text) {
  return typeof text === "string" 
    ? text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank">${url}</a>`)
    : text;
}

/* ========== UI ACTION HANDLERS ========== */

window.deleteRoom = () => {
  if (confirm("Are you sure you want to delete this room?")) {
    socket.emit("delete-room", currentRoomId, redirectToMainPage);
  }
};

window.leaveRoom = () => {
  if (confirm("Are you sure you want to leave the room?")) {
    socket.emit("leave-room", currentRoomId, redirectToMainPage);
  }
};