// Global state
let socket;
let currentRoomId = null;

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeChat();
});

function initializeChat() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    alert("User not found. Redirecting to main page.");
    window.location.href = "mainPage.html";
    return;
  }

  const user = JSON.parse(userData);
  currentRoomId = user.roomId;

  // Update UI
  document.getElementById("room-id").textContent = user.roomId;
  document.getElementById("username").textContent = user.username;

  // Setup socket connection
  setupSocketConnection(user);

  // Message input handler
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Leave room button
  document.getElementById("leave-room-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to leave the room?")) {
      localStorage.removeItem("user");
      window.location.href = "mainPage.html";
    }
  });
}

function setupSocketConnection(user) {
  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      username: user.username,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Connected to server");

    socket.emit("join-room", user.roomId, user.username, (response) => {
      if (response?.status === "error") {
        alert(`Failed to join room: ${response.message}`);
      } else {
        console.log("✅ Successfully joined room");
      }
    });
  });

  socket.on("room-deleted", () => {
    alert("This room has been deleted by the owner. You will be redirected.");
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
  });

  // Message handlers
  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    chat.innerHTML = "";

    messages.forEach((message) => {
      displayMessage(
        message.sender,
        message.text,
        message.createdAt,
        message._id
      );
    });
  });

  socket.on("new-message", (message) => {
    displayMessage(
      message.sender,
      message.text,
      message.createdAt,
      message._id
    );
  });

  socket.on("error", (errorMsg) => {
    console.error("Socket error:", errorMsg);
    alert(errorMsg);
  });
}

function displayMessage(sender, text, timestamp, messageId) {
  const chat = document.getElementById("chat");

  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    sender === document.getElementById("username").textContent
      ? "mine"
      : "other"
  }`;

  if (messageId) {
    messageEl.dataset.id = messageId;
  }

  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = `<p><strong>${sender}:</strong> <span>${linkify(
    text
  )}</span></p>`;

  const ts = document.createElement("div");
  ts.className = "timestamp";
  ts.textContent = time;

  messageEl.append(content, ts);
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
  const user = JSON.parse(localStorage.getItem("user"));
  const input = document.getElementById("message");
  const message = input.value.trim();

  if (!message || !socket || !socket.connected) return;

  // Optimistic UI update
  const tempId = "temp-" + Date.now();
  displayMessage(user.username, message, new Date(), tempId);
  input.value = "";
  input.focus();

  socket.emit(
    "send-message",
    {
      text: message,
      roomId: user.roomId,
      username: user.username,
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

window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  }
};

// Add this to your existing room.js file

// Delete room function
window.deleteRoom = function () {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user?.isOwner) {
    alert("Only room owner can delete the room");
    return;
  }

  if (
    !confirm(
      "Are you sure you want to delete this room? This cannot be undone."
    )
  ) {
    return;
  }

  socket.emit("delete-room", user.roomId, (response) => {
    if (response?.status === "success") {
      localStorage.removeItem("user");
      window.location.href = "mainPage.html";
    } else {
      alert("Failed to delete room: " + (response?.message || "Unknown error"));
    }
  });
};
