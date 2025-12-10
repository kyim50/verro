import express from 'express';
import { query, validationResult, body } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { optionalAuth, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all artists with filters
router.get(
  '/',
  optionalAuth,
  [
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const searchQuery = req.query.search;
      const limit = req.query.limit || 50;

      // If searching, we need to do it differently
      if (searchQuery) {
        // First get matching users
        const { data: users, error: userError } = await supabaseAdmin
          .from('users')
          .select('id')
          .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);

        if (userError) throw userError;

        const userIds = users?.map(u => u.id) || [];

        if (userIds.length === 0) {
          return res.json({ artists: [] });
        }

        // Then get artists for those users
        let artistQuery = supabaseAdmin
          .from('artists')
          .select(`
            *,
            users(id, username, avatar_url, full_name, bio)
          `)
          .in('id', userIds)
          .in('commission_status', ['open', 'limited'])
          .order('rating', { ascending: false })
          .limit(limit);

        // Exclude current user if authenticated
        if (req.user) {
          artistQuery = artistQuery.neq('id', req.user.id);
        }

        const { data: artists, error } = await artistQuery;
        if (error) throw error;
        return res.json({ artists });
      }

      // No search query - return all artists (only open/limited for client explore)
      let artistQuery = supabaseAdmin
        .from('artists')
        .select(`
          *,
          users(id, username, avatar_url, full_name, bio)
        `)
        .in('commission_status', ['open', 'limited'])
        .order('rating', { ascending: false })
        .limit(limit);

      // Exclude current user if authenticated
      if (req.user) {
        artistQuery = artistQuery.neq('id', req.user.id);

        // Also exclude artists the user has already swiped on
        const { data: swipedArtists } = await supabaseAdmin
          .from('swipes')
          .select('artist_id')
          .eq('user_id', req.user.id);

        const swipedIds = swipedArtists?.map(s => s.artist_id) || [];
        if (swipedIds.length > 0) {
          artistQuery = artistQuery.not('id', 'in', `(${swipedIds.join(',')})`);
        }
      }

      const { data: artists, error } = await artistQuery;

      if (error) throw error;
      res.json({ artists });
    } catch (error) {
      next(error);
    }
  }
);

// Get artist profile
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    // Import cache utilities
    const { cache, cacheKeys } = await import('../utils/cache.js');

    // Try to get from cache
    const cacheKey = cacheKeys.artist(req.params.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // First try to get the artist record
    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Get the user data separately
    const userId = artist.user_id || artist.id;
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url, full_name, bio')
      .eq('id', userId)
      .single();

    // Get artist's artworks
    const { data: artworks } = await supabaseAdmin
      .from('artworks')
      .select('*')
      .eq('artist_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter out empty portfolio images
    const portfolioImages = (artist.portfolio_images || []).filter(
      img => img && img.trim() !== ''
    );

    const response = {
      ...artist,
      portfolio_images: portfolioImages,
      user_id: userId,
      users: userData,
      artworks: artworks || []
    };

    // Cache for 10 minutes (cache and cacheKey already defined above)
    await cache.set(cacheKey, response, 600);

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Update artist profile (commission status, etc.)
router.put('/:id', authenticate, [
  body('commissionStatus').optional().isIn(['open', 'closed', 'limited']),
  body('minPrice').optional().isNumeric(),
  body('maxPrice').optional().isNumeric(),
  body('turnaroundDays').optional().isInt(),
  body('specialties').optional().isArray(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const artistId = req.params.id;

    // Verify user owns this artist profile
    if (req.user.id !== artistId) {
      return res.status(403).json({ error: 'You can only update your own artist profile' });
    }

    const { commissionStatus, minPrice, maxPrice, turnaroundDays, specialties } = req.body;

    const updateData = {};
    if (commissionStatus !== undefined) updateData.commission_status = commissionStatus;
    if (minPrice !== undefined) updateData.min_price = minPrice;
    if (maxPrice !== undefined) updateData.max_price = maxPrice;
    if (turnaroundDays !== undefined) updateData.turnaround_days = turnaroundDays;
    if (specialties !== undefined) updateData.specialties = specialties;

    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .update(updateData)
      .eq('id', artistId)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Artist profile updated successfully', artist });
  } catch (error) {
    next(error);
  }
});

export default router;