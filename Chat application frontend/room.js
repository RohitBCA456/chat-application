// room.js

const socket = io("https://chat-application-howg.onrender.com");

// Get user data from localStorage
const userData = localStorage.getItem("user");
if (!userData) {
  alert("User not found!");
  window.location.href = "/"; // redirect to home
}

const { username, roomId, isOwner } = JSON.parse(userData);

// DOM elements
const chatContainer = document.getElementById("chat");
const messageInput = document.getElementById("message");
document.getElementById("room-id").innerText = roomId;
document.getElementById("username").innerText = username;

// Show/Hide delete/leave buttons
document.getElementById(isOwner ? "delete-room-btn" : "leave-room-btn").style.display =
  "inline-block";

// Join room
socket.emit("join-room", { roomId, username });

// Load message history
socket.on("load-messages", (messages) => {
  messages.forEach((msg) => appendMessage(msg));
});

// Receive message in real time
socket.on("new-message", (msg) => {
  appendMessage(msg);
});

// Handle user join
socket.on("user-joined", (name) => {
  appendSystemMessage(`${name} joined the room`);
});

// Handle user leave
socket.on("user-left", (name) => {
  appendSystemMessage(`${name} left the room`);
});

// Handle room deleted
socket.on("room-deleted", (roomId) => {
  alert(`Room ${roomId} has been deleted.`);
  localStorage.removeItem("user");
  window.location.href = "/";
});

// Handle error
socket.on("error", (msg) => {
  alert("Error: " + msg);
});

// Send message
function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;

  socket.emit("send-message", {
    content,
    roomId,
    sender: username,
  });

  messageInput.value = "";
}

// Leave room
function handleLeaveRoom() {
  socket.emit("leave-room", { roomId, username });
  localStorage.removeItem("user");
  window.location.href = "/";
}

// Delete room (only for owner)
function handleRoomDeleted() {
  const confirmed = confirm("Are you sure you want to delete this room?");
  if (!confirmed) return;

  socket.emit("delete-room", { roomId });
}

// Append message to chat box
function appendMessage({ sender, content, createdAt }) {
  const msg = document.createElement("div");
  msg.className = "message";
  msg.innerHTML = `<strong>${sender}</strong>: ${content} <span class="timestamp">${new Date(
    createdAt
  ).toLocaleTimeString()}</span>`;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Append system messages (like joined/left)
function appendSystemMessage(text) {
  const msg = document.createElement("div");
  msg.className = "system-message";
  msg.innerText = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
