// socket.js
import { Server } from "socket.io";
import { Message } from "../model/message.model.js";
import { Room } from "../model/room.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ New connection:", socket.id);

    // Join room
    socket.on("join-room", async ({ roomId, username }) => {
      try {
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) {
          return socket.emit("error", `Room "${roomId}" does not exist`);
        }

        await socket.join(roomId);
        console.log(`${username} joined room: ${roomId}`);

        const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
        socket.emit("load-messages", messages);
        socket.to(roomId).emit("user-joined", username);
      } catch (err) {
        console.error(err.message);
        socket.emit("error", "Failed to join room");
      }
    });

    // Send message
    socket.on("send-message", async ({ roomId, sender, content }) => {
      try {
        const message = new Message({ roomId, sender, content });
        await message.save();

        io.to(roomId).emit("new-message", message);
      } catch (err) {
        console.error(err.message);
        socket.emit("error", "Failed to send message");
      }
    });

    // Leave room
    socket.on("leave-room", ({ roomId, username }) => {
      socket.leave(roomId);
      console.log(`${username} left room: ${roomId}`);
      socket.to(roomId).emit("user-left", username);
    });

    // Delete room (by owner or admin)
    socket.on("delete-room", async ({ roomId }) => {
      try {
        await Room.deleteOne({ roomId });
        await Message.deleteMany({ roomId });

        io.to(roomId).emit("room-deleted", roomId);
        io.socketsLeave(roomId); // force everyone to leave
        console.log(`🗑️ Room deleted: ${roomId}`);
      } catch (err) {
        console.error(err.message);
        socket.emit("error", "Failed to delete room");
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });

  return io;
};
