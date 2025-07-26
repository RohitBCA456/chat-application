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
    },
    pingTimeout: 30000,
    pingInterval: 15000,
    transports: ["websocket", "polling"],
  });

  const activeConnections = new Map();

  io.on("connection", (socket) => {
    console.log(`✅ New connection: ${socket.id}`);
    activeConnections.set(socket.id, {
      connectedAt: Date.now(),
      lastActive: Date.now(),
    });

    // Heartbeat ping
    socket.on("heartbeat", () => {
      const conn = activeConnections.get(socket.id);
      if (conn) conn.lastActive = Date.now();
    });

    // Delete room
    // In socket.js
    socket.on("delete-room", async (roomId, callback = () => {}) => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verify room exists and user is creator
        const room = await Room.findOne({ roomId }).session(session);
        if (!room) {
          throw new Error("Room not found");
        }

        // Get authenticated user data
        const { username, userId } = socket.handshake.auth;

        // Verify user is the room creator
        if (room.creator.toString() !== userId) {
          throw new Error("Only room creator can delete the room");
        }

        // Delete all messages in the room
        await Message.deleteMany({ roomId }).session(session);

        // Delete the room itself
        await Room.deleteOne({ _id: room._id }).session(session);

        // Notify all clients in the room
        io.to(roomId).emit("room-deleted");

        // Force all clients to leave the room
        const socketsInRoom = await io.in(roomId).fetchSockets();
        for (const s of socketsInRoom) {
          s.leave(roomId);
          s.emit("room-deleted");
        }

        await session.commitTransaction();
        callback({ status: "success" });
      } catch (error) {
        await session.abortTransaction();
        console.error(`Delete room error: ${error.message}`);
        callback({
          status: "error",
          message: error.message,
          roomId: roomId,
        });
      } finally {
        session.endSession();
      }
    });

    // Join Room
    const joinRoomHandler = async (roomId, username, callback = () => {}) => {
      try {
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) throw new Error(`Room ${roomId} doesn't exist`);

        // 🧹 Remove all sockets of same username (optional if tracking)
        const socketsInRoom = await io.in(roomId).fetchSockets();
        for (const s of socketsInRoom) {
          if (s.id !== socket.id) {
            s.leave(roomId);
            console.log(`🧼 Removed socket ${s.id} from ${roomId}`);
          }
        }

        // 🚪 Leave previous rooms
        for (const r of socket.rooms) {
          if (r !== socket.id) {
            socket.leave(r);
            console.log(`🚪 Left previous room: ${r}`);
          }
        }

        // ✅ Join new room
        await socket.join(roomId);
        console.log(`👤 ${username} joined ${roomId}`);
        console.log(`🧩 ${socket.id} rooms now:`, Array.from(socket.rooms));

        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);

        const updatedSockets = await io.in(roomId).fetchSockets();
        console.log(
          `📌 Room ${roomId} has ${updatedSockets.length} socket(s):`,
          updatedSockets.map((s) => s.id)
        );

        socket.emit("load-messages", messages);
        callback({ status: "success", messageCount: messages.length });

        socket.to(roomId).emit("user-joined", username);
      } catch (error) {
        console.error(`Join error for ${socket.id}:`, error.message);
        callback({ status: "error", message: error.message });

        // Retry after short delay
        setTimeout(() => {
          if (socket.connected) joinRoomHandler(roomId, username, callback);
        }, 2000);
      }
    };

    socket.on("join-room", joinRoomHandler);

    // Send message
    socket.on(
      "send-message",
      async ({ content, roomId, username, tempId }, callback = () => {}) => {
        try {
          if (!content?.trim() || !roomId || !username) {
            throw new Error("Invalid message data");
          }

          const newMessage = new Message({
            content: content.trim(),
            roomId,
            sender: username,
          });
          await newMessage.save();

          const socketsInRoom = await io.in(roomId).fetchSockets();
          console.log(
            `📡 Emitting message to ${socketsInRoom.length} clients in ${roomId}:`,
            socketsInRoom.map((s) => s.id)
          );

          io.to(roomId).emit("new-message", {
            ...newMessage.toObject(),
            tempId,
          });

          callback({
            status: "delivered",
            messageId: newMessage._id,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error(`Send error for ${socket.id}:`, error.message);
          callback({ status: "failed", message: error.message, tempId });
        }
      }
    );

    // Inactivity timeout
    const connectionCheck = setInterval(() => {
      const conn = activeConnections.get(socket.id);
      if (conn && Date.now() - conn.lastActive > 45000) {
        console.log(`🚨 Inactive connection ${socket.id}, disconnecting`);
        socket.disconnect();
      }
    }, 30000);

    socket.on("leave-room", async (roomId, callback = () => {}) => {
      try {
        // Ensure socket is in the room
        const inRoom = socket.rooms.has(roomId);
        if (inRoom) {
          await socket.leave(roomId);
          console.log(`🚪 ${socket.id} left room ${roomId}`);
        }

        callback({ status: "success" });
        socket.emit("leave-room-success");
      } catch (err) {
        console.error(`❌ Leave room error: ${err.message}`);
        callback({ status: "error", message: err.message });
      }
    });

    socket.on("disconnect", (reason) => {
      clearInterval(connectionCheck);
      const conn = activeConnections.get(socket.id);
      activeConnections.delete(socket.id);
      console.log(`❌ Disconnected: ${socket.id} (Reason: ${reason})`);
      if (conn) {
        const duration = ((Date.now() - conn.connectedAt) / 1000).toFixed(1);
        console.log(`⏳ Connection lasted ${duration}s`);
      }
    });

    socket.on("error", (error) => {
      console.error(`⚠️ Socket error for ${socket.id}:`, error.message);
    });
  });

  // Server-wide connection count
  setInterval(() => {
    console.log(`🌐 Active connections: ${activeConnections.size}`);
  }, 60000);

  return io;
};
