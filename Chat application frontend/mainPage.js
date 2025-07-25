// 🚪 Function to create a new room
async function createRoom() {
  try {
    const createRes = await fetch(
      "https://chat-application-howg.onrender.com/user/createroom",
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    );

    console.log("🟡 createRes:", createRes);

    const createData = await createRes.json().catch((err) => {
      console.error("❌ Failed to parse JSON from createRes", err);
      throw new Error("Invalid JSON from server");
    });

    console.log("🟢 createData:", createData);

    if (!createRes.ok) return alert(createData.message || "Server error");

    const { user: username, roomId } = createData;

    localStorage.setItem(
      "user",
      JSON.stringify({ username, roomId, isOwner: true })
    );

    const socket = io("https://chat-application-howg.onrender.com");

    window.location.href = `room.html?room=${roomId}`;
  } catch (error) {
    console.error("❌ Create Room Error:", error);
    alert("Something went wrong while creating room.");
  }
}

// 🔑 Function to join an existing room by Room ID
async function joinRoom() {
  const roomId = document.getElementById("roomId").value.trim();
  if (!roomId) return alert("Enter the Room ID");

  try {
    // 🔗 Request backend to join an existing room
    const joinRes = await fetch(
      "https://chat-application-howg.onrender.com/user/joinroom",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId }),
      }
    );

    // 🔄 Parse response JSON
    const joinData = await joinRes.json();
    if (!joinRes.ok) return alert(joinData.message); // ⚠️ Show error if join failed

    const { user: username, isOwner } = joinData;

    // 💾 Save joined user info to localStorage
    localStorage.setItem("user", JSON.stringify({ username, roomId, isOwner }));

    // 👉 Redirect to the chat room
    window.location.href = `room.html?room=${roomId}`;
  } catch (error) {
    console.error("❌ Join Room Error:", error);
    alert("Something went wrong while joining the room.");
  }
}

// 📋 Function to fetch and display all available rooms
async function fetchRooms() {
  try {
    const res = await fetch(
      "https://chat-application-howg.onrender.com/room/getallroom"
    );
    const rooms = await res.json();

    const roomContainer = document.getElementById("roomContainer");
    roomContainer.innerHTML = "";

    // 🚫 No rooms found
    if (rooms.length === 0) {
      roomContainer.innerHTML = "<li>No rooms available</li>";
      return;
    }

    // ✅ Render available rooms
    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = `👤 ${room.username} — 🆔 ${room.roomId}`;
      roomContainer.appendChild(li);
    });
  } catch (error) {
    console.error("❌ Error fetching rooms:", error);
    document.getElementById("roomContainer").innerHTML =
      "<li>Failed to load rooms</li>";
  }
}

// 📦 Load all rooms when the page is ready
window.addEventListener("DOMContentLoaded", fetchRooms);
