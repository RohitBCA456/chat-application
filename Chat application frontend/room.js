// declaring socket as global variable
let socket;

// onLoad function
document.addEventListener("DOMContentLoaded", () => {
  // fetching the user from localStorage
  const userData = localStorage.getItem("user");
  if (!userData) return alert("User not found");

  //parse the userData to JSON and save it to user variable
  const user = JSON.parse(userData);
  const { username, roomId, isOwner } = user;

  document.getElementById(
    isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";

  // fetching the input values
  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = username;

  //initializing the socket connection with the server
  socket = io("https://chat-application-howg.onrender.com");

  // connecting and emitting join-room function from backend
  socket = io("https://chat-application-howg.onrender.com");

  socket.on("connect", () => {
    console.log("✅ Connected to server");
    socket.emit("join-room", roomId); // only emit here

    // Fetch again in case socket fails
    fetchMessageHistoryAndRender(roomId);
  });

  // receiving message from socket connection by the receiver
  socket.on("receive-message", ({ username, message, timestamp, _id }) => {
    displayMessage(username, message, timestamp, _id);
  });

  // laod-message function to load each and every message on real-time
  socket.on("load-messages", (messages) => {
    messages.forEach(({ sender, content, timestamp, _id }) => {
      displayMessage(sender, content, timestamp, _id);
    });
  });

  //edit-message function to edit message at real-time
  socket.on("message-edited", ({ id, newText }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      const span = messageCard.querySelector(".message-content span");
      if (span) span.innerHTML = linkify(newText);
    }
  });

  //delete-message function to delete message at real-time
  socket.on("message-deleted", ({ id }) => {
    const messageCard = document.querySelector(`[data-id="${id}"]`);
    if (messageCard) {
      messageCard.remove();
    }
  });

  //function to send message at real-time
  // Function to send message at real-time
  window.sendMessage = function () {
    const input = document.getElementById("message");
    const message = input.value.trim();
    if (!message) return;

    socket.emit("send-message", { roomId, username, message });

    input.value = "";

    // 🔁 Re-fetch history after sending message (fallback if socket fails)
    setTimeout(() => {
      fetchMessageHistoryAndRender(roomId);
    }, 500); // Slight delay to allow message to be saved
  };
});

// allowing users to send links that are clickable
function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

async function fetchMessageHistoryAndRender(roomId) {
  try {
    const response = await fetch(
      `https://chat-application-howg.onrender.com/message/messages/${roomId}`
    );
    const data = await response.json();
    if (!Array.isArray(data.messages)) return;

    // Clear existing chat to avoid duplication
    document.getElementById("chat").innerHTML = "";

    // Re-render messages
    data.messages.forEach(({ sender, content, timestamp, _id }) => {
      displayMessage(sender, content, timestamp, _id);
    });
  } catch (error) {
    console.error("Error fetching message history:", error);
  }
}

// function to display the message just after send-message function
function displayMessage(user, text, timestamp = null, messageId = null) {
  const chat = document.getElementById("chat");
  const messageEl = document.createElement("div");
  messageEl.className = `message ${
    user === document.getElementById("username").textContent ? "mine" : "other"
  }`;
  if (messageId) messageEl.dataset.id = messageId;

  // display the time : when the message was send
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

  // allow only the sender to delete and edit the message
  if (user === document.getElementById("username").textContent) {
    actionBtns.innerHTML += `
      <button onclick="editMessage(this)" class="pop-up-btn">Edit</button>
      <button onclick="deleteMessage(this)" class="pop-up-btn">Delete</button>
    `;
  }

  // the receiver can only pin the message
  const isPinned = messageEl.classList.contains("pinned");
  actionBtns.innerHTML += `<button onclick="togglePin(this)" class="pop-up-btn">${
    isPinned ? "Unpin" : "Pin"
  }</button>`;

  content.appendChild(actionBtns);
  messageEl.append(content, ts);

  messageEl.addEventListener("click", (e) => e.stopPropagation());

  chat.appendChild(messageEl);
  messageEl.scrollIntoView({ behavior: "smooth" });
}

// function to edit the message
window.editMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;

  const span = messageCard.querySelector(".message-content span");
  const oldText = span.textContent.trim();

  // Prevent multiple inputs
  if (messageCard.querySelector("input.edit-input")) return;

  const input = document.createElement("input");
  input.type = "text";
  input.value = oldText;
  input.className = "edit-input";

  // Replace span with input
  span.replaceWith(input);
  input.focus();

  // Change button to Save
  btn.textContent = "Save";
  btn.onclick = () => saveEdit();

  function saveEdit() {
    const newText = input.value.trim();
    if (!newText || newText === oldText) {
      cancelEdit();
      return;
    }

    // Emit edit to backend
    socket.emit("edit-message", { id: messageId, newText, roomId });

    // Replace input with updated span
    const updatedSpan = document.createElement("span");
    updatedSpan.innerHTML = linkify(newText);
    input.replaceWith(updatedSpan);

    // Revert Save button to Edit
    btn.textContent = "Edit";
    btn.onclick = () => window.editMessage(btn);
  }

  // Allow Enter/Escape support
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

// function to delete the message
window.deleteMessage = function (btn) {
  const messageCard = btn.closest(".message");
  const messageId = messageCard.dataset.id;
  const roomId = document.getElementById("room-id").textContent;
  if (!messageId) return console.error("Message ID not found");
  socket.emit("delete-message", { id: messageId, roomId });
};

// delete room function
window.deleteRoom = function () {
  if (!confirm("Are you sure you want to delete the room?")) return;
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user?.roomId) return console.error("Room ID not found in localStorage.");

  // get method to delete the room of the current user by extracting the user.id from the auth.js middleware at backend
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
        fetchRooms();
      } else {
        console.error("Error deleting room:", data.message);
      }
    })
    .catch(console.error);
};

//leaving room function for the user that joined the room and is not the owner of the room
window.leaveRoom = function () {
  if (confirm("Are you sure you want to leave the room?")) {
    //removing the user data from localStorage and redirecting to mainPage.html
    localStorage.removeItem("user");
    window.location.href = "mainPage.html";
  }
};
//functionality to pin and unpin the message
window.togglePin = function (btn) {
  const messageCard = btn.closest(".message");
  const isPinned = messageCard.classList.toggle("pinned");
  btn.textContent = isPinned ? "Unpin" : "Pin";
  messageCard.querySelector(".message-popup")?.remove();
};

//functionality to track the status ispinned or not
document.addEventListener("click", (e) => {
  const isInsidePopup = e.target.closest(".message-popup");
  const isInsideMessage = e.target.closest(".message");
  if (!isInsidePopup && !isInsideMessage) {
    document.querySelectorAll(".message-popup").forEach((p) => p.remove());
  }
});
