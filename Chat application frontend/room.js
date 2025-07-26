// Global state
let socket;
let roomId = null;
let currentUser = null;
let isSocketReady = false;
let roomJoined = false;
const pendingMessages = new Map();
let latestMessageId = null;

document.addEventListener("DOMContentLoaded", initializeChat);

function initializeChat() {
  try {
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user data found");

    currentUser = JSON.parse(userData);
    if (!currentUser?.roomId || !currentUser?.username) throw new Error("Invalid user data");

    roomId = currentUser.roomId;

    updateUI();
    setupSocketConnection();
    setupEventListeners();
    startContinuousMessageFetch(); // ✅ Auto-fetch messages every 2s
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Error initializing chat: " + error.message);
    redirectToMainPage();
  }
}

function setupSocketConnection() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io("https://chat-application-howg.onrender.com", {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    transports: ["websocket", "polling"],
    auth: { username: currentUser.username, roomId },
  });

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("reconnect", handleReconnect);
  socket.on("load-messages", handleLoadMessages);
  socket.on("new-message", handleNewMessage);
  socket.on("room-deleted", handleRoomDeleted);
  socket.on("leave-room-success", handleLeaveRoomSuccess);

  startHeartbeat();
}

function setupEventListeners() {
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  document.getElementById("leave-room-btn")?.addEventListener("click", handleLeaveRoom);
  document.getElementById("delete-room-btn")?.addEventListener("click", handleDeleteRoom);
}

// ================== SOCKET HANDLERS ==================

function handleConnect() {
  console.log("✅ Connected to server with ID:", socket.id);
  if (roomJoined) return;

  const joinRoomWithRetry = (attempt = 1) => {
    if (attempt > 5) return alert("Failed to join room. Please refresh.");

    socket.emit("join-room", roomId, currentUser.username, (res) => {
      if (res?.status === "success") {
        console.log("✅ Joined room");
        roomJoined = true;
        pendingMessages.clear();
      } else {
        console.warn(`Join attempt ${attempt} failed:`, res?.message);
        setTimeout(() => joinRoomWithRetry(attempt + 1), 500 * attempt);
      }
    });
  };

  joinRoomWithRetry();
}

function handleDisconnect(reason) {
  console.warn("🔌 Disconnected:", reason);
  isSocketReady = false;
  roomJoined = false;
}

function handleReconnect(attempt) {
  console.log(`♻️ Reconnected after ${attempt} attempts`);
  isSocketReady = true;
  roomJoined = false;
  handleConnect(); // rejoin
}

function handleLoadMessages(messages) {
  const chat = document.getElementById("chat");
  chat.innerHTML = messages.map(createMessageElement).join("");
  if (messages.length > 0) latestMessageId = messages[messages.length - 1]._id;
  chat.scrollTop = chat.scrollHeight;
}

function handleNewMessage(message) {
  const chat = document.getElementById("chat");

  if (message.tempId && pendingMessages.has(message.tempId)) {
    const tempEl = document.querySelector(`[data-id="${message.tempId}"]`);
    if (tempEl) {
      tempEl.dataset.id = message._id;
      tempEl.querySelector(".timestamp").textContent = formatTime(message.createdAt);
      pendingMessages.delete(message.tempId);
      latestMessageId = message._id;
      return;
    }
  }

  const exists = document.querySelector(`[data-id="${message._id}"]`);
  if (!exists) {
    chat.insertAdjacentHTML("beforeend", createMessageElement(message));
    latestMessageId = message._id;
    chat.scrollTop = chat.scrollHeight;
  }
}

function handleRoomDeleted() {
  if (confirm("Room deleted. Exit now?")) redirectToMainPage();
}

function handleLeaveRoomSuccess() {
  redirectToMainPage();
}

// ================== CONTINUOUS FETCHING ==================

function startContinuousMessageFetch(interval = 2000) {
  setInterval(fetchLatestMessagesFromServer, interval);
}

async function fetchLatestMessagesFromServer() {
  try {
    const res = await fetch(`https://chat-application-howg.onrender.com/message/messages/${roomId}`);
    if (!res.ok) throw new Error("Failed to fetch messages");

    const { messages } = await res.json();
    const chat = document.getElementById("chat");

    const newMessages = messages.filter((msg) => !document.querySelector(`[data-id="${msg._id}"]`));
    newMessages.forEach((msg) => {
      chat.insertAdjacentHTML("beforeend", createMessageElement(msg));
    });

    if (newMessages.length) chat.scrollTop = chat.scrollHeight;
  } catch (err) {
    console.error("Message fetch failed:", err.message);
  }
}

// ================== ROOM ACTIONS ==================

function handleLeaveRoom() {
  if (confirm("Leave this room?")) {
    socket.emit("leave-room", roomId, (res) => {
      if (res?.status === "success") redirectToMainPage();
      else alert("Error leaving room");
    });
  }
}

function handleDeleteRoom() {
  if (confirm("Delete room and all messages?")) {
    socket.emit("delete-room", roomId, (res) => {
      if (res?.status === "success") redirectToMainPage();
      else alert("Error deleting room");
    });
  }
}

// ================== MESSAGE SEND ==================

function sendMessage() {
  if (!isSocketReady || !socket.connected || !roomJoined) return showTemporaryMessage("Connecting...");

  const input = document.getElementById("message");
  const content = input.value.trim();
  if (!content) return;

  const tempId = "temp-" + Date.now();
  pendingMessages.set(tempId, true);

  const chat = document.getElementById("chat");
  chat.insertAdjacentHTML("beforeend", createMessageElement({
    _id: tempId,
    sender: currentUser.username,
    content,
    createdAt: new Date(),
  }));

  input.value = "";
  chat.scrollTop = chat.scrollHeight;

  socket.emit("send-message", { content, roomId, username: currentUser.username, tempId }, async (res) => {
    if (res?.status === "failed") {
      document.querySelector(`[data-id="${tempId}"]`)?.remove();
      pendingMessages.delete(tempId);
      showTemporaryMessage("❌ Message failed");
    } else {
      await fetchLatestMessagesFromServer(); // ensure sync
    }
  });
}

// ================== UI HELPERS ==================

function createMessageElement(msg) {
  const isMe = msg.sender === currentUser.username;
  return `
    <div class="message ${isMe ? "mine" : "other"}" data-id="${msg._id || msg.tempId}">
      <div class="message-content">
        <p><strong>${msg.sender}:</strong> <span>${linkify(msg.content)}</span></p>
      </div>
      <div class="timestamp">${formatTime(msg.createdAt)}</div>
    </div>`;
}

function updateUI() {
  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = currentUser.username;
  document.getElementById(currentUser.isOwner ? "delete-room-btn" : "leave-room-btn").style.display = "inline-block";
}

function redirectToMainPage() {
  localStorage.removeItem("user");
  socket?.disconnect();
  window.location.href = "mainPage.html";
}

function showTemporaryMessage(text) {
  const msg = document.createElement("div");
  msg.className = "system-message";
  msg.textContent = text;
  document.getElementById("chat").appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function linkify(text) {
  return typeof text === "string"
    ? text.replace(/(https?:\/\/[^\s]+)/g, (url) => `<a href="${url}" target="_blank">${url}</a>`)
    : text;
}

function startHeartbeat() {
  setInterval(() => {
    if (socket.connected) socket.emit("heartbeat");
  }, 20000);
}
