async function login() {
  const username = document.getElementById("login-username").value.trim();
  if (!username) return alert("Please enter a username");

  const response = await fetch("http://localhost:5000/user/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ username }),
  });

  console.log(response);

  if (response.ok) {
    alert("login successfully.");
    window.location.href = "mainPage.html";
  } else {
    alert("Wrong user name");
  }
}
