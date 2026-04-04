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
app.use('/api/webinars', require('./routes/api/webinars'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ── Track rooms and users ──
const rooms = {}; // { roomId: { participants: { socketId: { name } }, startTime: Date.now(), adminId: socketId } }

// Socket.io for WebRTC signaling and Chat
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', (roomId, userId, name) => {
    socket.join(roomId);
    console.log(`User ${socket.id} (${name}) joined room ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = { participants: {}, startTime: Date.now(), adminId: socket.id };
    }

    rooms[roomId].participants[socket.id] = { name };

    // Tell the NEW user about ALL existing users in the room
    const existingUsers = Object.entries(rooms[roomId].participants)
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ id, name: data.name }));
    
    // Also broadcast the current admin and the room start time
    socket.emit('room-info', {
      users: existingUsers,
      startTime: rooms[roomId].startTime,
      adminId: rooms[roomId].adminId
    });

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

  // Admin logic: Kick
  socket.on('kick-participant', (targetId) => {
    if (socket.roomId && rooms[socket.roomId] && rooms[socket.roomId].adminId === socket.id) {
      console.log(`Admin ${socket.id} kicked ${targetId}`);
      io.to(targetId).emit('kicked-from-room');
    }
  });

  // Admin logic: Transfer internally
  socket.on('transfer-admin', (targetId) => {
    if (socket.roomId && rooms[socket.roomId] && rooms[socket.roomId].adminId === socket.id) {
      if (rooms[socket.roomId].participants[targetId]) {
        rooms[socket.roomId].adminId = targetId;
        io.to(socket.roomId).emit('admin-changed', targetId);
        console.log(`Admin transferred manually to ${targetId}`);
      }
    }
  });

  const handleDisconnect = () => {
    if (socket.roomId) {
      console.log(`User left/disconnected: ${socket.id} from room ${socket.roomId}`);
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
      
      const room = rooms[socket.roomId];
      if (room) {
        delete room.participants[socket.id];
        
        const remainingUsers = Object.keys(room.participants);
        if (remainingUsers.length === 0) {
          console.log(`Room ${socket.roomId} is empty, destroying metadata.`);
          delete rooms[socket.roomId];
        } else {
          // If the admin leaves, randomly pick a new admin
          if (room.adminId === socket.id) {
            const newAdmin = remainingUsers[Math.floor(Math.random() * remainingUsers.length)];
            room.adminId = newAdmin;
            console.log(`Admin dropped. Selected random new admin: ${newAdmin}`);
            io.to(socket.roomId).emit('admin-changed', newAdmin);
          }
        }
      }
      socket.leave(socket.roomId);
      socket.roomId = null;
    }
  };

  // Explicit leave
  socket.on('leave-room', handleDisconnect);

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleDisconnect();
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
