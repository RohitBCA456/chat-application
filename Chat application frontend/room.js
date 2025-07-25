// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let isSocketReady = false;
let pendingMessages = new Set(); // Track temporary message IDs

document.addEventListener("DOMContentLoaded", initializeChat);

function initializeChat() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    alert("User not found. Redirecting to main page.");
    return window.location.href = "mainPage.html";
  }

  currentUser = JSON.parse(userData);
  currentRoomId = currentUser.roomId;

  // Update UI
  document.getElementById("room-id").textContent = currentRoomId;
  document.getElementById("username").textContent = currentUser.username;
  document.getElementById(currentUser.isOwner ? "delete-room-btn" : "leave-room-btn").style.display = "inline-block";

  setupSocketConnection();
  document.getElementById("message").addEventListener("keypress", (e) => e.key === "Enter" && sendMessage());
}

function setupSocketConnection() {
  if (socket) socket.disconnect();

  socket = io("https://chat-application-howg.onrender.com", {
    reconnection: true,
    auth: { 
      username: currentUser.username, 
      roomId: currentRoomId,
      userId: currentUser.userId // Add unique user ID if available
    }
  });

  // Connection handlers
  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
    isSocketReady = true;
    socket.emit("join-room", {
      roomId: currentRoomId,
      username: currentUser.username,
      userId: currentUser.userId || socket.id
    });
  });

  socket.on("disconnect", () => isSocketReady = false);

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
    setTimeout(() => !isSocketReady && alert("Connection issues. Please refresh"), 5000);
  });

  // Message handlers
  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    chat.innerHTML = messages.map(msg => createMessageElement(msg)).join("");
    chat.scrollTop = chat.scrollHeight;
  });

  socket.on("new-message", (message) => {
    // Skip if this is our own pending message (will be handled by the callback)
    if (pendingMessages.has(message._id) || pendingMessages.has(message.tempId)) {
      pendingMessages.delete(message._id);
      pendingMessages.delete(message.tempId);
      return;
    }
    
    const chat = document.getElementById("chat");
    if (!document.querySelector(`[data-id="${message._id}"]`)) {
      chat.insertAdjacentHTML("beforeend", createMessageElement(message));
      chat.scrollTop = chat.scrollHeight;
    }
  });

  socket.on("room-deleted", () => {
    alert("Room deleted. Redirecting...");
    cleanupAndRedirect();
  });
}

function sendMessage() {
  if (!isSocketReady) return alert("Connecting... Please wait");

  const input = document.getElementById("message");
  const content = input.value.trim();
  if (!content) return;

  // Create temporary ID and add to pending set
  const tempId = "temp-" + Date.now();
  pendingMessages.add(tempId);

  // Create and display temporary message
  document.getElementById("chat").insertAdjacentHTML(
    "beforeend",
    createMessageElement({
      _id: tempId,
      sender: currentUser.username,
      content,
      createdAt: new Date()
    })
  );
  input.value = "";
  input.focus();

  // Scroll to bottom
  const chat = document.getElementById("chat");
  chat.scrollTop = chat.scrollHeight;

  // Send to server with temporary ID
  socket.emit("send-message", { 
    content, 
    roomId: currentRoomId, 
    username: currentUser.username,
    tempId // Include tempId in the message
  }, (response) => {
    if (response?.status === "error") {
      document.querySelector(`[data-id="${tempId}"]`)?.remove();
      pendingMessages.delete(tempId);
      alert("Send failed: " + response.message);
    }
    // On success, the server will send the real message with the tempId
  });
}

function createMessageElement(message) {
  const isCurrentUser = message.sender === currentUser?.username;
  return `
    <div class="message ${isCurrentUser ? "mine" : "other"}" data-id="${message._id || message.tempId}">
      <div class="message-content">
        <p><strong>${message.sender}:</strong> <span>${linkify(message.content)}</span></p>
      </div>
      <div class="timestamp">${formatTime(message.createdAt)}</div>
    </div>
  `;
}

// Helper functions
const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const linkify = (text) => typeof text === "string" ? text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank">${url}</a>`) : text;
const cleanupAndRedirect = () => {
  localStorage.removeItem("user");
  socket?.disconnect();
  window.location.href = "mainPage.html";
};

// UI Functions
window.deleteRoom = () => confirm("Delete this room?") && socket.emit("delete-room", currentRoomId, cleanupAndRedirect);
window.leaveRoom = () => confirm("Leave this room?") && socket.emit("leave-room", currentRoomId, cleanupAndRedirect);