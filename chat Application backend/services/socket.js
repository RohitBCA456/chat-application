// services/socketService.js
import { Server } from "socket.io";
import { Message } from "../model/message.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://127.0.0.1:5500",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected", socket.id);

    // 🔗 Join a room and load previous messages
    socket.on("join-room", async (roomId) => {
      try {
        socket.join(roomId);
        const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    });

    // ✉️ Send a message to room
    socket.on("send-message", async (data) => {
      const { username, roomId, message } = data;
      try {
        const newMessage = new Message({
          roomId,
          sender: username,
          content: message,
        });
        await newMessage.save();

        io.to(roomId).emit("receive-message", {
          username,
          message,
          timestamp: newMessage.timestamp,
          _id: newMessage._id,
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    // 📝 Edit a message in real-time
    socket.on("edit-message", async ({ id, newText, roomId }) => {
      try {
        const message = await Message.findById(id);
        if (message) {
          message.content = newText;
          await message.save({ validateBeforeSave: false });

          io.to(roomId).emit("message-edited", {
            id,
            newText,
          });
        }
      } catch (error) {
        console.error("Error editing message:", error);
      }
    });

    // ❌ Delete a message in real-time
    socket.on("delete-message", async ({ id, roomId }) => {
      try {
        const deleted = await Message.findByIdAndDelete(id);
        if (deleted) {
          io.to(roomId).emit("message-deleted", { id });
          socket.emit("message-deleted", { id });
        }
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    });

    // 🔌 Handle disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  return io;
};
