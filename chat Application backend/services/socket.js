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
    pingTimeout: 30000, // Increased from default 5000
    pingInterval: 15000, // Increased from default 25000
    transports: ["websocket", "polling"],
  });

  // Track active connections
  const activeConnections = new Map();

  io.on("connection", (socket) => {
    console.log(`✅ New connection: ${socket.id}`);
    activeConnections.set(socket.id, {
      connectedAt: Date.now(),
      lastActive: Date.now(),
    });

    // Heartbeat mechanism
    socket.on("heartbeat", () => {
      const conn = activeConnections.get(socket.id);
      if (conn) {
        conn.lastActive = Date.now();
        activeConnections.set(socket.id, conn);
      }
    });

    // Join room with retry logic
    const joinRoomHandler = async (roomId, username, callback = () => {}) => {
      try {
        // Validate room exists
        const roomExists = await Room.exists({ roomId });
        if (!roomExists) {
          throw new Error(`Room ${roomId} doesn't exist`);
        }

        // Leave previous rooms (including any default rooms)
        const previousRooms = Array.from(socket.rooms);
        previousRooms.forEach((room) => {
          if (room !== socket.id) {
            // Don't leave the socket's default room
            socket.leave(room);
            console.log(`Left room ${room}`);
          }
        });

        // Join new room with acknowledgment
        await socket.join(roomId);
        console.log(`👤 ${username} joined ${roomId}`);

        // Load messages
        const messages = await Message.find({ roomId })
          .sort({ createdAt: 1 })
          .limit(100);

        // Confirm room join success
        callback({
          status: "success",
          messageCount: messages.length,
        });

        // Send messages to only this client
        socket.emit("load-messages", messages);

        // Notify others in the room about new user (optional)
        socket.to(roomId).emit("user-joined", username);
      } catch (error) {
        console.error(`Join error for ${socket.id}:`, error.message);
        callback({
          status: "error",
          message: error.message,
          retry: true,
        });

        // Auto-retry after delay
        setTimeout(() => {
          if (socket.connected) {
            joinRoomHandler(roomId, username, callback);
          }
        }, 2000);
      }
    };
    socket.on("join-room", joinRoomHandler);

    // Message handling with delivery tracking
    socket.on(
      "send-message",
      async ({ content, roomId, username, tempId }, callback = () => {}) => {
        try {
          if (!content?.trim() || !roomId || !username) {
            throw new Error("Invalid message data");
          }

          // Create and save message
          const newMessage = new Message({
            content: content.trim(),
            roomId,
            sender: username,
          });
          await newMessage.save();

          // Debug: Who is in the room
          const socketsInRoom = await io.in(roomId).fetchSockets();
          console.log(
            `📡 Emitting message to ${socketsInRoom.length} clients in room ${roomId}:`,
            socketsInRoom.map((s) => s.id)
          );

          // Broadcast to room including sender
          io.to(roomId).emit("new-message", {
            ...newMessage.toObject(),
            tempId, // Helps client reconcile
          });

          callback({
            status: "delivered",
            messageId: newMessage._id,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error(`Send error for ${socket.id}:`, error.message);
          callback({
            status: "failed",
            message: error.message,
            tempId,
          });
        }
      }
    );

    // Connection health monitoring
    const connectionCheck = setInterval(() => {
      const conn = activeConnections.get(socket.id);
      if (conn && Date.now() - conn.lastActive > 45000) {
        // 45s inactivity
        console.log(`🚨 Inactive connection ${socket.id}, disconnecting`);
        socket.disconnect();
      }
    }, 30000);

    // Cleanup on disconnect
    socket.on("disconnect", (reason) => {
      clearInterval(connectionCheck);
      activeConnections.delete(socket.id);
      console.log(`❌ Disconnected: ${socket.id} (Reason: ${reason})`);

      // Log connection duration
      const conn = activeConnections.get(socket.id);
      if (conn) {
        const duration = (Date.now() - conn.connectedAt) / 1000;
        console.log(`Connection ${socket.id} lasted ${duration.toFixed(1)}s`);
      }
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error.message);
    });
  });

  // Server-wide connection monitoring
  setInterval(() => {
    console.log(`🌐 Active connections: ${activeConnections.size}`);
  }, 60000);

  return io;
};
