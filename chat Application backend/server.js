// importing the essentials functions
import { app, server } from "./app.js";
import { connectDB } from "./database/db.js";

//Defining the port at which the express server and the socket server will run
const PORT = process.env.PORT || 3000; 

//trying to connect to the database
connectDB()
  .then(() => {
    app.on("error", (err) => {
      console.error(`Server error: ${err.message}`);
    });

    //listening to the port eg:3000
    server.listen(PORT, () => {
      console.log(`Server & Socket.IO running on port ${PORT}`);
    });
  })
  // catch the error if any occured and exit the current process
  .catch((error) => {
    console.error(`Failed to connect to the database: ${error.message}`);
    process.exit(1);
  });
