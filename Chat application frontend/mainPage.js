async function createRoom() {
  try {
    const createRes = await fetch("http://localhost:5000/user/createroom", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // send cookie to backend
    });

    const createData = await createRes.json();
    if (!createRes.ok) return alert(createData.message);

    // Save user info to localStorage
    localStorage.setItem(
      "user",
      JSON.stringify({
        username: createData.user,
        roomId: createData.roomId,
        isOwner: true,
      })
    );

    // ✅ Immediately update the list of rooms shown in the corner
    fetchRooms();

    // Redirect after short delay (optional)
    setTimeout(() => {
      window.location.href =
        "room.html";
    }, 500);
  } catch (error) {
    console.log("Create Room Error:", error);
    alert("Something went wrong while creating room.");
  }
}

async function joinRoom() {
  const roomId = document.getElementById("roomId").value.trim();
  if (!roomId) return alert("Enter the Room ID");

  try {
    const joinRes = await fetch("http://localhost:5000/user/joinroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ roomId }),
    });

    const joinData = await joinRes.json();
    console.log(joinData);
    const { user: username, isOwner } = joinData;
    if (!joinRes.ok) return alert(joinData.message);

    localStorage.setItem(
      "user",
      JSON.stringify({ username, roomId, isOwner }) // store isOwner
    );

    window.location.href = `room.html?room=${roomId}`;
  } catch (error) {
    console.error("Join Room Error:", error);
    alert("Something went wrong while joining the room.");
  }
}

async function fetchRooms() {
  try {
    const res = await fetch("https://chat-application-howg.onrender.com/room/getallroom");
    const rooms = await res.json();

    const roomContainer = document.getElementById("roomContainer");
    roomContainer.innerHTML = "";

    if (rooms.length === 0) {
      roomContainer.innerHTML = "<li>No rooms available</li>";
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = `👤 ${room.username} — 🆔 ${room.roomId}`;
      roomContainer.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    document.getElementById("roomContainer").innerHTML =
      "<li>Failed to load rooms</li>";
  }
}

window.addEventListener("DOMContentLoaded", fetchRooms);
