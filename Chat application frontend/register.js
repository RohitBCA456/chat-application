async function register() {
  const username = document.getElementById("username").value.trim();
  if (!username) return alert("Please enter a username");

  try {
    const response = await fetch("http://localhost:5000/user/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // important for cookie handling
      body: JSON.stringify({ username }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Registration failed.");
      return;
    }
    alert("Registration successful!");
    localStorage.setItem("user", JSON.stringify(username));
    // Redirect to homepage
    window.location.href = "login.html";
  } catch (error) {
    console.error("Registration error:", error);
    alert("An error occurred. Please try again.");
  }
}
