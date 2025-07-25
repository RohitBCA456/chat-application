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
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ New socket connected:", socket.id);
    const userRooms = new Set();

    // Join room handler with improved error handling
    socket.on("join-room", async (roomId, username, callback = () => {}) => {
      try {
        // Validate input
        if (!roomId || !username) {
          throw new Error("Missing room ID or username");
        }

        // Check if room exists
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) {
          throw new Error("Room does not exist");
        }

        // Leave previous rooms
        userRooms.forEach(room => {
          socket.leave(room);
          userRooms.delete(room);
          console.log(`Left room ${room}`);
        });

        // Join new room
        await socket.join(roomId);
        userRooms.add(roomId);
        console.log(`${username} joined room ${roomId}`);

        // Load messages
        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);
        
        // Success response
        callback({ 
          status: "success",
          roomId,
          messageCount: messages.length
        });

        // Send messages to only this client
        socket.emit("load-messages", messages.map(msg => ({
          _id: msg._id,
          content: msg.content,
          sender: msg.sender,
          createdAt: msg.createdAt
        })));

      } catch (error) {
        console.error("Join room error:", error.message);
        callback({ 
          status: "error", 
          message: error.message,
          roomId
        });
      }
    });

    // Send message handler with room verification
    socket.on("send-message", async ({ content, roomId, username }, callback = () => {}) => {
      try {
        console.log(`📩 Message received for room ${roomId} from ${username}`);
        
        // Validate input
        if (!content?.trim() || !roomId || !username) {
          throw new Error("Invalid message data");
        }

        // Verify sender is in the room
        if (!userRooms.has(roomId)) {
          throw new Error("You're not in this room");
        }

        // Create and save message
        const newMessage = new Message({ 
          content: content.trim(), 
          roomId, 
          sender: username 
        });
        
        await newMessage.save();
        console.log(`💾 Message saved with ID: ${newMessage._id}`);

        // Broadcast to all in room including sender
        io.to(roomId).emit("new-message", {
          _id: newMessage._id,
          content: newMessage.content,
          sender: newMessage.sender,
          createdAt: newMessage.createdAt
        });
        
        console.log(`📤 Message broadcasted to room ${roomId}`);
        callback({ status: "success", messageId: newMessage._id });

      } catch (error) {
        console.error("Send message error:", error.message);
        callback({ 
          status: "error", 
          message: error.message,
          roomId
        });
      }
    });

    // Room management handlers
    socket.on("delete-room", async (roomId, callback = () => {}) => {
      try {
        console.log(`🗑️ Delete room request for ${roomId}`);
        await Message.deleteMany({ roomId });
        await Room.deleteOne({ roomId });
        io.to(roomId).emit("room-deleted");
        callback({ status: "success" });
      } catch (error) {
        console.error("Delete room error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("leave-room", (roomId, callback = () => {}) => {
      try {
        socket.leave(roomId);
        userRooms.delete(roomId);
        console.log(`👋 ${socket.id} left room ${roomId}`);
        callback({ status: "success" });
      } catch (error) {
        callback({ status: "error", message: error.message });
      }
    });

    // Connection monitoring
    socket.on("disconnect", (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} (${reason})`);
      userRooms.clear();
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
};