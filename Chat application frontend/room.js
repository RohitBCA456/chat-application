// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let isSocketReady = false;

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
    auth: { username: currentUser.username, roomId: currentRoomId }
  });

  // Connection handlers
  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
    isSocketReady = true;
    socket.emit("join-room", currentRoomId, currentUser.username);
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

function createMessageElement(message) {
  const isCurrentUser = message.sender === currentUser?.username;
  return `
    <div class="message ${isCurrentUser ? "mine" : "other"}" data-id="${message._id || "temp-"+Date.now()}">
      <div class="message-content">
        <p><strong>${message.sender}:</strong> <span>${linkify(message.content)}</span></p>
      </div>
      <div class="timestamp">${formatTime(message.createdAt)}</div>
    </div>
  `;
}

function sendMessage() {
  if (!isSocketReady) return alert("Connecting... Please wait");

  const input = document.getElementById("message");
  const content = input.value.trim();
  if (!content) return;

  // Create and display temporary message
  const tempId = "temp-" + Date.now();
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

  // Send to server
  socket.emit("send-message", { content, roomId: currentRoomId, username: currentUser.username }, 
    (response) => {
      if (response?.status === "error") {
        document.querySelector(`[data-id="${tempId}"]`)?.remove();
        alert("Send failed: " + response.message);
      }
    }
  );
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