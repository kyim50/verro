import Redis from 'ioredis';
import { cache } from './cache.js';

// Get Redis client from cache.js or create new one
let redis;
try {
  // Try to get the client from cache module
  if (cache && cache._client) {
    redis = cache._client;
  } else {
    // Create new client if not available
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.connect().catch(() => {});
  }
} catch (error) {
  // Fallback: create new client
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  redis.connect().catch(() => {});
}

// ============================================================================
// 1. RATE LIMITING STORE (Better than in-memory)
// ============================================================================
export class RedisRateLimitStore {
  async increment(key) {
    const count = await redis.incr(key);
    if (count === 1) {
      // Set expiration when key is first created
      await redis.expire(key, 60); // 1 minute window
    }
    return { totalHits: count };
  }

  async decrement(key) {
    await redis.decr(key);
  }

  async resetKey(key) {
    await redis.del(key);
  }
}

// ============================================================================
// 2. NOTIFICATIONS SYSTEM (Pub/Sub)
// ============================================================================
export class NotificationService {
  // Publish notification
  static async publish(userId, notification) {
    try {
      const key = `notifications:${userId}`;
      const timestamp = Date.now();
      
      const notificationData = {
        ...notification,
        id: `${userId}-${timestamp}`,
        timestamp,
        read: false,
      };

      // Store notification in sorted set (sorted by timestamp)
      await redis.zadd(key, timestamp, JSON.stringify(notificationData));
      
      // Keep only last 100 notifications per user
      await redis.zremrangebyrank(key, 0, -101);
      
      // Set expiration (30 days)
      await redis.expire(key, 30 * 24 * 60 * 60);

      // Publish to real-time channel for Socket.io
      await redis.publish(`notifications:${userId}`, JSON.stringify(notificationData));

      // Update unread count
      await this.incrementUnreadCount(userId);

      return notificationData;
    } catch (error) {
      console.error('Error publishing notification:', error);
      return null;
    }
  }

  // Get notifications for user
  static async getNotifications(userId, limit = 20, offset = 0) {
    try {
      const key = `notifications:${userId}`;
      const notifications = await redis.zrevrange(key, offset, offset + limit - 1);
      return notifications.map(n => JSON.parse(n));
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(userId, notificationId) {
    try {
      const key = `notifications:${userId}`;
      const notifications = await redis.zrevrange(key, 0, -1);
      
      for (const notif of notifications) {
        const data = JSON.parse(notif);
        if (data.id === notificationId) {
          data.read = true;
          await redis.zrem(key, notif);
          await redis.zadd(key, data.timestamp, JSON.stringify(data));
          break;
        }
      }
      
      await this.decrementUnreadCount(userId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all as read
  static async markAllAsRead(userId) {
    try {
      const key = `notifications:${userId}`;
      const notifications = await redis.zrevrange(key, 0, -1);
      
      for (const notif of notifications) {
        const data = JSON.parse(notif);
        data.read = true;
        await redis.zrem(key, notif);
        await redis.zadd(key, data.timestamp, JSON.stringify(data));
      }
      
      await redis.set(`unread:${userId}`, 0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Unread count
  static async getUnreadCount(userId) {
    try {
      const count = await redis.get(`unread:${userId}`);
      return parseInt(count || '0', 10);
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  static async incrementUnreadCount(userId) {
    try {
      await redis.incr(`unread:${userId}`);
      await redis.expire(`unread:${userId}`, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Error incrementing unread count:', error);
    }
  }

  static async decrementUnreadCount(userId) {
    try {
      const count = await redis.decr(`unread:${userId}`);
      if (count <= 0) {
        await redis.del(`unread:${userId}`);
      }
    } catch (error) {
      console.error('Error decrementing unread count:', error);
    }
  }

  static async resetUnreadCount(userId) {
    try {
      await redis.del(`unread:${userId}`);
    } catch (error) {
      console.error('Error resetting unread count:', error);
    }
  }
}

// ============================================================================
// 3. UNREAD MESSAGE COUNTS (Instant access)
// ============================================================================
export class MessageCountService {
  static async updateUnreadCount(userId, conversationId, increment = 1) {
    try {
      const key = `unread:messages:${userId}`;
      if (increment > 0) {
        await redis.hincrby(key, conversationId, increment);
      } else {
        await redis.hset(key, conversationId, 0);
      }
      await redis.expire(key, 30 * 24 * 60 * 60); // 30 days
    } catch (error) {
      console.error('Error updating unread message count:', error);
    }
  }

  static async getUnreadCount(userId, conversationId = null) {
    try {
      const key = `unread:messages:${userId}`;
      if (conversationId) {
        const count = await redis.hget(key, conversationId);
        return parseInt(count || '0', 10);
      } else {
        // Get total unread count across all conversations
        const counts = await redis.hgetall(key);
        return Object.values(counts).reduce((sum, count) => sum + parseInt(count || '0', 10), 0);
      }
    } catch (error) {
      // Silently return 0 if Redis is unavailable - will fallback to database
      return 0;
    }
  }
  
  // Batch get unread counts for multiple conversations at once (faster)
  static async getBatchUnreadCounts(userId, conversationIds) {
    try {
      const key = `unread:messages:${userId}`;
      if (conversationIds.length === 0) return new Map();
      
      // Use HMGET to get multiple values in one call
      const counts = await redis.hmget(key, ...conversationIds);
      const resultMap = new Map();
      
      conversationIds.forEach((convId, index) => {
        resultMap.set(convId, parseInt(counts[index] || '0', 10));
      });
      
      return resultMap;
    } catch (error) {
      // Silently return empty map if Redis is unavailable
      return new Map();
    }
  }

  static async resetUnreadCount(userId, conversationId) {
    try {
      const key = `unread:messages:${userId}`;
      await redis.hset(key, conversationId, 0);
    } catch (error) {
      console.error('Error resetting unread message count:', error);
    }
  }
}

// ============================================================================
// 4. SESSION MANAGEMENT (Active sessions)
// ============================================================================
export class SessionService {
  static async createSession(userId, sessionData) {
    try {
      const sessionId = `session:${userId}:${Date.now()}`;
      const key = `session:${userId}`;
      
      // Store session data
      await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(sessionData)); // 7 days
      
      // Track active sessions
      await redis.sadd(`sessions:${userId}`, sessionId);
      
      return sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  static async getSession(userId) {
    try {
      const key = `session:${userId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  static async updateSession(userId, sessionData) {
    try {
      const key = `session:${userId}`;
      const ttl = await redis.ttl(key);
      await redis.setex(key, ttl > 0 ? ttl : 7 * 24 * 60 * 60, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }

  static async deleteSession(userId) {
    try {
      const key = `session:${userId}`;
      await redis.del(key);
      await redis.del(`sessions:${userId}`);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  static async isUserOnline(userId) {
    try {
      const key = `session:${userId}`;
      return await redis.exists(key) === 1;
    } catch (error) {
      console.error('Error checking if user is online:', error);
      return false;
    }
  }
}

// ============================================================================
// 5. BACKGROUND JOB QUEUE (For async tasks)
// ============================================================================
export class JobQueue {
  static async addJob(jobType, jobData, priority = 0) {
    try {
      const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const job = {
        id: jobId,
        type: jobType,
        data: jobData,
        priority,
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
      };

      // Add to queue sorted by priority (higher priority first)
      await redis.zadd(`queue:${jobType}`, priority, JSON.stringify(job));
      return jobId;
    } catch (error) {
      console.error('Error adding job to queue:', error);
      return null;
    }
  }

  static async getNextJob(jobType) {
    try {
      const jobs = await redis.zrevrange(`queue:${jobType}`, 0, 0); // Get highest priority
      if (jobs.length === 0) return null;
      
      const job = JSON.parse(jobs[0]);
      await redis.zrem(`queue:${jobType}`, jobs[0]); // Remove from queue
      
      return job;
    } catch (error) {
      console.error('Error getting next job:', error);
      return null;
    }
  }

  static async processJobs(jobType, processor, concurrency = 1) {
    let processing = 0;

    const processNext = async () => {
      if (processing >= concurrency) return;
      
      processing++;
      const job = await this.getNextJob(jobType);
      
      if (job) {
        try {
          job.status = 'processing';
          await processor(job);
          job.status = 'completed';
        } catch (error) {
          console.error(`Job ${job.id} failed:`, error);
          job.attempts++;
          if (job.attempts < 3) {
            // Retry
            await redis.zadd(`queue:${jobType}`, job.priority - 1, JSON.stringify(job));
          } else {
            job.status = 'failed';
            await redis.lpush(`queue:${jobType}:failed`, JSON.stringify(job));
          }
        }
      }
      
      processing--;
      
      // Process next job after a short delay
      if (processing < concurrency) {
        setTimeout(processNext, 100);
      }
    };

    // Start processing
    setInterval(processNext, 1000);
  }
}

// ============================================================================
// 6. ANALYTICS & ENGAGEMENT TRACKING
// ============================================================================
export class AnalyticsService {
  // Track artwork views
  static async trackView(artworkId, userId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Increment daily views
      await redis.incr(`analytics:views:${artworkId}:${today}`);
      await redis.expire(`analytics:views:${artworkId}:${today}`, 30 * 24 * 60 * 60);
      
      // Track unique viewers (if userId provided)
      if (userId) {
        await redis.pfadd(`analytics:unique:${artworkId}:${today}`, userId);
        await redis.expire(`analytics:unique:${artworkId}:${today}`, 30 * 24 * 60 * 60);
      }
      
      // Track total views
      await redis.incr(`analytics:total:views:${artworkId}`);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  // Get artwork analytics
  static async getArtworkAnalytics(artworkId, days = 7) {
    try {
      const views = [];
      const uniqueViews = [];
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const viewCount = await redis.get(`analytics:views:${artworkId}:${dateStr}`) || 0;
        const uniqueCount = await redis.pfcount(`analytics:unique:${artworkId}:${dateStr}`);
        
        views.push({ date: dateStr, count: parseInt(viewCount, 10) });
        uniqueViews.push({ date: dateStr, count: uniqueCount });
      }
      
      const totalViews = await redis.get(`analytics:total:views:${artworkId}`) || 0;
      
      return {
        totalViews: parseInt(totalViews, 10),
        dailyViews: views.reverse(),
        dailyUniqueViews: uniqueViews.reverse(),
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return null;
    }
  }

  // Track user engagement (likes, saves, etc.)
  static async trackEngagement(userId, action, targetId, targetType = 'artwork') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `analytics:engagement:${userId}:${today}`;
      
      await redis.hincrby(key, `${action}:${targetType}`, 1);
      await redis.expire(key, 30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Error tracking engagement:', error);
    }
  }
}

// ============================================================================
// 7. LEADERBOARDS (Popular artworks, top artists)
// ============================================================================
export class LeaderboardService {
  // Add score to leaderboard
  static async addScore(leaderboardName, itemId, score) {
    try {
      await redis.zadd(`leaderboard:${leaderboardName}`, score, itemId);
    } catch (error) {
      console.error('Error adding to leaderboard:', error);
    }
  }

  // Get top items
  static async getTop(leaderboardName, limit = 10) {
    try {
      const items = await redis.zrevrange(`leaderboard:${leaderboardName}`, 0, limit - 1, 'WITHSCORES');
      const result = [];
      
      for (let i = 0; i < items.length; i += 2) {
        result.push({
          id: items[i],
          score: parseInt(items[i + 1], 10),
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  // Get rank of item
  static async getRank(leaderboardName, itemId) {
    try {
      const rank = await redis.zrevrank(`leaderboard:${leaderboardName}`, itemId);
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      console.error('Error getting rank:', error);
      return null;
    }
  }

  // Update popular artworks leaderboard (call when artwork is liked/viewed)
  static async updateArtworkPopularity(artworkId, likeCount, viewCount) {
    try {
      // Weighted score: likes * 10 + views
      const score = (likeCount || 0) * 10 + (viewCount || 0);
      await this.addScore('artworks:popular', artworkId, score);
    } catch (error) {
      console.error('Error updating artwork popularity:', error);
    }
  }
}

// ============================================================================
// 8. REAL-TIME FEED UPDATES (Pub/Sub integration)
// ============================================================================
export class FeedService {
  // Publish feed update
  static async publishFeedUpdate(userId, update) {
    try {
      await redis.publish(`feed:${userId}`, JSON.stringify(update));
    } catch (error) {
      console.error('Error publishing feed update:', error);
    }
  }

  // Subscribe to feed updates (for Socket.io integration)
  static subscribeToFeed(userId, callback) {
    const subscriber = redis.duplicate();
    subscriber.subscribe(`feed:${userId}`, (err, count) => {
      if (err) {
        console.error('Error subscribing to feed:', err);
      } else {
        console.log(`Subscribed to feed updates for user ${userId}`);
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        const update = JSON.parse(message);
        callback(update);
      } catch (error) {
        console.error('Error parsing feed update:', error);
      }
    });

    return subscriber;
  }
}

export default {
  NotificationService,
  MessageCountService,
  SessionService,
  JobQueue,
  AnalyticsService,
  LeaderboardService,
  FeedService,
  RedisRateLimitStore,
};

