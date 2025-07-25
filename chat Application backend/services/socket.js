import { Server } from "socket.io";
import { Message } from "../model/message.model.js";
import { Room } from "../model/room.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Track room memberships
    const userRooms = new Set();

    // Join specific room
    socket.on("join-room", async (roomId, username, callback = () => {}) => {
      try {
        // Leave all previous rooms
        userRooms.forEach(room => {
          socket.leave(room);
          userRooms.delete(room);
        });

        socket.join(roomId);
        userRooms.add(roomId);

        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);
        
        callback({ status: "success" });
        socket.emit("load-messages", messages.map(msg => ({
          _id: msg._id,
          content: msg.content,
          sender: msg.sender,
          createdAt: msg.createdAt
        })));
      } catch (error) {
        console.error("Join room error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    // Send new message
    socket.on("send-message", async ({ content, roomId, username }, callback = () => {}) => {
      try {
        if (!content || !roomId || !username) {
          throw new Error("Missing required fields");
        }

        const newMessage = new Message({ 
          content, 
          roomId, 
          sender: username 
        });
        
        await newMessage.save();
        io.to(roomId).emit("new-message", {
          _id: newMessage._id,
          content: newMessage.content,
          sender: newMessage.sender,
          createdAt: newMessage.createdAt
        });
        
        callback({ status: "success" });
      } catch (error) {
        console.error("Send message error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    // Delete room
    socket.on("delete-room", async (roomId, callback = () => {}) => {
      try {
        // Delete all messages in the room
        await Message.deleteMany({ roomId });
        
        // Delete the room itself
        await Room.deleteOne({ roomId: roomId });
        
        // Notify all clients in the room
        io.to(roomId).emit("room-deleted");
        
        callback({ status: "success" });
      } catch (error) {
        console.error("Delete room error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    // Leave room
    socket.on("leave-room", (roomId, callback = () => {}) => {
      try {
        socket.leave(roomId);
        userRooms.delete(roomId);
        callback({ status: "success" });
      } catch (error) {
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      userRooms.clear();
    });
  });

  return io;
};