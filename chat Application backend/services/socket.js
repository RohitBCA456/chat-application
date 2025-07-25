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

  // Track users in rooms
  const roomMembers = new Map();

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);
    let currentUsername = null;
    let currentRoomId = null;

    const verifyRoomMembership = (roomId, username) => {
      if (!roomMembers.has(roomId) || !roomMembers.get(roomId).has(username)) {
        throw new Error("You must join the room first");
      }
    };

    const safeCallback = (cb, payload) => {
      if (typeof cb === "function") cb(payload);
    };

    socket.on("join-room", async (roomId, username, callback) => {
      try {
        currentUsername = username;
        currentRoomId = roomId;

        if (!roomMembers.has(roomId)) {
          roomMembers.set(roomId, new Set());
        }

        roomMembers.get(roomId).add(username);
        await socket.join(roomId);

        const messages = await Message.find({ roomId })
          .sort({ timestamp: 1 })
          .limit(100);

        socket.emit("load-messages", messages);
        safeCallback(callback, { status: "success" });
      } catch (error) {
        console.error("Join room error:", error);
        safeCallback(callback, { status: "error", message: error.message });
        socket.emit("room-error", error.message);
      }
    });

    socket.on("send-message", async (data, callback) => {
      try {
        const { roomId, username, message, tempId } = data;
        verifyRoomMembership(roomId, username);

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
          tempId,
        });

        safeCallback(callback, { status: "success" });
      } catch (error) {
        console.error("Send message error:", error);
        safeCallback(callback, { status: "error", message: error.message });
      }
    });

    socket.on("edit-message", async ({ id, newText, roomId, username }, callback) => {
      try {
        verifyRoomMembership(roomId, username);

        const message = await Message.findById(id);
        if (!message) throw new Error("Message not found");
        if (message.sender !== username)
          throw new Error("You can only edit your own messages");

        message.content = newText;
        await message.save();

        io.to(roomId).emit("message-edited", { id, newText });
        safeCallback(callback, { status: "success" });
      } catch (error) {
        console.error("Edit message error:", error);
        safeCallback(callback, { status: "error", message: error.message });
      }
    });

    socket.on("delete-message", async ({ id, roomId, username }, callback) => {
      try {
        verifyRoomMembership(roomId, username);

        const message = await Message.findById(id);
        if (!message) throw new Error("Message not found");
        if (message.sender !== username)
          throw new Error("You can only delete your own messages");

        await Message.findByIdAndDelete(id);
        io.to(roomId).emit("message-deleted", { id });
        safeCallback(callback, { status: "success" });
      } catch (error) {
        console.error("Delete message error:", error);
        safeCallback(callback, { status: "error", message: error.message });
      }
    });

    socket.on("disconnect", () => {
      if (currentRoomId && currentUsername) {
        const members = roomMembers.get(currentRoomId);
        if (members) {
          members.delete(currentUsername);
          if (members.size === 0) {
            roomMembers.delete(currentRoomId);
          }
        }
      }
      console.log("❌ User disconnected:", socket.id);
    });
  });

  return io;
};
