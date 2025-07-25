import { Server } from "socket.io";
import { Message } from "../model/message.model.js";
import { Room } from "../model/room.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ New connection:", socket.id);
    const userRooms = new Set();

    // Join room handler
    socket.on("join-room", async (roomId, username, callback = () => {}) => {
      try {
        // Validate room exists
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) throw new Error("Room doesn't exist");

        // Leave previous rooms
        userRooms.forEach(r => {
          socket.leave(r);
          userRooms.delete(r);
        });

        // Join new room
        await socket.join(roomId);
        userRooms.add(roomId);
        console.log(`👤 ${username} joined ${roomId}`);

        // Load messages
        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);
        
        callback({ status: "success" });
        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Join error:", error.message);
        callback({ status: "error", message: error.message });
      }
    });

    // Message handler
    socket.on("send-message", async ({ content, roomId, username, tempId }, callback = () => {}) => {
      try {
        if (!content?.trim() || !roomId || !username) {
          throw new Error("Invalid message data");
        }

        // Verify user is in the room
        if (!userRooms.has(roomId)) {
          throw new Error("Not in room");
        }

        // Create and save message
        const newMessage = new Message({ 
          content: content.trim(), 
          roomId, 
          sender: username 
        });
        await newMessage.save();

        // Broadcast with both IDs for reconciliation
        io.to(roomId).emit("new-message", {
          ...newMessage.toObject(),
          tempId // Include tempId for sender
        });

        callback({ status: "success" });
      } catch (error) {
        console.error("Send error:", error.message);
        callback({ status: "error", message: error.message });
      }
    });

    // Room management
    socket.on("delete-room", async (roomId, callback = () => {}) => {
      try {
        await Message.deleteMany({ roomId });
        await Room.deleteOne({ roomId });
        io.to(roomId).emit("room-deleted");
        callback({ status: "success" });
      } catch (error) {
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("leave-room", (roomId, callback = () => {}) => {
      try {
        socket.leave(roomId);
        userRooms.delete(roomId);
        callback({ status: "success" });
      } catch (error) {
        callback({ status: "error", message: error.message });
      }
    });

    // Cleanup
    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
      userRooms.clear();
    });
  });

  return io;
};