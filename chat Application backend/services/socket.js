// services/socket.js
import { Server } from "socket.io";
import { Message } from "../model/message.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Join specific room
    socket.on("join-room", async (roomId) => {
      socket.join(roomId);
      const messages = await Message.find({ roomId }).sort({ createdAt: 1 });
      socket.emit("load-messages", messages);
    });

    // Send new message
    socket.on("send-message", async ({ text, roomId }) => {
      const newMessage = new Message({ text, roomId, socketId: socket.id });
      await newMessage.save();
      io.to(roomId).emit("new-message", newMessage);
    });

    // Edit message
    socket.on("edit-message", async ({ id, newText }) => {
      const msg = await Message.findById(id);
      if (msg && msg.socketId === socket.id) {
        msg.text = newText;
        await msg.save();
        io.to(msg.roomId).emit("update-message", msg);
      }
    });

    // Delete message
    socket.on("delete-message", async (id) => {
      const msg = await Message.findById(id);
      if (msg && msg.socketId === socket.id) {
        await Message.deleteOne({ _id: id });
        io.to(msg.roomId).emit("remove-message", id);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};
