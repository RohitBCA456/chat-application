import { Server } from "socket.io";
import { Message } from "../model/message.model.js";
import { Room } from "../model/room.model.js"; // Make sure to import your Room model

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
    socket.on("join-room", async (roomId, username, callback) => {
      try {
        socket.join(roomId);
        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);
        
        callback({ status: "success" });
        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("Join room error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    // Send new message
    socket.on("send-message", async ({ text, roomId, username }, callback) => {
      try {
        const newMessage = new Message({ 
          text, 
          roomId, 
          sender: username 
        });
        
        await newMessage.save();
        io.to(roomId).emit("new-message", {
          _id: newMessage._id,
          text: newMessage.text,
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
    socket.on("delete-room", async (roomId, callback) => {
      try {
        // Delete all messages in the room
        await Message.deleteMany({ roomId });
        
        // Delete the room itself
        await Room.deleteOne({ _id: roomId });
        
        // Notify all clients in the room
        io.to(roomId).emit("room-deleted");
        
        callback({ status: "success" });
      } catch (error) {
        console.error("Delete room error:", error);
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};