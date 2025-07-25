// Global state
let socket;
let currentRoomId = null;
let currentUser = null;
let hasLoadedInitialMessages = false;
let isSocketReady = false;

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
  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    auth: {
      username: currentUser.username,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Connected to server");
    socket.emit("join-room", currentRoomId, currentUser.username, (res) => {
      console.log(
        `✅ ${username} joined room ${roomId} (socket: ${socket.id})`
      );

      const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
      console.log(
        `Users in room ${roomId}: ${socketsInRoom ? socketsInRoom.size : 0}`
      );

      if (res.status === "success") {
        isSocketReady = true;
        console.log("✅ Joined room successfully");
        document.getElementById("message").disabled = false;
      } else {
        alert("Failed to join room: " + res.message);
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
  });

  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");

    // Only clear chat if it's the initial load
    if (!hasLoadedInitialMessages) {
      chat.innerHTML = "";
      hasLoadedInitialMessages = true;
    }

    // Filter out messages we've already displayed
    const newMessages = messages.filter(
      (msg) => !document.querySelector(`[data-id="${msg._id}"]`)
    );

    newMessages.forEach((message) => {
      displayMessage(
        message.sender,
        message.content,
        message.createdAt,
        message._id
      );
    });
  });

  socket.on("new-message", (message) => {
    console.log("✅ New message received from server:", message);
    // Check if a temp message for this user and content already exists
    const tempMsg = Array.from(document.querySelectorAll(".message.mine")).find(
      (el) =>
        !el.dataset.id?.startsWith("temp-")
          ? false
          : el.querySelector("span")?.textContent === message.content
    );

    if (tempMsg) {
      // Replace temp ID with real ID and update timestamp
      tempMsg.dataset.id = message._id;
      tempMsg.querySelector(".timestamp").textContent = new Date(
        message.createdAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return; // Don't add a duplicate
    }

    // Only show if not already shown
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
  // Don't display if we already have this message
  if (messageId && document.querySelector(`[data-id="${messageId}"]`)) {
    return;
  }

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
  if (!isSocketReady) {
    return alert("Please wait... Connecting to room.");
  }

  const input = document.getElementById("message");
  const content = input.value.trim();

  if (!content || !socket || !socket.connected) return;

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
      } else {
        const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
        if (tempMsg) {
          tempMsg.dataset.id = response.message._id;
          tempMsg.querySelector(".timestamp").textContent = new Date(
            response.message.createdAt
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
      }
    }
  );
}

// Delete room function
window.deleteRoom = function () {
  if (
    !confirm(
      "Are you sure you want to delete this room? All messages will be lost."
    )
  ) {
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
window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    socket.emit("leave-room", currentRoomId, () => {
      localStorage.removeItem("user");
      window.location.href = "mainPage.html";
    });
  }
};
