//importing the essentials functions and packages
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userRouter from "./router/user.router.js";
import messageRouter from "./router/message.router.js";
import roomRouter from "./router/room.router.js";
import http from "http";
import cookieParser from "cookie-parser";
import { setupSocket } from "./services/socket.js";
import { logger } from "./middleware/logger.js";
// configuring .env file to load the environment variables
dotenv.config({ path: ".env" });

// creating the server using the express library
const app = express();
//essential setup for the data flow
app.use(express.json());
app.use(cookieParser());
app.use(logger)
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

//defining the frontend url and methods 
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// redirecting to backend router page as per incoming request
app.use("/user", userRouter); // Route
app.use("/message", messageRouter);
app.use("/room", roomRouter);

// creating the http server for socket io connection
const server = http.createServer(app);

// ✅ Attach socket logic
const io = setupSocket(server);

//exporting the variables
export { app, server };
