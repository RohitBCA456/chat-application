// Global state management
let socket;
let isSocketReady = false;
let roomJoined = false;
const pendingMessages = new Set();
const displayedMessages = new Set();

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeUserInterface();
  initializeSocketConnection();
});

function initializeUserInterface() {
  const userData = localStorage.getItem("user");
  if (!userData) {
    alert("User not found. Redirecting to main page.");
    window.location.href = "mainPage.html";
    return;
  }

  const user = JSON.parse(userData);
  const { username, roomId, isOwner } = user;

  // Update UI elements
  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";
  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = username;

  // Set up message input handler
  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });
}

function initializeSocketConnection() {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;

  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true,
    auth: {
      username: user.username,
    },
  });

  socket.on("connect", () => {
    console.log("✅ Connected to server");
    isSocketReady = true;

    // Add callback handler for join-room
    socket.emit("join-room", user.roomId, user.username, (response) => {
      if (response?.status === "error") {
        console.error("Failed to join room:", response.message);
        alert(`Failed to join room: ${response.message}`);
      } else {
        roomJoined = true;
        console.log("✅ Successfully joined room");
      }
    });
  });
  socket.on("disconnect", () => {
    isSocketReady = false;
    roomJoined = false;
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
    socket.io.opts.transports = ["polling", "websocket"];
  });

  // Message handlers
  socket.on("receive-message", handleIncomingMessage);
  socket.on("load-messages", handleInitialMessages);
  socket.on("message-edited", handleMessageEdit);
  socket.on("message-deleted", handleMessageDeletion);
  socket.on("error", handleSocketError);
}

// Event handlers
function handleJoinRoomResponse(response) {
  if (response.status === "error") {
    console.error("Failed to join room:", response.message);
    alert(`Failed to join room: ${response.message}`);
  }
}

function handleIncomingMessage({ username, message, timestamp, _id }) {
  if (displayedMessages.has(_id)) return;
  pendingMessages.delete(_id);
  displayMessage(username, message, timestamp, _id);
}

function handleInitialMessages(messages) {
  const chat = document.getElementById("chat");
  if (chat.children.length === 0) {
    messages.forEach(({ sender, content, timestamp, _id }) => {
      displayMessage(sender, content, timestamp, _id);
    });
  }
}

function handleMessageEdit({ id, newText }) {
  const messageCard = document.querySelector(`[data-id="${id}"]`);
  if (messageCard) {
    const span = messageCard.querySelector(".message-content span");
    if (span) span.innerHTML = linkify(newText);
  }
}

function handleMessageDeletion({ id }) {
  const messageCard = document.querySelector(`[data-id="${id}"]`);
  if (messageCard) messageCard.remove();
}

function handleSocketError(errorMsg) {
  console.error("Socket error:", errorMsg);
  alert(errorMsg);
}

// Message display functions
function displayMessage(user, text, timestamp = null, messageId = null) {
  if (messageId && displayedMessages.has(messageId)) return;

  const chat = document.getElementById("chat");

  // Remove temporary message if exists
  if (messageId && messageId.startsWith("temp-")) {
    const existingTemp = document.querySelector(`[data-id="${messageId}"]`);
    if (existingTemp) existingTemp.remove();
  }

  const messageEl = createMessageElement(user, text, timestamp, messageId);

  // Replace temporary message or append new one
  const tempId = messageId?.replace(/^[^-]+-/, "temp-");
  const tempMessage = tempId
    ? document.querySelector(`[data-id="${tempId}"]`)
    : null;

  if (tempMessage) {
    tempMessage.replaceWith(messageEl);
  } else {
    chat.appendChild(messageEl);
  }

  messageEl.scrollIntoView({ behavior: "smooth" });
}

function createMessageElement(user, text, timestamp, messageId) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    user === document.getElementById("username").textContent ? "mine" : "other"
  }`;

  if (messageId) {
    messageEl.dataset.id = messageId;
    displayedMessages.add(messageId);
  }

  const time = new Date(timestamp || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = `<p><strong>${user}:</strong> <span>${linkify(
    text
  )}</span></p>`;

  const ts = document.createElement("div");
  ts.className = "timestamp";
  ts.textContent = time;

  const actionBtns = createActionButtons(messageId, user);
  content.appendChild(actionBtns);
  messageEl.append(content, ts);

  return messageEl;
}

function createActionButtons(messageId, user) {
  const actionBtns = document.createElement("div");
  actionBtns.className = "action-buttons";

  if (
    user === document.getElementById("username").textContent &&
    messageId &&
    !messageId.startsWith("temp-")
  ) {
    actionBtns.innerHTML += `
      <button onclick="editMessage(this)" class="pop-up-btn edit-btn">Edit</button>
      <button onclick="deleteMessage(this)" class="pop-up-btn delete-btn">Delete</button>
    `;
  }

  actionBtns.innerHTML += `<button onclick="togglePin(this)" class="pop-up-btn pin-btn">Pin</button>`;
  return actionBtns;
}

// Message operations
window.sendMessage = function () {
  if (!roomJoined) {
    alert("Please wait until you've fully joined the room");
    return;
  }

  const user = JSON.parse(localStorage.getItem("user"));
  const input = document.getElementById("message");
  const message = input.value.trim();

  if (!message) return;

  const tempId = "temp-" + Date.now();
  displayMessage(user.username, message, new Date(), tempId);
  pendingMessages.add(tempId);
  input.value = "";
  input.focus();

  // Add callback handler for send-message
  socket.emit(
    "send-message",
    {
      roomId: user.roomId,
      username: user.username,
      message,
      tempId,
    },
    (response) => {
      pendingMessages.delete(tempId);
      if (response?.status === "error") {
        const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
        if (tempMsg) tempMsg.remove();
        displayedMessages.delete(tempId);
        alert("Failed to send: " + response.message);
      }
    }
  );
};

window.editMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  const username = document.getElementById("username").textContent;

  const span = messageCard.querySelector(".message-content span");
  const oldText = span.textContent.trim();

  if (messageCard.querySelector("input.edit-input")) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = oldText;
  input.className = "edit-input";
  span.replaceWith(input);
  input.focus();

  btn.textContent = "Save";
  btn.onclick = () => saveEdit();

  function saveEdit() {
    const newText = input.value.trim();
    if (!newText || newText === oldText) {
      cancelEdit();
      return;
    }

    socket.emit(
      "edit-message",
      { id: messageId, newText, roomId, username },
      (response) => {
        if (response?.status === "error") {
          alert("Failed to edit: " + response.message);
          cancelEdit();
        }
      }
    );

    const updatedSpan = document.createElement("span");
    updatedSpan.innerHTML = linkify(newText);
    input.replaceWith(updatedSpan);

    btn.textContent = "Edit";
    btn.onclick = () => window.editMessage(btn);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  });

  function cancelEdit() {
    input.replaceWith(span);
    btn.textContent = "Edit";
    btn.onclick = () => window.editMessage(btn);
  }
};

window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  const username = document.getElementById("username").textContent;

  if (!confirm("Are you sure you want to delete this message?")) return;

  btn.disabled = true;
  btn.textContent = "Deleting...";

  socket.emit(
    "delete-message",
    { id: messageId, roomId, username },
    (response) => {
      if (response?.status === "error") {
        btn.disabled = false;
        btn.textContent = "Delete";
        alert("Failed to delete: " + response.message);
      }
    }
  );
};

// Utility functions
function linkify(text) {
  if (typeof text !== "string") return text;
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

// Room management
window.deleteRoom = function () {
  if (!confirm("Are you sure you want to delete the room?")) return;

  fetch("https://chat-application-howg.onrender.com/room/deleteroom", {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.message === "Room deleted.") {
        localStorage.removeItem("user");
        window.location.href = "mainPage.html";
      } else {
        console.error("Error deleting room:", data.message);
      }
    })
    .catch(console.error);
};

window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  }
};

window.togglePin = function (btn) {
  const messageCard = btn.closest(".message");
  const isPinned = messageCard.classList.toggle("pinned");
  btn.textContent = isPinned ? "Unpin" : "Pin";
};
