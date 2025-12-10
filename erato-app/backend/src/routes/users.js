import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get user profile (public or own)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    // Try cache first (5 minute TTL for profiles)
    const { cache, cacheKeys } = await import('../utils/cache.js');
    const cacheKey = cacheKeys.userProfile(req.params.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, email, full_name, avatar_url, bio, user_type, created_at')
      .eq('id', req.params.id)
      .single();

    if (userError) throw userError;

    // Check if this is an artist
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('*')
      .eq('id', req.params.id)
      .single();

    let response = { ...user };

    if (artist) {
      // Get artist's artworks
      const { data: artworks } = await supabaseAdmin
        .from('artworks')
        .select('id, title, description, image_url, thumbnail_url, created_at, view_count, like_count')
        .eq('artist_id', artist.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get featured artworks (first 6)
      const featuredArtworks = artworks?.slice(0, 6) || [];

      // Calculate average rating
      const { data: reviews } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .eq('artist_id', artist.id);

      const avgRating = reviews?.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      // Filter out empty portfolio images
      const portfolioImages = (artist.portfolio_images || []).filter(
        img => img && img.trim() !== ''
      );

      response = {
        ...response,
        artist: {
          ...artist,
          portfolio_images: portfolioImages,
          artworks,
          featured_artworks: featuredArtworks,
          review_count: reviews?.length || 0,
          average_rating: avgRating,
        }
      };
    }

    // If viewing own profile, include private info
    if (req.user && req.user.id === req.params.id) {
      // Get user's boards
      const { data: boards } = await supabaseAdmin
        .from('boards')
        .select('id, name, is_public')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      response.boards = boards;
    }

    // Cache response for 5 minutes
    await cache.set(cacheKey, response, 300);
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update own profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const { full_name, bio, avatar_url, username } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    
    // Check if username is being changed and if it's unique
    if (username !== undefined && username.trim() !== '') {
      const trimmedUsername = username.trim();
      
      // Check if username already exists for another user
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', req.user.id)
        .single();
      
      if (existingUser) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      
      updates.username = trimmedUsername;
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Database error updating profile:', error);
      throw error;
    }

    // Invalidate cache for this user
    const { cache, cacheKeys } = await import('../utils/cache.js');
    await cache.del(cacheKeys.userProfile(req.user.id));

    res.json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// Update artist profile
router.put('/me/artist', authenticate, async (req, res) => {
  try {
    const {
      commission_status,
      min_price,
      max_price,
      turnaround_days,
      specialties,
      social_links,
      portfolio_images
    } = req.body;

    // Check if artist profile exists
    const { data: existing } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Artist profile not found' });
    }

    const updates = {};
    if (commission_status !== undefined) updates.commission_status = commission_status;
    if (min_price !== undefined) updates.min_price = min_price;
    if (max_price !== undefined) updates.max_price = max_price;
    if (turnaround_days !== undefined) updates.turnaround_days = turnaround_days;
    if (specialties !== undefined) updates.specialties = specialties;
    if (social_links !== undefined) updates.social_links = social_links;
    
    // Validate and filter portfolio_images array if provided
    if (portfolio_images !== undefined) {
      if (!Array.isArray(portfolio_images)) {
        return res.status(400).json({ error: 'portfolio_images must be an array' });
      }
      // Filter out empty strings before validation
      const filteredImages = portfolio_images.filter(img => img && img.trim() !== '');
      if (filteredImages.length > 6) {
        return res.status(400).json({ error: 'Maximum 6 portfolio images allowed' });
      }
      // Only save non-empty images
      updates.portfolio_images = filteredImages;
    }

    console.log('Updating artist profile with:', JSON.stringify(updates, null, 2));
    if (updates.portfolio_images) {
      console.log('Portfolio images to save (count:', updates.portfolio_images.length, '):', updates.portfolio_images);
    }

    const { data, error } = await supabaseAdmin
      .from('artists')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Database error updating artist profile:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('Database update successful. Raw response:', JSON.stringify(data, null, 2));

    // Ensure portfolio_images is an array and filter out empty strings
    if (data.portfolio_images) {
      // Handle case where portfolio_images might be stored as string (JSON)
      if (typeof data.portfolio_images === 'string') {
        try {
          data.portfolio_images = JSON.parse(data.portfolio_images);
        } catch (e) {
          console.error('Error parsing portfolio_images as JSON:', e);
          data.portfolio_images = [];
        }
      }
      // Filter out empty strings and ensure all entries are valid URLs
      data.portfolio_images = (Array.isArray(data.portfolio_images) ? data.portfolio_images : [])
        .filter(img => img && typeof img === 'string' && img.trim() !== '');
      console.log('Filtered portfolio images (count:', data.portfolio_images.length, '):', data.portfolio_images);
    } else {
      console.log('No portfolio_images in response, setting to empty array');
      data.portfolio_images = [];
    }

    // Invalidate cache for this user's profile to ensure fresh data on next fetch
    const { cache, cacheKeys } = await import('../utils/cache.js');
    await cache.del(cacheKeys.userProfile(req.user.id));
    console.log('Cache invalidated for user:', req.user.id);

    res.json(data);
  } catch (error) {
    console.error('Error updating artist profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete artist onboarding
router.post('/me/artist/onboarding', authenticate, async (req, res) => {
  try {
    const { portfolio_images } = req.body;

    // Validate portfolio_images
    if (!Array.isArray(portfolio_images) || portfolio_images.length !== 6) {
      return res.status(400).json({
        error: 'Exactly 6 portfolio images are required for onboarding'
      });
    }

    // Check if artist profile exists
    let { data: existing } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .single();

    // If artist profile doesn't exist, create it
    if (!existing) {
      const { data: newArtist, error: createError } = await supabaseAdmin
        .from('artists')
        .insert({
          id: req.user.id,
          commission_status: 'open',
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating artist profile:', createError);
        throw createError;
      }
      existing = newArtist;
    }

    // Update artist profile with portfolio images and mark onboarding as complete
    const { data, error } = await supabaseAdmin
      .from('artists')
      .update({
        portfolio_images,
        onboarding_completed: true
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Onboarding completed successfully',
      artist: data
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artist reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { data: reviews, error, count } = await supabaseAdmin
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        client_id,
        users!reviews_client_id_fkey(id, username, avatar_url)
      `, { count: 'exact' })
      .eq('artist_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's boards
router.get('/:id/boards', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Build query to get boards - optimized to only get count, not full artwork data
    let query = supabaseAdmin
      .from('boards')
      .select(`
        id,
        name,
        description,
        board_type,
        is_public,
        created_at,
        board_artworks(count)
      `)
      .eq('user_id', userId);

    // If not viewing own profile, only show public boards
    const isOwnProfile = req.user && req.user.id === userId;
    if (!isOwnProfile) {
      query = query.eq('is_public', true);
    }

    const { data: boards, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Add artwork count to each board (more efficient than loading full artwork data)
    const boardsWithCount = boards.map(board => ({
      id: board.id,
      name: board.name,
      description: board.description,
      board_type: board.board_type,
      is_public: board.is_public,
      created_at: board.created_at,
      artwork_count: Array.isArray(board.board_artworks) ? board.board_artworks.length : 0,
    }));

    res.json(boardsWithCount);
  } catch (error) {
    console.error('Error fetching user boards:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;