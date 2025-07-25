// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let hasLoadedInitialMessages = false;
let isSocketReady = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeChat();
});

function initializeChat() {
  // Load user data
  const userData = localStorage.getItem("user");
  if (!userData) {
    alert("User not found. Redirecting to main page.");
    window.location.href = "mainPage.html";
    return;
  }

  currentUser = JSON.parse(userData);
  currentRoomId = currentUser.roomId;

  // Update UI
  document.getElementById("room-id").textContent = currentUser.roomId;
  document.getElementById("username").textContent = currentUser.username;

  // Show appropriate button
  document.getElementById(
    currentUser.isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";

  // Setup socket connection
  setupSocketConnection();

  // Message input handler
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}

function setupSocketConnection() {
  // Close previous connection if exists
  if (socket) {
    socket.disconnect();
  }

  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    auth: {
      username: currentUser.username,
      roomId: currentRoomId
    },
  });

  // Connection established
  socket.on("connect", () => {
    console.log("✅ Connected to server with ID:", socket.id);
    reconnectAttempts = 0;
    
    socket.emit("join-room", currentRoomId, currentUser.username, (res) => {
      if (res.status === "success") {
        isSocketReady = true;
        console.log(`✅ Joined room ${currentRoomId} successfully. Loaded ${res.messageCount} messages.`);
      } else {
        console.error("Failed to join room:", res.message);
        alert("Failed to join room: " + res.message);
        handleConnectionFailure();
      }
    });
  });

  // Connection lost
  socket.on("disconnect", (reason) => {
    isSocketReady = false;
    console.log("Disconnected from server:", reason);
    
    if (reason === "io server disconnect") {
      // Manual reconnection needed
      setTimeout(() => socket.connect(), 1000);
    }
  });

  // Connection error
  socket.on("connect_error", (err) => {
    reconnectAttempts++;
    console.error("Connection error:", err.message);
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      alert("Failed to connect to server. Please refresh the page.");
      handleConnectionFailure();
    }
  });

  // Message handlers
  socket.on("load-messages", (messages) => {
    console.log(`📨 Received ${messages.length} messages from server`);
    const chat = document.getElementById("chat");

    if (!hasLoadedInitialMessages) {
      chat.innerHTML = "";
      hasLoadedInitialMessages = true;
    }

    messages.forEach((message) => {
      if (!document.querySelector(`[data-id="${message._id}"]`)) {
        displayMessage(
          message.sender,
          message.content,
          message.createdAt,
          message._id
        );
      }
    });
  });

  socket.on("new-message", (message) => {
    console.log("📩 New message received:", message);
    
    // Check if this is a duplicate
    if (document.querySelector(`[data-id="${message._id}"]`)) {
      return;
    }

    // Check if this replaces a temporary message
    const tempMessages = Array.from(document.querySelectorAll('.message[data-id^="temp-"]'));
    const matchingTempMsg = tempMessages.find(
      el => el.querySelector("span")?.textContent === message.content
    );

    if (matchingTempMsg) {
      // Update temp message with real data
      matchingTempMsg.dataset.id = message._id;
      matchingTempMsg.querySelector(".timestamp").textContent = formatTime(message.createdAt);
      return;
    }

    // Display new message
    displayMessage(
      message.sender,
      message.content,
      message.createdAt,
      message._id
    );
  });

  // Room events
  socket.on("room-deleted", () => {
    alert("This room has been deleted by the owner. You will be redirected.");
    cleanupAndRedirect();
  });

  // Error handling
  socket.on("error", (errorMsg) => {
    console.error("Socket error:", errorMsg);
    alert("Error: " + errorMsg);
  });
}

function displayMessage(sender, content, timestamp, messageId) {
  const chat = document.getElementById("chat");
  const isCurrentUser = sender === currentUser.username;

  const messageEl = document.createElement("div");
  messageEl.className = `message ${isCurrentUser ? "mine" : "other"}`;
  messageEl.dataset.id = messageId || "temp-" + Date.now();

  messageEl.innerHTML = `
    <div class="message-content">
      <p><strong>${sender}:</strong> <span>${linkify(content)}</span></p>
    </div>
    <div class="timestamp">${formatTime(timestamp)}</div>
  `;

  chat.appendChild(messageEl);
  messageEl.scrollIntoView({ behavior: "smooth" });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

function linkify(text) {
  if (typeof text !== "string") return text;
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

function sendMessage() {
  if (!isSocketReady) {
    return alert("Please wait... Connecting to room.");
  }

  const input = document.getElementById("message");
  const content = input.value.trim();

  if (!content) return;

  // Create temporary message
  const tempId = "temp-" + Date.now();
  displayMessage(currentUser.username, content, new Date(), tempId);
  input.value = "";
  input.focus();

  // Send to server
  socket.emit(
    "send-message",
    {
      content,
      roomId: currentRoomId,
      username: currentUser.username,
    },
    (response) => {
      if (response?.status === "error") {
        const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
        if (tempMsg) tempMsg.remove();
        alert("Failed to send: " + response.message);
      }
    }
  );
}

function cleanupAndRedirect() {
  localStorage.removeItem("user");
  if (socket) socket.disconnect();
  window.location.href = "mainPage.html";
}

function handleConnectionFailure() {
  setTimeout(() => {
    if (!isSocketReady) {
      alert("Connection issues. Please refresh the page.");
      cleanupAndRedirect();
    }
  }, 5000);
}

// UI Functions
window.deleteRoom = function () {
  if (!confirm("Are you sure you want to delete this room? All messages will be lost.")) {
    return;
  }
  socket.emit("delete-room", currentRoomId, (response) => {
    if (response?.status === "success") {
      cleanupAndRedirect();
    } else {
      alert("Failed to delete room: " + (response?.message || "Unknown error"));
    }
  });
};

window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    socket.emit("leave-room", currentRoomId, () => {
      cleanupAndRedirect();
    });
  }
};