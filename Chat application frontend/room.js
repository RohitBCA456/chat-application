// declaring socket as global variable
let socket;
let isSocketReady = false;
const pendingMessages = new Set(); // For tracking optimistic messages
const displayedMessages = new Set(); // For tracking all displayed messages

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

  // Initialize socket
  // In your DOMContentLoaded handler
  socket = io("https://chat-application-howg.onrender.com", {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    autoConnect: true,
    auth: {
      username: username, // Send username during connection
    },
  });

  // Socket event handlers
  socket.on("connect", () => {
    console.log("✅ Connected to server");
    isSocketReady = true;
    socket.emit("join-room", roomId);
  });

  socket.on("disconnect", () => {
    isSocketReady = false;
    console.log("Disconnected from server");
  });

  socket.on("connect_error", (err) => {
    console.error("Connection error:", err);
    // Fallback to polling if websocket fails
    socket.io.opts.transports = ["polling", "websocket"];
  });

  // Message handlers
  socket.on("receive-message", ({ username, message, timestamp, _id }) => {
    // Skip if this is a message we're already showing optimistically
    if (!pendingMessages.has(_id)) {
      displayMessage(username, message, timestamp, _id);
    } else {
      pendingMessages.delete(_id); // Remove from pending set
    }
  });

  socket.on("load-messages", (messages) => {
    const chat = document.getElementById("chat");
    // Clear only if empty to prevent duplicates
    if (chat.children.length === 0) {
      messages.forEach(({ sender, content, timestamp, _id }) => {
        displayMessage(sender, content, timestamp, _id);
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
    if (messageCard) messageCard.remove();
  });

  socket.on("error", (errorMsg) => {
    console.error("Socket error:", errorMsg);
    alert(errorMsg);
  });

  // Fallback message fetch if socket takes too long
  const fallbackTimer = setTimeout(() => {
    if (!isSocketReady) {
      fetchMessageHistoryAndRender(roomId);
    }
  }, 2000);

  // Clean up fallback if socket connects
  socket.on("connect", () => {
    clearTimeout(fallbackTimer);
  });
});

// ... (keep all your existing code above) ...

// ✅ Send message function
window.sendMessage = function () {
  // ... (existing code until the optimistic UI update)

  // Optimistic UI update (temporary display)
  const tempId = "temp-" + Date.now();
  displayMessage(username, message, new Date(), tempId);
  input.value = "";
  input.focus();

  // Send via socket
  socket.emit(
    "send-message",
    {
      roomId,
      username,
      message,
      tempId, // Include tempId for server reference
    },
    (ack) => {
      if (ack?.error) {
        // Remove the optimistic message if failed
        const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
        if (tempMsg) tempMsg.remove();
        displayedMessages.delete(tempId);
        alert("Failed to send: " + ack.error);
      }
    }
  );

  // Fallback to HTTP after 2 seconds if no response
  const fallbackTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://chat-application-howg.onrender.com/message/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ roomId, username, message }),
        }
      );

      if (!res.ok) throw new Error("HTTP send failed");
      console.log("Message sent via HTTP fallback");
    } catch (error) {
      console.error("Fallback failed:", error);
      const tempMsg = document.querySelector(`[data-id="${tempId}"]`);
      if (tempMsg) tempMsg.remove();
      alert("Message failed to send. Please try again.");
    }
  }, 2000);

  // Cancel fallback if socket responds
  socket.once("receive-message", () => clearTimeout(fallbackTimer));
};

// ... (rest of your existing code below) ...

// ... rest of your room.js code remains the same ...
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
  // Skip if this message is already displayed
  if (messageId && displayedMessages.has(messageId)) {
    return;
  }

  const chat = document.getElementById("chat");

  // Remove any existing temporary message with this ID
  if (messageId && messageId.startsWith("temp-")) {
    const existingTemp = document.querySelector(`[data-id="${messageId}"]`);
    if (existingTemp) existingTemp.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    user === document.getElementById("username").textContent ? "mine" : "other"
  }`;

  if (messageId) {
    messageEl.dataset.id = messageId;
    displayedMessages.add(messageId); // Track displayed messages
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

  const actionBtns = document.createElement("div");
  actionBtns.className = "action-buttons";

  // Only show action buttons for user's own messages (excluding temp messages)
  if (
    user === document.getElementById("username").textContent &&
    (!messageId || !messageId.startsWith("temp-"))
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

  // If this is replacing a temporary message, insert in the same position
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
