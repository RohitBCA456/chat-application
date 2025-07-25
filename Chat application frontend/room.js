// Declare global variables
let socket;
let currentUser = null;
let roomId = null;

// DOM Elements
const chatContainer = document.getElementById("chat");
const messageInput = document.getElementById("message");

// Get user data from localStorage
document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("user");
  if (!stored) return alert("User not found in localStorage");

  currentUser = JSON.parse(stored);
  roomId = currentUser.roomId;

  document.getElementById("room-id").textContent = roomId;
  document.getElementById("username").textContent = currentUser.username;

  // Show appropriate button
  document.getElementById(
    currentUser.isOwner ? "delete-room-btn" : "leave-room-btn"
  ).style.display = "inline-block";

  initializeSocket();
});

function initializeSocket() {
  socket = io("https://chat-application-howg.onrender.com", {
    withCredentials: true,
  });

  socket.emit("join-room", roomId);

  socket.on("load-messages", (messages) => {
    chatContainer.innerHTML = "";
    messages.forEach((msg) => addMessageToUI(msg));
  });

  socket.on("new-message", (msg) => {
    addMessageToUI(msg);
  });

  socket.on("update-message", (updatedMsg) => {
    const msgDiv = document.getElementById(updatedMsg._id);
    if (msgDiv) {
      msgDiv.querySelector(".msg-text").textContent = updatedMsg.text;
    }
  });

  socket.on("remove-message", (id) => {
    const msgDiv = document.getElementById(id);
    if (msgDiv) msgDiv.remove();
  });
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (text === "") return;

  socket.emit("send-message", { text, roomId });
  messageInput.value = "";
}

function addMessageToUI(msg) {
  const div = document.createElement("div");
  div.className = "message";
  div.id = msg._id;

  const isOwner = msg.socketId === socket.id;

  div.innerHTML = `
    <span class="msg-text">${msg.text}</span>
    ${isOwner ? `
      <span class="msg-actions">
        <button onclick="editMessage('${msg._id}')">✏️</button>
        <button onclick="deleteMessage('${msg._id}')">🗑️</button>
      </span>
    ` : ""}
  `;

  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function editMessage(id) {
  const msgDiv = document.getElementById(id);
  const currentText = msgDiv.querySelector(".msg-text").textContent;
  const newText = prompt("Edit your message:", currentText);

  if (newText && newText.trim()) {
    socket.emit("edit-message", { id, newText: newText.trim() });
  }
}

function deleteMessage(id) {
  const confirmDelete = confirm("Are you sure you want to delete this message?");
  if (confirmDelete) {
    socket.emit("delete-message", id);
  }
}

function deleteRoom() {
  // You should also notify the backend if required
  localStorage.removeItem("user");
  alert("Room deleted");
  window.location.href = "/"; // or any landing page
}

function leaveRoom() {
  localStorage.removeItem("user");
  alert("You left the room");
  window.location.href = "/"; // or any landing page
}
