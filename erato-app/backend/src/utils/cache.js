import Redis from 'ioredis';

// Create Redis client - supports both URL format (Render) and host/port format (local)
const redisConfig = process.env.REDIS_URL
  ? {
      // Render and other cloud providers use REDIS_URL format: redis://host:port
      url: process.env.REDIS_URL,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    }
  : {
      // Local development uses REDIS_HOST and REDIS_PORT
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

const redis = new Redis(redisConfig);

// Connect to Redis
redis.connect().catch((err) => {
  console.warn('⚠️  Redis connection failed, caching disabled:', err.message);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

redis.on('close', () => {
  console.warn('⚠️  Redis connection closed');
});

// Cache utility functions
export const cache = {
  // Get cached data
  get: async (key) => {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  // Set cached data with optional expiration (in seconds)
  set: async (key, value, expiration = 3600) => {
    try {
      await redis.setex(key, expiration, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  },

  // Delete cached data
  del: async (key) => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  },

  // Delete multiple keys matching a pattern
  delPattern: async (pattern) => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },
};

// Export redis client for use in other services (after cache is defined)
cache._client = redis;

// Cache key generators
export const cacheKeys = {
  // User cache keys
  user: (userId) => `user:${userId}`,
  userBoards: (userId) => `user:${userId}:boards`,
  userProfile: (userId) => `user:${userId}:profile`,
  
  // Messages cache keys
  conversations: (userId) => `conversations:${userId}`,

  // Artist cache keys
  artist: (artistId) => `artist:${artistId}`,
  artistArtworks: (artistId) => `artist:${artistId}:artworks`,
  artistBoards: (artistId) => `artist:${artistId}:boards`,

  // Artwork cache keys
  artwork: (artworkId) => `artwork:${artworkId}`,
  artworksList: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return `artworks:list:${queryString}`;
  },

  // Board cache keys
  board: (boardId) => `board:${boardId}`,
  boardArtworks: (boardId) => `board:${boardId}:artworks`,

  // Feed cache keys
  feed: (userId, type = 'explore') => `feed:${type}:${userId || 'anonymous'}`,

  // Commission cache keys
  commissions: (userId, type = 'all') => `commissions:${type}:${userId}`,
  commission: (commissionId) => `commission:${commissionId}`,
};

// Middleware to cache route responses
export const cacheMiddleware = (duration = 3600, keyGenerator = null) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `route:${req.originalUrl}`;

    try {
      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (data) {
        // Cache the response
        cache.set(cacheKey, data, duration).catch((err) => {
          console.error('Cache set error in middleware:', err);
        });
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

export default redis;

