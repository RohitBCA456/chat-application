// Global state
let socket;
let currentRoomId = null;
let currentUser = null;

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeChat();
});

async function initializeChat() {
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

  

 await fetchMessageHistory(currentRoomId);

  // Then setup socket connection
  setupSocketConnection();

  // Message input handler
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}

async function fetchMessageHistory(roomId) {
  try {
    const response = await fetch(`https://chat-application-howg.onrender.com/messages/${roomId}`);
    if (!response.ok) throw new Error("Failed to fetch messages");
    
    const data = await response.json();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    
    const chat = document.getElementById("chat");
    chat.innerHTML = "";
    
    messages.forEach((message) => {
      displayMessage(
        message.sender,
        message.content,
        message.createdAt,
        message._id
      );
    });
    
    hasLoadedInitialMessages = true;
  } catch (error) {
    console.error("Error fetching message history:", error);
    alert("Failed to load message history. Trying socket connection...");
  }
}

function setupSocketConnection() {
  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      username: currentUser.username,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Connected to server");
    socket.emit("join-room", currentRoomId, currentUser.username);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
  });

  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    chat.innerHTML = "";
    
    messages.forEach((message) => {
      displayMessage(
        message.sender,
        message.content,
        message.createdAt,
        message._id
      );
    });
  });

  socket.on("new-message", (message) => {
    displayMessage(
      message.sender,
      message.content,
      message.createdAt,
      message._id
    );
  });

  socket.on("room-deleted", () => {
    alert("This room has been deleted by the owner. You will be redirected.");
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  });

  socket.on("error", (errorMsg) => {
    console.error("Socket error:", errorMsg);
    alert(errorMsg);
  });
}

function displayMessage(sender, content, timestamp, messageId) {
  const chat = document.getElementById("chat");
  
  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    sender === currentUser.username ? "mine" : "other"
  }`;

  if (messageId) {
    messageEl.dataset.id = messageId;
  }

  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  messageEl.innerHTML = `
    <div class="message-content">
      <p><strong>${sender}:</strong> <span>${linkify(content)}</span></p>
    </div>
    <div class="timestamp">${time}</div>
  `;

  chat.appendChild(messageEl);
  messageEl.scrollIntoView({ behavior: "smooth" });
}

function linkify(text) {
  if (typeof text !== "string") return text;
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

function sendMessage() {
  const input = document.getElementById("message");
  const content = input.value.trim();

  if (!content || !socket || !socket.connected) return;

  // Optimistic UI update
  const tempId = "temp-" + Date.now();
  displayMessage(currentUser.username, content, new Date(), tempId);
  input.value = "";
  input.focus();

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

// Delete room function
window.deleteRoom = function() {
  if (!confirm("Are you sure you want to delete this room? All messages will be lost.")) {
    return;
  }

  socket.emit("delete-room", currentRoomId, (response) => {
    if (response?.status === "success") {
      localStorage.removeItem("user");
      window.location.href = "mainPage.html";
    } else {
      alert("Failed to delete room: " + (response?.message || "Unknown error"));
    }
  });
};

// Leave room function
window.leaveRoom = function() {
  if (confirm("Are you sure you want to leave the room?")) {
    socket.emit("leave-room", currentRoomId, () => {
      localStorage.removeItem("user");
      window.location.href = "mainPage.html";
    });
  }
};