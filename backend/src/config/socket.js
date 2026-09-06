'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, CLIENT_URL } = require('./env');

let _io = null;

/**
 * Initialise Socket.io on the given HTTP server.
 * Call once from server.js after the HTTP server is created.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── JWT auth middleware ────────────────────────────────────────────────────
  _io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication token missing'));

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload; // attach decoded payload for use in connection handler
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  _io.on('connection', (socket) => {
    const { userId, role, customerId } = socket.user;

    // Every user joins their personal room and role room
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);

    // Portal customers additionally join their customer room
    if (role === 'CUSTOMER' && customerId) {
      socket.join(`customer:${customerId}`);
    }

    console.log(`[Socket] connected: ${userId} (${role}) — rooms: user:${userId}, role:${role}${customerId ? `, customer:${customerId}` : ''}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] disconnected: ${userId}`);
    });
  });

  return _io;
}

/**
 * Emit an event to a specific room.
 * Import this helper wherever you need to push real-time updates.
 * Do NOT import the raw _io instance outside this module.
 *
 * @param {string} room    e.g. "user:abc123", "role:SALES_MANAGER", "customer:xyz"
 * @param {string} event   event name
 * @param {object} payload
 */
function emitToRoom(room, event, payload) {
  if (!_io) throw new Error('Socket.io not initialised. Call initSocket first.');
  _io.to(room).emit(event, payload);
}

/**
 * Return the raw io instance (use sparingly — prefer emitToRoom).
 */
function getIO() {
  if (!_io) throw new Error('Socket.io not initialised.');
  return _io;
}

module.exports = { initSocket, emitToRoom, getIO };
