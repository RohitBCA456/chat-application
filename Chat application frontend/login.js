// function to allow the user to login

async function login() {
  try {
    const username = document.getElementById("login-username").value.trim();
    if (!username) return alert("Please enter a username");

    // sending the credentials to the backend route for validation
    const response = await fetch(
      "https://chat-application-howg.onrender.com/user/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username }),
      }
    );

    // consoling the response for verification during development phase
    console.log(response);

    if (response.ok) {
      // alert message on successful login
      alert("login successfully.");
      window.location.href = "mainPage.html";
    } else {
      // alert if user entered wrong credentials
      alert("Wrong user name");
    }
  } catch (error) {
    // consoling the error if any occured
    console.log(error);
  }
}
