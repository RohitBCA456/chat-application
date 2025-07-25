// declaring socket as global variable
let socket;
let isSocketReady = false;
const messageCache = new Set();
const messageQueue = []; // Added missing message queue declaration

document.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (!userData) return alert("User not found");

  const user = JSON.parse(userData);
  const { username, roomId, isOwner } = user;

  // Initialize UI elements
  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";
  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = username;

  // Initialize socket with error handling
  try {
    socket = io("https://chat-application-howg.onrender.com", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      auth: { username, roomId },
      transports: ["websocket", "polling"],
    });

    // Set up all socket event handlers
    setupSocketHandlers();

    // Process queued messages when connection is restored
    socket.on("connect", () => {
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        sendMessageNow(msg);
      }
    });
  } catch (error) {
    console.error("Socket initialization failed:", error);
    alert("Connection error. Please refresh the page.");
  }
});

function setupSocketHandlers() {
  // Socket event handlers
  socket.on("connect", () => {
    console.log("✅ Connected to server");
    isSocketReady = true;
    const user = JSON.parse(localStorage.getItem("user"));
    socket.emit("join-room", { roomId: user.roomId, username: user.username });
  });

  socket.on("disconnect", () => {
    isSocketReady = false;
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
  });

  // Message handlers
  socket.on("receive-message", ({ username, message, timestamp, _id }) => {
    if (!messageCache.has(_id)) {
      messageCache.add(_id);
      displayMessage(username, message, timestamp, _id);
    }
  });

  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    if (chat.children.length === 0) {
      messages.forEach(({ sender, content, timestamp, _id }) => {
        if (!messageCache.has(_id)) {
          messageCache.add(_id);
          displayMessage(sender, content, timestamp, _id);
        }
      });
    }
  });

  socket.on("message-edited", ({ id, newText }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      const span = messageCard.querySelector(".message-content span");
      if (span) span.innerHTML = linkify(newText);
    }
  });

  socket.on("message-deleted", ({ id }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      messageCard.remove();
      messageCache.delete(id);
    }
  });

  socket.on("error", (errorMsg) => {
    console.error("Socket error:", errorMsg);
    alert(errorMsg);
  });

  // Fallback message fetch
  const fallbackTimer = setTimeout(() => {
    if (!isSocketReady) {
      const user = JSON.parse(localStorage.getItem("user"));
      fetchMessageHistoryAndRender(user.roomId);
    }
  }, 2000);

  socket.on("connect", () => {
    clearTimeout(fallbackTimer);
  });
}

// ... rest of your existing functions ...

// ✅ Send message function with better error handling
window.sendMessage = function () {
  if (!socket) {
    alert("Connection not initialized. Please refresh the page.");
    return;
  }

  const userData = localStorage.getItem("user");
  if (!userData) {
    alert("Session expired. Please rejoin the room.");
    window.location.href = "mainPage.html";
    return;
  }

  const { username, roomId } = JSON.parse(userData);
  const input = document.getElementById("message");
  const message = input.value.trim();

  if (!message) return;

  const messageData = {
    roomId,
    username,
    message,
    tempId: "temp-" + Date.now(),
  };

  displayMessage(username, message, new Date(), messageData.tempId);
  input.value = "";
  input.focus();

  if (isSocketReady) {
    sendMessageNow(messageData);
  } else {
    messageQueue.push(messageData);
    alert(
      "Connection unstable. Message will be sent when connection is restored"
    );
  }
};

function sendMessageNow({ roomId, username, message, tempId }) {
  socket.emit("send-message", { roomId, username, message }, (ack) => {
    const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
    if (ack?.error) {
      if (tempMsg) tempMsg.remove();
      alert("Failed to send: " + ack.error);
    }
  });
}

// ... rest of your existing code ...

function sendMessageNow({ roomId, username, message, tempId }) {
  socket.emit("send-message", { roomId, username, message }, (ack) => {
    const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
    if (ack?.error) {
      if (tempMsg) tempMsg.remove();
      alert("Failed to send: " + ack.error);
    }
  });
}

// Process queued messages when connection is restored
socket.on("connect", () => {
  while (messageQueue.length > 0) {
    const msg = messageQueue.shift();
    sendMessageNow(msg);
  }
});

// ✅ Delete message (updated with proper error handling)
window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  const username = document.getElementById("username").textContent;

  if (!messageId) return console.error("Message ID not found");

  if (!confirm("Are you sure you want to delete this message?")) return;

  btn.disabled = true;
  btn.textContent = "Deleting...";

  socket.emit(
    "delete-message",
    { id: messageId, roomId, username },
    (response) => {
      btn.disabled = false;
      btn.textContent = "Delete";
      if (response?.error) {
        alert(response.error);
      }
    }
  );
};

// ... (rest of your existing helper functions remain the same) ...

// ✅ Make URLs clickable in messages
function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

// ✅ Fetch and render messages
async function fetchMessageHistoryAndRender(roomId) {
  try {
    const res = await fetch(
      `https://chat-application-howg.onrender.com/message/messages/${roomId}`
    );
    const data = await res.json();
    if (!Array.isArray(data.messages)) return;

    const chat = document.getElementById("chat");
    chat.innerHTML = "";
    data.messages.forEach(({ sender, content, timestamp, _id }) => {
      if (!messageCache.has(_id)) {
        messageCache.add(_id);
        displayMessage(sender, content, timestamp, _id);
      }
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
}

// ✅ Display message bubble (updated to handle temporary messages)
function displayMessage(user, text, timestamp = null, messageId = null) {
  const chat = document.getElementById("chat");

  // Remove any existing temporary message from this user
  if (messageId && messageId.startsWith("temp-")) {
    const existingTemp = document.querySelector(`[data-id="${messageId}"]`);
    if (existingTemp) existingTemp.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    user === document.getElementById("username").textContent ? "mine" : "other"
  }`;
  if (messageId) messageEl.dataset.id = messageId;

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

  const actionBtns = document.createElement("div");
  actionBtns.className = "action-buttons";

  if (
    user === document.getElementById("username").textContent &&
    !messageId.startsWith("temp-")
  ) {
    actionBtns.innerHTML += `
      <button onclick="editMessage(this)" class="pop-up-btn edit-btn">Edit</button>
      <button onclick="deleteMessage(this)" class="pop-up-btn delete-btn">Delete</button>
    `;
  }

  const isPinned = messageEl.classList.contains("pinned");
  actionBtns.innerHTML += `<button onclick="togglePin(this)" class="pop-up-btn pin-btn">${
    isPinned ? "Unpin" : "Pin"
  }</button>`;

  content.appendChild(actionBtns);
  messageEl.append(content, ts);
  chat.appendChild(messageEl);
  messageEl.scrollIntoView({ behavior: "smooth" });
}

// ✅ Edit message functionality
window.editMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;

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

    socket.emit("edit-message", { id: messageId, newText, roomId });

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

// ✅ Delete message
// Update the deleteMessage function in room.js
window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  const username = document.getElementById("username").textContent;

  if (!messageId) {
    console.error("Message ID not found");
    return;
  }

  if (!confirm("Are you sure you want to delete this message?")) {
    return;
  }

  // Disable button during operation
  btn.disabled = true;
  btn.textContent = "Deleting...";

  socket.emit("delete-message", {
    id: messageId,
    roomId,
    username,
  });
};

// ✅ Delete room
window.deleteRoom = function () {
  if (!confirm("Are you sure you want to delete the room?")) return;
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user?.roomId) return;

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

// ✅ Leave room
window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  }
};

// ✅ Pin message
window.togglePin = function (btn) {
  const messageCard = btn.closest(".message");
  const isPinned = messageCard.classList.toggle("pinned");
  btn.textContent = isPinned ? "Unpin" : "Pin";
};

// ✅ Dismiss popup (safety)
document.addEventListener("click", (e) => {
  const isInsidePopup = e.target.closest(".message-popup");
  const isInsideMessage = e.target.closest(".message");
  if (!isInsidePopup && !isInsideMessage) {
    document.querySelectorAll(".message-popup").forEach((p) => p.remove());
  }
});
