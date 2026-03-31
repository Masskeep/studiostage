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
    origin: '*', // For development, allow all origins
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/meetings', require('./routes/api/meetings'));

// Socket.io for WebRTC signaling and Chat
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', (roomId, userId, name) => {
    socket.join(roomId);
    console.log(`User ${userId} (${name}) joined room ${roomId}`);
    // Notify other users in the room
    socket.to(roomId).emit('user-connected', userId, name);

    // Chat Message
    socket.on('send-message', (message, senderName) => {
      io.to(roomId).emit('receive-message', {
        message,
        senderName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    });

    // Handle WebRTC Signaling
    socket.on('offer', (offer, to) => {
      socket.to(to).emit('offer', offer, socket.id, name);
    });

    socket.on('answer', (answer, to) => {
      socket.to(to).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, to) => {
      socket.to(to).emit('ice-candidate', candidate, socket.id);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId}`);
      socket.to(roomId).emit('user-disconnected', userId);
    });
    
    // Explicit leave
    socket.on('leave-room', () => {
      console.log(`User explicitly left: ${userId}`);
      socket.to(roomId).emit('user-disconnected', userId);
      socket.leave(roomId);
    });
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
