const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/meetings', require('./routes/api/meetings'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ── Track rooms and users ──
const rooms = {}; // { roomId: { socketId: { name } } }

// Socket.io for WebRTC signaling and Chat
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', (roomId, userId, name) => {
    socket.join(roomId);
    console.log(`User ${socket.id} (${name}) joined room ${roomId}`);

    // Track user in room
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId][socket.id] = { name };

    // Tell the NEW user about ALL existing users in the room
    const existingUsers = Object.entries(rooms[roomId])
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ id, name: data.name }));
    
    socket.emit('existing-users', existingUsers);

    // Notify EXISTING users about the new user
    socket.to(roomId).emit('user-connected', socket.id, name);

    // Store roomId on socket for cleanup
    socket.roomId = roomId;
    socket.userName = name;
  });

  // Chat Message
  socket.on('send-message', (message, senderName) => {
    if (socket.roomId) {
      io.to(socket.roomId).emit('receive-message', {
        message,
        senderName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  });

  // Handle WebRTC Signaling — these are NOT nested inside join-room anymore
  socket.on('offer', (offer, to) => {
    console.log(`Offer from ${socket.id} to ${to}`);
    socket.to(to).emit('offer', offer, socket.id, socket.userName || 'Participant');
  });

  socket.on('answer', (answer, to) => {
    console.log(`Answer from ${socket.id} to ${to}`);
    socket.to(to).emit('answer', answer, socket.id);
  });

  socket.on('ice-candidate', (candidate, to) => {
    socket.to(to).emit('ice-candidate', candidate, socket.id);
  });

  // Explicit leave
  socket.on('leave-room', () => {
    if (socket.roomId) {
      console.log(`User explicitly left: ${socket.id} from room ${socket.roomId}`);
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
      
      // Cleanup room tracking
      if (rooms[socket.roomId]) {
        delete rooms[socket.roomId][socket.id];
        if (Object.keys(rooms[socket.roomId]).length === 0) {
          delete rooms[socket.roomId];
        }
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
      
      // Cleanup room tracking
      if (rooms[socket.roomId]) {
        delete rooms[socket.roomId][socket.id];
        if (Object.keys(rooms[socket.roomId]).length === 0) {
          delete rooms[socket.roomId];
        }
      }
    }
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
