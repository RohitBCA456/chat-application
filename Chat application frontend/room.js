// declaring socket as global variable
let socket;

document.addEventListener("DOMContentLoaded", () => {
  const userData = localStorage.getItem("user");
  if (!userData) return alert("User not found");

  const user = JSON.parse(userData);
  const { username, roomId, isOwner } = user;

  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";
  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = username;

  // ✅ Join the room and fetch messages after connection established
  // Ensure socket is connected before emitting
  function waitForSocketConnection(callback) {
    if (socket && socket.connected) {
      callback();
    } else {
      setTimeout(() => waitForSocketConnection(callback), 100);
    }
  }

  // ✅ Initialize socket only once
  socket = io("https://chat-application-howg.onrender.com");

  waitForSocketConnection(() => {
    console.log("✅ Connected to server");
    socket.emit("join-room", roomId);
    fetchMessageHistoryAndRender(roomId); // fallback fetch
  });

  // ✅ Real-time receive message
  socket.on("receive-message", ({ username, message, timestamp, _id }) => {
    displayMessage(username, message, timestamp, _id);
  });

  // ✅ Load old messages after join-room
  socket.on("load-messages", (messages) => {
    messages.forEach(({ sender, content, timestamp, _id }) => {
      displayMessage(sender, content, timestamp, _id);
    });
  });

  // ✅ Edit message in real-time
  socket.on("message-edited", ({ id, newText }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      const span = messageCard.querySelector(".message-content span");
      if (span) span.innerHTML = linkify(newText);
    }
  });

  // ✅ Delete message in real-time
  socket.on("message-deleted", ({ id }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) messageCard.remove();
  });

  // ✅ Send message function
  window.sendMessage = function () {
    const input = document.getElementById("message");
    const message = input.value.trim();
    if (!message) return;

    socket.emit("send-message", { roomId, username, message });
    input.value = "";

    // Force full reload after sending
    setTimeout(() => {
      location.reload(); // refresh the whole page
    }, 500); // Give server some time to process
  };
});

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
      displayMessage(sender, content, timestamp, _id);
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
  }
}

// ✅ Display message bubble
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
window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  if (!messageId) return console.error("Message ID not found");
  socket.emit("delete-message", { id: messageId, roomId });
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
