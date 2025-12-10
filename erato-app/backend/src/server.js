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
import notificationRoutes from './routes/notifications.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { performanceMonitor } from './middleware/performance.js';
import './utils/cache.js'; // Initialize Redis connection

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.io setup for real-time messaging
// Support both domain and localhost for development
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:19006', 'https://api.verrocio.com'];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Use Redis adapter for Socket.io (enables scaling across multiple servers)
// This allows Socket.io to work in a distributed environment
try {
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const redisPubClient = redis.duplicate();
  const redisSubClient = redis.duplicate();
  
  await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
  
  io.adapter(createAdapter(redisPubClient, redisSubClient));
  console.log('✅ Socket.io Redis adapter enabled (scalable)');
} catch (error) {
  console.warn('⚠️  Socket.io Redis adapter not available, using default adapter:', error.message);
  // Socket.io will work without Redis adapter, just won't be scalable across multiple servers
}

// Middleware
app.use(helmet());
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses > 1KB
}));
// CORS configuration - support both domain and localhost
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    const allowedOrigins = process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : ['http://localhost:19006', 'https://api.verrocio.com'];
    
    if (allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(performanceMonitor); // Add performance monitoring before routes
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (before rate limiting for monitoring services)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Development-only: Reset rate limits endpoint (must be BEFORE rate limiter)
if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_RATE_LIMIT_RESET === 'true') {
  app.post('/dev/reset-rate-limit', (req, res) => {
    // Note: This endpoint won't actually clear the rate limit store
    // The easiest way is to wait for the window to expire (now 1 minute in dev)
    // or restart the server. The new limits will apply after the current window expires.
    res.json({ 
      message: 'Rate limit info',
      currentWindow: '1 minute (development mode)',
      maxRequests: '1000 per minute (development mode)',
      note: 'If you\'re still rate limited, wait 1 minute for the window to reset, or restart the server.',
      timestamp: new Date().toISOString(),
    });
  });
}

// Apply rate limiting to all routes (except health check and dev endpoints)
app.use(rateLimiter);

// Make io available to routes via app.locals
app.locals.io = io;

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
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Socket.io connection handling with authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const jwt = (await import('jsonwebtoken')).default;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'userId:', socket.userId);

  // Join a conversation room
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`User ${socket.userId} (${socket.id}) joined conversation-${conversationId}`);
  });

  // Join user's notification room
  socket.on('join-notifications', async (user) => {
    userId = user.id;
    socket.join(`notifications-${userId}`);
    
    // Subscribe to Redis pub/sub for real-time notifications
    try {
      const { FeedService } = await import('./utils/redisServices.js');
      const subscriber = FeedService.subscribeToFeed(userId, (update) => {
        socket.emit('notification', update);
      });
      
      socket.on('disconnect', () => {
        subscriber.disconnect();
      });
    } catch (error) {
      console.error('Error setting up notification subscription:', error);
    }
  });

  // Send message
  socket.on('send-message', (data) => {
    io.to(`conversation-${data.conversationId}`).emit('new-message', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(`conversation-${data.conversationId}`).emit('user-typing', {
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
