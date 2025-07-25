// 🌐 Declare socket globally so it's accessible across all functions
let socket;

/**
 * 🔌 Initialize the socket connection and all event listeners
 * @param {Object} param0 - Object containing username and roomId
 */
function initSocket({ username, roomId }) {
  // Connect to the Socket.IO server
  socket = io("https://chat-application-howg.onrender.com", {
    transports: ["websocket"],
  });

  // 🧠 Debug every incoming event
  socket.onAny((event, ...args) => {
    console.log("📡 SOCKET EVENT:", event, args);
  });

  // After connecting to the socket server, join the specified room
  socket.on("connect", () => {
    console.log("🔗 Connected to socket server:", socket.id);
    socket.emit("join-room", roomId);
  });

  // Load message history from server
  socket.on("load-messages", (messages) => {
    console.log("📦 Loaded previous messages:", messages);
    const chat = document.getElementById("chat");
    chat.innerHTML = "";
    messages.forEach(({ sender, content, timestamp, _id }) => {
      displayMessage(sender, content, timestamp, _id);
    });
  });

  // Receive new message in real-time
  socket.on("receive-message", ({ username, message, timestamp, _id }) => {
    displayMessage(username, message, timestamp, _id);
  });

  // Update message after edit
  socket.on("message-edited", ({ id, newText }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      const span = messageCard.querySelector(".message-content span");
      if (span) span.innerHTML = linkify(newText);
    }
  });

  // Remove message after delete
  socket.on("message-deleted", ({ id }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) messageCard.remove();
  });
}

// 🚀 Setup DOM after page loads
document.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (!userData) return alert("User not found");

  const { username, roomId, isOwner } = JSON.parse(userData);

  // Set DOM elements
  document.getElementById("username").textContent = username;
  document.getElementById("room-id").textContent = roomId;
  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";

  // ✅ Initialize socket
  initSocket({ username, roomId });

  // 📨 Send message handler
  window.sendMessage = () => {
    const input = document.getElementById("message");
    const message = input.value.trim();
    if (!message) return;

    socket.emit("send-message", { username, roomId, message });
    input.value = "";
  };
});

// 📦 Render a message in the UI
function displayMessage(user, text, timestamp = null, messageId = null) {
  const chat = document.getElementById("chat");

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

  if (user === document.getElementById("username").textContent) {
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

// 🔗 Convert text URLs into clickable links
function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

// ✏️ Edit message
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

// ❌ Delete message
window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;

  if (!messageId) return;
  socket.emit("delete-message", { id: messageId, roomId });
};

// ❎ Leave room
window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  }
};

// 🗑️ Delete room
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

// 📌 Pin/Unpin a message
window.togglePin = function (btn) {
  const messageCard = btn.closest(".message");
  const isPinned = messageCard.classList.toggle("pinned");
  btn.textContent = isPinned ? "Unpin" : "Pin";
};

// 🧽 Close popups if clicked outside
document.addEventListener("click", (e) => {
  const isInsidePopup = e.target.closest(".message-popup");
  const isInsideMessage = e.target.closest(".message");
  if (!isInsidePopup && !isInsideMessage) {
    document.querySelectorAll(".message-popup").forEach((p) => p.remove());
  }
});
