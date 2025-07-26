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

    // Add a small delay to ensure room is properly created on server
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Redirect to room page
    window.location.href = `room.html?room=${createData.roomId}`;
  } catch (error) {
    console.error("Create Room Error:", error);
    alert("Something went wrong while creating room.");
  }
}

// function to join room using the roomId
async function joinRoom() {
  // getting roomId as input
  const roomId = document.getElementById("roomId").value.trim();
  if (!roomId) return alert("Enter the Room ID");

  try {
    // sending the roomId to join the room using the backend route
    const joinRes = await fetch(
      "https://chat-application-howg.onrender.com/user/joinroom",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId }),
      }
    );

    // storing the response in the joinData variable
    const joinData = await joinRes.json();
    console.log(joinData);
    // extracting the username and isOwner data from the response
    const { user: username, isOwner } = joinData;
    // if no response or valid data is provided return alert message of the issue that occured
    if (!joinRes.ok) return alert(joinData.message);

    // storing the response in the localStorage of the browser
    localStorage.setItem("user", JSON.stringify({ username, roomId, isOwner }));

    // redirecting the user to room.html page on successful joinRoom
    window.location.href = `room.html?room=${roomId}`;
  } catch (error) {
    // consoling and sending alert message if any error occurred
    console.error("Join Room Error:", error);
    alert("Something went wrong while joining the room.");
  }
}

// function to fetchRooms that exist
async function fetchRooms() {
  try {
    //get all the rooms that are currently available
    const res = await fetch(
      "https://chat-application-howg.onrender.com/room/getallroom"
    );
    const rooms = await res.json();

    const roomContainer = document.getElementById("roomContainer");
    roomContainer.innerHTML = "";

    // if no room found
    if (rooms.length === 0) {
      roomContainer.innerHTML = "<li>No rooms available</li>";
      return;
    }

    // displaying the rooms in the ui
    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = `👤 ${room.username} — 🆔 ${room.roomId}`;
      roomContainer.appendChild(li);
    });
  } catch (error) {
    //consoling and sending error message if any occured
    console.error("Error fetching rooms:", error);
    document.getElementById("roomContainer").innerHTML =
      "<li>Failed to load rooms</li>";
  }
}

// EventListener to listen on DomContentLoad
window.addEventListener("DOMContentLoaded", fetchRooms);
