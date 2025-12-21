import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

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

async function clearRedisCache() {
  try {
    console.log('🔍 Connecting to Redis...');

    // Wait for connection
    await new Promise((resolve, reject) => {
      redis.on('connect', () => {
        console.log('✅ Connected to Redis');
        resolve();
      });

      redis.on('error', (err) => {
        console.error('❌ Redis connection failed:', err.message);
        reject(err);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);
    });

    console.log('🗑️  Clearing all Redis cache...');

    // Clear all keys
    const result = await redis.flushall();
    console.log('✅ Redis FLUSHALL result:', result);

    // Get info about cleared data
    const info = await redis.info('memory');
    console.log('📊 Redis memory info after clearing:');
    console.log(info);

    console.log('🎉 Redis cache cleared successfully!');

  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error.message);
  } finally {
    // Close the connection
    redis.quit().catch(() => {});
  }
}

// Run the cleanup
clearRedisCache();
