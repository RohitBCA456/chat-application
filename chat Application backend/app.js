import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import userRouter from "./router/user.router.js";
import messageRouter from "./router/message.router.js";
import roomRouter from "./router/room.router.js";
import http from "http";
import cookieParser from "cookie-parser";
import { setupSocket } from "./services/socket.js";
dotenv.config({ path: ".env" });

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  cors({
    origin: process.env.CLIENT_URL, // Example: "http://localhost:5173"
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use("/user", userRouter); // Route
app.use("/message", messageRouter);
app.use("/room", roomRouter);

const server = http.createServer(app);

// ✅ Attach socket logic
const io = setupSocket(server);

export { app, server };
