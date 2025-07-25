
// function to register the user
async function register() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("Please enter a username");

  try {
    // sending post request to the backend route to save the data in the database
    const response = await fetch("https://chat-application-howg.onrender.com/user/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Registration failed.");
      return;
    }
    // alert message after successfully registering the user
    alert("Registration successful!");
    localStorage.setItem("user", JSON.stringify(username));
    // Redirect to homepage
    window.location.href = "login.html";
  } catch (error) {
    console.error("Registration error:", error);
    alert("An error occurred. Please try again.");
  }
}
