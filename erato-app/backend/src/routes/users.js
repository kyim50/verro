import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get user profile (public or own)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
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

      response = {
        ...response,
        artist: {
          ...artist,
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

    res.json(response);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update own profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const { full_name, bio, avatar_url } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message });
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

    // Validate portfolio_images array if provided
    if (portfolio_images !== undefined) {
      if (!Array.isArray(portfolio_images)) {
        return res.status(400).json({ error: 'portfolio_images must be an array' });
      }
      if (portfolio_images.length > 6) {
        return res.status(400).json({ error: 'Maximum 6 portfolio images allowed' });
      }
    }

    const updates = {};
    if (commission_status !== undefined) updates.commission_status = commission_status;
    if (min_price !== undefined) updates.min_price = min_price;
    if (max_price !== undefined) updates.max_price = max_price;
    if (turnaround_days !== undefined) updates.turnaround_days = turnaround_days;
    if (specialties !== undefined) updates.specialties = specialties;
    if (social_links !== undefined) updates.social_links = social_links;
    if (portfolio_images !== undefined) updates.portfolio_images = portfolio_images;

    const { data, error } = await supabaseAdmin
      .from('artists')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

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
          user_id: req.user.id,
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

    // Build query to get boards
    let query = supabaseAdmin
      .from('boards')
      .select(`
        id,
        name,
        description,
        board_type,
        is_public,
        created_at,
        board_artworks(
          artworks(
            id,
            title,
            image_url,
            thumbnail_url
          )
        )
      `)
      .eq('user_id', userId);

    // If not viewing own profile, only show public boards
    const isOwnProfile = req.user && req.user.id === userId;
    if (!isOwnProfile) {
      query = query.eq('is_public', true);
    }

    const { data: boards, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Add artwork count to each board
    const boardsWithCount = boards.map(board => ({
      ...board,
      artwork_count: board.board_artworks?.length || 0,
    }));

    res.json(boardsWithCount);
  } catch (error) {
    console.error('Error fetching user boards:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;