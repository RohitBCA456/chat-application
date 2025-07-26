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
      if (conn) {
        conn.lastActive = Date.now();
      }
    });

    // JOIN ROOM HANDLER
    const joinRoomHandler = async (roomId, username, callback = () => {}) => {
      try {
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) throw new Error(`Room ${roomId} doesn't exist`);

        if (socket.rooms.has(roomId)) {
          console.log(`⚠️ ${username} already in room ${roomId}`);
          callback({ status: "success", alreadyJoined: true });
          return;
        }

        // Leave all other rooms
        for (const r of socket.rooms) {
          if (r !== socket.id) {
            socket.leave(r);
            console.log(`🔄 Left old room ${r}`);
          }
        }

        await socket.join(roomId);
        console.log(`👤 ${username} joined ${roomId}`);
        console.log(`🧩 ${socket.id} rooms now:`, Array.from(socket.rooms));

        // Log all sockets in room
        const socketsInRoom = await io.in(roomId).fetchSockets();
        console.log(`📌 Room ${roomId} has ${socketsInRoom.length} socket(s):`, socketsInRoom.map(s => s.id));

        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);

        socket.emit("load-messages", messages);
        callback({ status: "success", messageCount: messages.length });

        socket.to(roomId).emit("user-joined", username);
      } catch (error) {
        console.error(`Join error for ${socket.id}:`, error.message);
        callback({ status: "error", message: error.message });

        setTimeout(() => {
          if (socket.connected) {
            joinRoomHandler(roomId, username, callback);
          }
        }, 2000);
      }
    };

    socket.on("join-room", joinRoomHandler);

    // SEND MESSAGE
    socket.on("send-message", async ({ content, roomId, username, tempId }, callback = () => {}) => {
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
        console.log(`📡 Emitting message to ${socketsInRoom.length} clients in room ${roomId}:`, socketsInRoom.map(s => s.id));

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
    });

    // INACTIVITY CHECK
    const connectionCheck = setInterval(() => {
      const conn = activeConnections.get(socket.id);
      if (conn && Date.now() - conn.lastActive > 45000) {
        console.log(`🚨 Inactive connection ${socket.id}, disconnecting`);
        socket.disconnect();
      }
    }, 30000);

    // DISCONNECT
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

    // ERROR HANDLER
    socket.on("error", (error) => {
      console.error(`⚠️ Socket error for ${socket.id}:`, error.message);
    });
  });

  // SERVER MONITOR
  setInterval(() => {
    console.log(`🌐 Active connections: ${activeConnections.size}`);
  }, 60000);

  return io;
};
