// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let isSocketReady = false;
const pendingMessages = new Map(); // Track temp messages

// Initialize chat
document.addEventListener("DOMContentLoaded", initializeChat);

function initializeChat() {
  try {
    // Load user data
    const userData = localStorage.getItem("user");
    if (!userData) throw new Error("No user data");
    
    currentUser = JSON.parse(userData);
    if (!currentUser?.roomId || !currentUser?.username) {
      throw new Error("Invalid user data");
    }
    currentRoomId = currentUser.roomId;

    // Update UI
    document.getElementById("room-id").textContent = currentRoomId;
    document.getElementById("username").textContent = currentUser.username;
    document.getElementById(currentUser.isOwner ? "delete-room-btn" : "leave-room-btn").style.display = "inline-block";

    // Setup socket and handlers
    setupSocketConnection();
    document.getElementById("message").addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });

  } catch (error) {
    console.error("Init error:", error);
    alert("Error: " + error.message);
    window.location.href = "mainPage.html";
  }
}

function setupSocketConnection() {
  // Cleanup previous connection
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io("https://chat-application-howg.onrender.com", {
    reconnection: true,
    auth: {
      username: currentUser.username,
      roomId: currentRoomId
    }
  });

  // Connection events
  socket.on("connect", () => {
    console.log("✅ Connected to server");
    isSocketReady = true;
    socket.emit("join-room", currentRoomId, currentUser.username);
  });

  socket.on("disconnect", () => {
    isSocketReady = false;
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
    setTimeout(() => {
      if (!isSocketReady) {
        alert("Connection failed. Please refresh");
        window.location.reload();
      }
    }, 3000);
  });

  // Message handling
  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    chat.innerHTML = messages.map(msg => createMessageElement(msg)).join("");
    chat.scrollTop = chat.scrollHeight;
  });

  socket.on("new-message", (message) => {
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
    
    // Only add if new message
    if (!document.querySelector(`[data-id="${message._id}"]`)) {
      chat.insertAdjacentHTML("beforeend", createMessageElement(message));
      chat.scrollTop = chat.scrollHeight;
    }
  });

  socket.on("room-deleted", cleanupAndRedirect);
  socket.on("error", (err) => console.error("Socket error:", err));
}

function sendMessage() {
  if (!isSocketReady) return alert("Please wait... Connecting");
  
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

  // Send to server
  socket.emit("send-message", {
    content,
    roomId: currentRoomId,
    username: currentUser.username,
    tempId // Include tempId for reconciliation
  }, (response) => {
    if (response?.status === "error") {
      document.querySelector(`[data-id="${tempId}"]`)?.remove();
      pendingMessages.delete(tempId);
      alert("Failed to send: " + response.message);
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

// Helper functions
const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString([], { 
  hour: "2-digit", 
  minute: "2-digit" 
});

const linkify = (text) => typeof text === "string" 
  ? text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank">${url}</a>`)
  : text;

const cleanupAndRedirect = () => {
  localStorage.removeItem("user");
  if (socket) socket.disconnect();
  window.location.href = "mainPage.html";
};

// UI Functions
window.deleteRoom = () => {
  if (confirm("Delete this room permanently?")) {
    socket.emit("delete-room", currentRoomId, cleanupAndRedirect);
  }
};

window.leaveRoom = () => {
  if (confirm("Leave this room?")) {
    socket.emit("leave-room", currentRoomId, cleanupAndRedirect);
  }
};