import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { cache, cacheKeys } from '../utils/cache.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Try to get user from cache first (15 minute TTL)
    const cacheKey = cacheKeys.user(userId);
    let user = await cache.get(cacheKey);

    if (!user) {
      // Get user from database
      const { data: dbUser, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !dbUser) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      user = dbUser;
      
      // Cache user for 15 minutes
      await cache.set(cacheKey, user, 900);
    }

    // Update last_seen and is_online status asynchronously (don't block request)
    const updatePromise = supabaseAdmin
      .from('users')
      .update({
        last_seen: new Date().toISOString(),
        is_online: true
      })
      .eq('id', user.id)
      .then(() => {
        // Update cached user with new last_seen (optional, non-blocking)
        const updatedUser = { ...user, last_seen: new Date().toISOString(), is_online: true };
        cache.set(cacheKey, updatedUser, 900).catch(err => 
          console.error('Error updating cached user:', err)
        );
      })
      .catch(err => console.error('Error updating last_seen:', err));

    // Don't await - let it run in background
    // Fire and forget for better performance

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Try cache first
    const cacheKey = cacheKeys.user(userId);
    let user = await cache.get(cacheKey);

    if (!user) {
      const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (dbUser) {
        user = dbUser;
        // Cache for 15 minutes
        await cache.set(cacheKey, user, 900);
      }
    }

    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export const requireArtist = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.user_type !== 'artist' && req.user.user_type !== 'both') {
    return res.status(403).json({ error: 'Artist account required' });
  }

  next();
};