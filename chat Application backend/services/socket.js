// services/socketService.js
import { Server } from "socket.io";
import { Message } from "../model/message.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected", socket.id);

    // Track rooms for each socket
    const userRooms = new Set();

    // Join a room and load previous messages
    socket.on("join-room", async (roomId) => {
      try {
        if (userRooms.has(roomId)) {
          return socket.emit("joined-room");
        }

        await socket.join(roomId);
        userRooms.add(roomId);

        // Acknowledge join
        socket.emit("joined-room", roomId);

        // Load messages with pagination in production
        const messages = await Message.find({ roomId })
          .sort({ timestamp: 1 })
          .limit(100);

        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("room-error", "Failed to join room");
      }
    });

    // Send a message to room
    socket.on("send-message", async (data) => {
      const { username, roomId, message } = data;

      if (!userRooms.has(roomId)) {
        return socket.emit("error", "You must join the room first");
      }

      try {
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

        // Use io.to() to broadcast to all in room including sender
        io.to(roomId).emit("receive-message", messagePayload);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    // Edit a message in real-time
    socket.on("edit-message", async ({ id, newText, roomId }) => {
      if (!userRooms.has(roomId)) {
        return socket.emit("error", "You must join the room first");
      }

      try {
        const message = await Message.findById(id);
        if (!message) {
          return socket.emit("error", "Message not found");
        }

        // Verify sender is the one editing
        if (message.sender !== socket.request.session?.username) {
          return socket.emit("error", "You can only edit your own messages");
        }

        message.content = newText;
        await message.save({ validateBeforeSave: false });

        io.to(roomId).emit("message-edited", { id, newText });
      } catch (error) {
        console.error("Error editing message:", error);
        socket.emit("error", "Failed to edit message");
      }
    });

    // Delete a message in real-time
    // Update the delete-message handler in socket.js
    // Update the delete-message handler in socket.js
    socket.on("delete-message", async ({ id, roomId, username }) => {
      try {
        // Verify room membership
        if (!userRooms.has(roomId)) {
          socket.emit("error", "You must join the room first");
          return;
        }

        const message = await Message.findById(id);
        if (!message) {
          socket.emit("error", "Message not found");
          return;
        }

        // Verify ownership
        if (message.sender !== username) {
          socket.emit("error", "You can only delete your own messages");
          return;
        }

        await Message.findByIdAndDelete(id);
        io.to(roomId).emit("message-deleted", { id });
      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("error", "Failed to delete message");
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
      userRooms.clear();
    });
  });

  return io;
};
