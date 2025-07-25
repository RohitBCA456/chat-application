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
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // Track room memberships globally
  const roomMembers = new Map();

  io.on("connection", (socket) => {
    console.log("User connected", socket.id);
    let currentUsername = null;
    let currentRoomId = null;

    // Middleware to verify room membership
    const verifyRoomMembership = (roomId) => {
      if (
        !roomMembers.has(roomId) ||
        !roomMembers.get(roomId).has(currentUsername)
      ) {
        throw new Error("You must join the room first");
      }
      return true;
    };

    socket.on("join-room", async (roomId, username) => {
      try {
        currentUsername = username;
        currentRoomId = roomId;

        // Initialize room in map if not exists
        if (!roomMembers.has(roomId)) {
          roomMembers.set(roomId, new Set());
        }

        // Add user to room
        roomMembers.get(roomId).add(username);
        await socket.join(roomId);

        // Load messages
        const messages = await Message.find({ roomId })
          .sort({ timestamp: 1 })
          .limit(100);

        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Join room error:", error);
        socket.emit("room-error", error.message);
      }
    });

    // Update the send-message handler
    socket.on("send-message", async (data) => {
      const { roomId, username, message, tempId } = data;

      if (!roomMembers.has(roomId) || !roomMembers.get(roomId).has(username)) {
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
          tempId,
        };

        io.to(roomId).emit("receive-message", messagePayload);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    socket.on("delete-message", async ({ id, roomId, username }) => {
      try {
        verifyRoomMembership(roomId);

        const message = await Message.findById(id);
        if (!message) throw new Error("Message not found");
        if (message.sender !== username)
          throw new Error("You can only delete your own messages");

        await Message.findByIdAndDelete(id);
        io.to(roomId).emit("message-deleted", { id });
      } catch (error) {
        console.error("Delete message error:", error);
        socket.emit("error", error.message);
      }
    });

    socket.on("disconnect", () => {
      if (currentRoomId && currentUsername) {
        const room = roomMembers.get(currentRoomId);
        if (room) {
          room.delete(currentUsername);
          if (room.size === 0) {
            roomMembers.delete(currentRoomId);
          }
        }
      }
      console.log("User disconnected", socket.id);
    });
  });

  return io;
};
