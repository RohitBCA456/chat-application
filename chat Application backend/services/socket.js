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
    socket.on("join-room", async (roomId) => {
      try {
        socket.join(roomId); // ✅ Join the socket.io room
        socket.emit("joined-room"); // (Optional) Acknowledge join if needed on client

        // 🔄 Fetch previous messages for this room
        const messages = await Message.find({ roomId }).sort({ timestamp: 1 });

        // 💬 Send chat history ONLY to the user who just joined
        socket.emit("load-messages", messages);
      } catch (error) {
        console.error("❌ Error loading messages:", error);
      }
    });

    // 🔹 SEND MESSAGE
    socket.on("send-message", async ({ username, roomId, message }) => {
      try {
        // 💾 Save the new message to DB
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

        // 📣 Emit to EVERYONE in the room — including the creator/sender
        io.to(roomId).emit("receive-message", messagePayload);
      } catch (error) {
        console.error("❌ Error sending message:", error);
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

    // 🔌 Handle user disconnect
    socket.on("disconnect", () => {
      console.log("👋 User disconnected:", socket.id);
    });
  });

  return io;
};
