import { Server } from "socket.io";
import { Message } from "../model/message.model.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL, // your frontend URL
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // 🔹 JOIN ROOM
    socket.on("join-room", async (roomId, callback) => {
      try {
        socket.join(roomId);
        console.log(`✅ Socket ${socket.id} joined room ${roomId}`);

        // Acknowledge join success back to client
        if (callback) callback({ success: true });

        const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
        socket.emit("load-messages", messages);
      } catch (err) {
        console.error("Join room error:", err);
        if (callback) callback({ success: false });
      }
    });

    // 🔹 SEND MESSAGE
    socket.on("send-message", async ({ username, roomId, message }) => {
      try {
        const newMessage = new Message({
          roomId,
          sender: username,
          content: message,
        });

        await newMessage.save();

        const payload = {
          username,
          message,
          timestamp: newMessage.timestamp,
          _id: newMessage._id,
        };

        // ✅ Broadcast to everyone including creator
        io.to(roomId).emit("receive-message", messagePayload);
      } catch (err) {
        console.error("Send message error:", err);
      }
    });

    // ✏️ EDIT MESSAGE
    socket.on("edit-message", async ({ id, newText, roomId }) => {
      try {
        const message = await Message.findById(id);
        if (message) {
          message.content = newText;
          await message.save({ validateBeforeSave: false });

          // 📣 Broadcast to everyone in the room
          io.to(roomId).emit("message-edited", {
            id,
            newText,
          });
        }
      } catch (error) {
        console.error("❌ Error editing message:", error);
      }
    });

    // 🗑️ DELETE MESSAGE
    socket.on("delete-message", async ({ id, roomId }) => {
      try {
        const deleted = await Message.findByIdAndDelete(id);
        if (deleted) {
          // 📣 Inform everyone in the room
          io.to(roomId).emit("message-deleted", { id });
        }
      } catch (error) {
        console.error("❌ Error deleting message:", error);
      }
    });

    setInterval(() => {
      const roomIds = Array.from(io.sockets.adapter.rooms.keys());
      console.log("📂 Active rooms:", roomIds);
    }, 10000);

    // 🔌 Handle user disconnect
    socket.on("disconnect", () => {
      console.log("👋 User disconnected:", socket.id);
    });
  });

  return io;
};
