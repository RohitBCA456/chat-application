// room.js
let socket;
let isSocketReady = false;
let roomJoined = false;
let currentUser = null;
const pendingMessages = new Set();
const displayedMessages = new Set();

// Initialize
window.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (!userData) return (window.location.href = "mainPage.html");

  const user = JSON.parse(userData);
  const { username, roomId, isOwner } = user;
  currentUser = username;

  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = username;
  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";

  document.getElementById("message").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  initializeSocket(roomId, username);
});

function initializeSocket(roomId, username) {
  socket = io("https://chat-application-howg.onrender.com", {
    auth: { username },
  });

  socket.on("connect", () => {
    isSocketReady = true;
    socket.emit("join-room", roomId, username, (res) => {
      if (res?.status === "error") return alert(res.message);
      roomJoined = true;
    });
  });

  socket.on("disconnect", () => (isSocketReady = roomJoined = false));
  socket.on("receive-message", (msg) => handleIncomingMessage(msg));
  socket.on("load-messages", (msgs) =>
    msgs.forEach((m) => displayMessage(m.sender, m.content, m.timestamp, m._id))
  );
  socket.on("message-edited", ({ id, newText }) => {
    const span = document.querySelector(`[data-id='${id}'] span`);
    if (span) span.innerHTML = linkify(newText);
  });
  socket.on("message-deleted", ({ id }) => {
    const el = document.querySelector(`[data-id='${id}']`);
    if (el) el.remove();
  });
}

function sendMessage() {
  if (!roomJoined) return alert("Not in room yet");
  const user = JSON.parse(localStorage.getItem("user"));
  const input = document.getElementById("message");
  const message = input.value.trim();
  if (!message) return;

  const tempId = "temp-" + Date.now();
  displayMessage(user.username, message, new Date(), tempId);
  pendingMessages.add(tempId);
  input.value = "";

  socket.emit(
    "send-message",
    { roomId: user.roomId, username: user.username, message, tempId },
    (res) => {
      pendingMessages.delete(tempId);
      if (res?.error) {
        document.querySelector(`[data-id='${tempId}']`)?.remove();
        displayedMessages.delete(tempId);
        return alert("Send failed: " + res.error);
      }
    }
  );
}

function handleIncomingMessage({ username, message, timestamp, _id }) {
  if (displayedMessages.has(_id)) return;

  // Replace optimistic message
  const temp = [...pendingMessages][0];
  const tempEl = document.querySelector(`[data-id='${temp}']`);
  if (tempEl) {
    const newEl = createMessageElement(username, message, timestamp, _id);
    tempEl.replaceWith(newEl);
    displayedMessages.add(_id);
    displayedMessages.delete(temp);
    pendingMessages.delete(temp);
    return;
  }

  displayMessage(username, message, timestamp, _id);
}

function displayMessage(user, text, timestamp, id) {
  if (displayedMessages.has(id)) return;
  const chat = document.getElementById("chat");
  const msg = createMessageElement(user, text, timestamp, id);
  chat.appendChild(msg);
  msg.scrollIntoView({ behavior: "smooth" });
  displayedMessages.add(id);
}

function createMessageElement(user, text, timestamp, id) {
  const el = document.createElement("div");
  el.className = "message " + (user === currentUser ? "mine" : "other");
  el.dataset.id = id;

  const content = document.createElement("div");
  content.className = "message-content";
  content.innerHTML = `<p><strong>${user}:</strong> <span>${linkify(
    text
  )}</span></p>`;

  const ts = document.createElement("div");
  ts.className = "timestamp";
  ts.textContent = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const actions = document.createElement("div");
  actions.className = "action-buttons";
  if (id && !id.startsWith("temp-")) {
    if (user === currentUser) {
      actions.innerHTML += `<button onclick="editMessage(this)">Edit</button><button onclick="deleteMessage(this)">Delete</button>`;
    } else {
      actions.innerHTML += `<button onclick="togglePin(this)">Pin</button>`;
    }
  }

  content.appendChild(actions);
  el.append(content, ts);
  return el;
}

window.editMessage = function (btn) {
  const card = btn.closest(".message");
  const span = card.querySelector("span");
  const oldText = span.textContent.trim();
  const messageId = card.dataset.id;

  const input = document.createElement("input");
  input.type = "text";
  input.value = oldText;
  input.className = "edit-input";
  span.replaceWith(input);
  input.focus();

  btn.textContent = "Save";
  btn.onclick = saveEdit;

  function saveEdit() {
    const newText = input.value.trim();
    if (!newText || newText === oldText) {
      input.replaceWith(span);
      btn.textContent = "Edit";
      btn.onclick = () => editMessage(btn);
      return;
    }

    socket.emit(
      "edit-message",
      {
        id: messageId,
        newText,
        roomId: document.getElementById("room-id").textContent,
        username: currentUser,
      },
      (res) => {
        if (res?.status === "error") {
          alert("Failed to edit message: " + res.message);
          return;
        }

        const updatedSpan = document.createElement("span");
        updatedSpan.innerHTML = linkify(newText);
        input.replaceWith(updatedSpan);

        btn.textContent = "Edit";
        btn.onclick = () => editMessage(btn);
      }
    );
  }
};

window.deleteMessage = function (btn) {
  const card = btn.closest(".message");
  const messageId = card.dataset.id;
  const roomId = document.getElementById("room-id").textContent;

  if (!confirm("Delete this message?")) return;

  socket.emit(
    "delete-message",
    {
      id: messageId,
      roomId,
      username: currentUser,
    },
    (res) => {
      if (res?.status === "error") {
        alert("Failed to delete: " + res.message);
        return;
      }

      card.remove(); // Optimistic delete
    }
  );
};

window.togglePin = function (btn) {
  const msg = btn.closest(".message");
  const isPinned = msg.classList.toggle("pinned");
  btn.textContent = isPinned ? "Unpin" : "Pin";
};

function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}
