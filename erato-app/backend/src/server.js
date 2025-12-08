import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import routes
import authRoutes from './routes/auth.js';
import artistRoutes from './routes/artists.js';
import artworkRoutes from './routes/artworks.js';
import boardRoutes from './routes/boards.js';
import swipeRoutes from './routes/swipes.js';
import messageRoutes from './routes/messages.js';
import commissionRoutes from './routes/commissions.js';
import userRoutes from './routes/users.js';
import uploadRoutes from './routes/uploads.js';
import reviewRoutes from './routes/reviews.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup for real-time messaging
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:19006',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:19006',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (before rate limiting for monitoring services)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply rate limiting to all routes (except health check)
app.use(rateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/swipes', swipeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a conversation room
  socket.on('join-conversation', (matchId) => {
    socket.join(`match-${matchId}`);
    console.log(`User ${socket.id} joined match-${matchId}`);
  });

  // Send message
  socket.on('send-message', (data) => {
    io.to(`match-${data.matchId}`).emit('new-message', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(`match-${data.matchId}`).emit('user-typing', {
      userId: data.userId,
      isTyping: data.isTyping,
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
});

export { io };
export default app;
