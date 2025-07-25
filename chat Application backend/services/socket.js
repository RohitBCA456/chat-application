// services/socketService.js
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
    console.log("User connected", socket.id);

    // Join a room and load previous messages
    socket.on("join-room", async (roomId) => {
      try {
        socket.join(roomId);

        // Acknowledge join before sending messages
        socket.emit("joined-room");

        const messages = await Message.find({ roomId }).sort({ timestamp: 1 });

        // Now send messages
        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    });

    // Send a message to room
    socket.on("send-message", async (data) => {
      const { username, roomId, message } = data;
      try {
        // Ensure the sender is in the room (safety check)
        if (!socket.rooms.has(roomId)) {
          socket.join(roomId);
        }

        const newMessage = new Message({
          roomId,
          sender: username,
          content: message,
        });

        await newMessage.save();

        const messagePayload = {
          username,
          message,
          timestamp: newMessage.timestamp,
          _id: newMessage._id,
        };

        // Emit to everyone in the room except sender
        socket.to(roomId).emit("receive-message", messagePayload);

        // Emit to sender directly
        socket.emit("receive-message", messagePayload);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    // Edit a message in real-time
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

    // Delete a message in real-time
    socket.on("delete-message", async ({ id, roomId }) => {
      try {
        const deleted = await Message.findByIdAndDelete(id);
        if (deleted) {
          io.to(roomId).emit("message-deleted", { id });
          socket.emit("message-deleted", { id }); // Optional direct emit
        }
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
    });
  });

  return io;
};
