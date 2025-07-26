// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let isSocketReady = false;
const pendingMessages = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let latestMessageId = null;

function startBackupPolling(interval = 5000) {
  setInterval(() => {
    if (!isSocketReady || !socket.connected) {
      fetchLatestMessagesFromServer();
    }
  }, interval);
}

// Initialize chat when DOM loads
document.addEventListener("DOMContentLoaded", initializeChat);

/* ========== CORE FUNCTIONS ========== */

function initializeChat() {
  try {
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user data found");

    currentUser = JSON.parse(userData);
    if (!currentUser?.roomId || !currentUser?.username) {
      throw new Error("Invalid user data");
    }

    currentRoomId = currentUser.roomId;

    updateUI();
    setupSocketConnection();
    setupEventListeners();
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Error initializing chat: " + error.message);
    redirectToMainPage();
  }
  startBackupPolling();
}

function setupSocketConnection() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io("https://chat-application-howg.onrender.com", {
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000,
    transports: ["websocket", "polling"],
    auth: {
      username: currentUser.username,
      roomId: currentRoomId,
      lastDisconnect: performance.now(),
    },
  });

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("reconnect", handleReconnect);
  socket.on("reconnecting", handleReconnecting);
  socket.on("reconnect_failed", handleReconnectFailed);

  socket.on("load-messages", handleLoadMessages);
  socket.on("new-message", handleNewMessage);
  socket.on("room-deleted", handleRoomDeleted);
  socket.on("leave-room-success", handleLeaveRoomSuccess);

  startHeartbeat();
  startLatencyMonitoring();
}

async function fetchLatestMessagesFromServer() {
  if (!currentRoomId) return;

  try {
    const res = await fetch(
      `https://chat-application-howg.onrender.com/messages/${currentRoomId}`
    );
    if (!res.ok) throw new Error("Failed to fetch");

    const messages = await res.json();

    // Filter out already displayed messages by ID
    const newMessages = messages.filter((msg) => {
      return !document.querySelector(`[data-id="${msg._id}"]`);
    });

    if (newMessages.length) {
      console.log(
        "🌀 Fallback polling found new messages:",
        newMessages.length
      );
      const chat = document.getElementById("chat");
      newMessages.forEach((msg) => {
        chat.insertAdjacentHTML("beforeend", createMessageElement(msg));
      });
      chat.scrollTop = chat.scrollHeight;
    }
  } catch (error) {
    console.error("Fallback polling failed:", error);
  }
}

function setupEventListeners() {
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  document
    .getElementById("leave-room-btn")
    ?.addEventListener("click", handleLeaveRoom);
  document
    .getElementById("delete-room-btn")
    ?.addEventListener("click", handleDeleteRoom);
}

/* ========== SOCKET EVENT HANDLERS ========== */

function handleConnect() {
  console.log("✅ Connected to server with ID:", socket.id);
  isSocketReady = true;
  reconnectAttempts = 0;

  // Ensure we have all required data before joining
  if (!currentRoomId || !currentUser?.username) {
    console.error("Missing room ID or username");
    return;
  }

  // Immediate join attempt with retry logic
  const joinRoomWithRetry = (attempt = 1) => {
    if (attempt > 5) {
      console.error("❌ Failed to join room after multiple attempts");
      alert("Failed to join room. Please refresh the page.");
      return;
    }

    socket.emit(
      "join-room",
      currentRoomId,
      currentUser.username,
      (response) => {
        if (response?.status === "success") {
          console.log("✅ Successfully joined room");
          // Clear any pending messages
          pendingMessages.clear();
        } else {
          console.warn(
            `⚠️ Join room failed (attempt ${attempt}):`,
            response?.message
          );
          setTimeout(() => joinRoomWithRetry(attempt + 1), 500 * attempt);
        }
      }
    );
  };

  joinRoomWithRetry();
}

function handleDisconnect(reason) {
  console.log("Disconnected:", reason);
  isSocketReady = false;

  if (reason === "io server disconnect") {
    setTimeout(() => socket.connect(), 1000);
  }
}

function handleReconnect(attempt) {
  console.log(`♻️ Reconnected after ${attempt} attempts`);
  isSocketReady = true;
}

function handleReconnecting(attempt) {
  console.log(`Attempting to reconnect (${attempt})...`);
}

function handleReconnectFailed() {
  console.error("Reconnection failed");
  alert("Connection lost. Please refresh the page.");
  window.location.reload();
}

function handleLoadMessages(messages) {
  const chat = document.getElementById("chat");
  chat.innerHTML = messages.map((msg) => createMessageElement(msg)).join("");
  chat.scrollTop = chat.scrollHeight;
}

function handleNewMessage(message) {
  const chat = document.getElementById("chat");

  // Reconcile optimistic message with server-confirmed one
  if (message.tempId && pendingMessages.has(message.tempId)) {
    const tempEl = document.querySelector(`[data-id="${message.tempId}"]`);
    if (tempEl) {
      tempEl.dataset.id = message._id;
      tempEl.querySelector(".timestamp").textContent = formatTime(
        message.createdAt
      );
      pendingMessages.delete(message.tempId);
      return;
    }
  }

  // ❌ This is the issue: it ignores your own messages if tempId failed or missed
  const exists = document.querySelector(`[data-id="${message._id}"]`);
  if (!exists) {
    chat.insertAdjacentHTML("beforeend", createMessageElement(message));
    chat.scrollTop = chat.scrollHeight;
  }
}

function handleRoomDeleted() {
  if (confirm("Are you sure you want to delete the room?")) {
    socket.emit("delete-room", currentRoomId, (response) => {
      if (response?.status === "success") {
        redirectToMainPage();
      } else {
        alert(
          "Failed to delete room: " + (response?.message || "Unknown error")
        );
      }
    });
  }
}

function handleLeaveRoomSuccess() {
  redirectToMainPage();
}

/* ========== ROOM MANAGEMENT ========== */

function handleLeaveRoom() {
  if (confirm("Are you sure you want to leave the room?")) {
    socket.emit("leave-room", currentRoomId, (response) => {
      if (response?.status === "success") {
        redirectToMainPage();
      } else {
        alert(
          "Failed to leave room: " + (response?.message || "Unknown error")
        );
      }
    });
  }
}

function handleDeleteRoom() {
  if (
    confirm(
      "Are you sure you want to delete this room? All messages will be lost."
    )
  ) {
    socket.emit("delete-room", currentRoomId, (response) => {
      if (response?.status === "success") {
        redirectToMainPage();
      } else {
        alert(
          "Failed to delete room: " + (response?.message || "Unknown error")
        );
      }
    });
  }
}

/* ========== MESSAGE FUNCTIONS ========== */

function sendMessage() {
  if (!isSocketReady || !socket.connected) {
    showTemporaryMessage("Connecting... Please wait");
    return;
  }

  const input = document.getElementById("message");
  const content = input.value.trim();
  if (!content) return;

  const tempId = "temp-" + Date.now();
  pendingMessages.set(tempId, true);

  const chat = document.getElementById("chat");
  chat.insertAdjacentHTML(
    "beforeend",
    createMessageElement({
      _id: tempId,
      sender: currentUser.username,
      content,
      createdAt: new Date(),
    })
  );

  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  socket.emit(
    "send-message",
    {
      content,
      roomId: currentRoomId,
      username: currentUser.username,
      tempId,
    },
    (response) => {
      if (response?.status === "failed") {
        document.querySelector(`[data-id="${tempId}"]`)?.remove();
        pendingMessages.delete(tempId);
        showTemporaryMessage("Failed to send: " + response.message);
      }
    }
  );
}

function createMessageElement(message) {
  const isCurrentUser = message.sender === currentUser.username;
  return `
    <div class="message ${isCurrentUser ? "mine" : "other"}" data-id="${
    message._id || message.tempId
  }">
      <div class="message-content">
        <p><strong>${message.sender}:</strong> <span>${linkify(
    message.content
  )}</span></p>
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
    minute: "2-digit",
  });
}

function linkify(text) {
  return typeof text === "string"
    ? text.replace(
        /(https?:\/\/[^\s]+)/g,
        (url) => `<a href="${url}" target="_blank">${url}</a>`
      )
    : text;
}
