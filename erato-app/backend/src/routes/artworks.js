import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, optionalAuth, requireArtist } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Get artworks feed (Pinterest-style)
router.get(
  '/',
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('tags').optional().isString(),
    query('artistId').optional().isUUID(),
    query('search').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const offset = (page - 1) * limit;
      const tags = req.query.tags ? req.query.tags.split(',') : null;
      const artistId = req.query.artistId;
      const searchQuery = req.query.search;

      let query = supabaseAdmin
        .from('artworks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (tags && tags.length > 0) {
        query = query.contains('tags', tags);
      }

      if (artistId) {
        query = query.eq('artist_id', artistId);
      }

      // Text search on title and tags
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`);
      }

      const { data: artworks, error, count} = await query;

      if (error) throw error;

      // Fetch artist and user data for each artwork
      const enrichedArtworks = await Promise.all(
        artworks.map(async (artwork) => {
          // Try to fetch artist record
          const { data: artist } = await supabaseAdmin
            .from('artists')
            .select('id, rating, commission_status, user_id')
            .eq('id', artwork.artist_id)
            .maybeSingle();

          // Fetch the linked user (fallback: use artist_id as user id)
          const userId = artist?.user_id || artwork.artist_id;
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, username, avatar_url, full_name')
            .eq('id', userId)
            .maybeSingle();

          return {
            ...artwork,
            artist_username: user?.username ?? artwork.artist_username,
            artist_avatar: user?.avatar_url ?? artwork.artist_avatar,
            artist_full_name: user?.full_name ?? artwork.artist_full_name,
            artist_user_id: user?.id ?? artist?.user_id ?? artwork.artist_id,
            artists: artist
              ? {
                  ...artist,
                  users: user,
                }
              : undefined,
          };
        })
      );

      res.json({
        artworks: enrichedArtworks,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single artwork
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { data: artwork, error } = await supabaseAdmin
      .from('artworks')
      .select(`
        *,
        artists(
          id,
          commission_status,
          min_price,
          max_price,
          turnaround_days,
          specialties,
          rating,
          total_commissions,
          users(username, avatar_url, full_name, bio)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !artwork) {
      throw new AppError('Artwork not found', 404);
    }

    // Increment view count
    await supabaseAdmin
      .from('artworks')
      .update({ view_count: artwork.view_count + 1 })
      .eq('id', req.params.id);

    res.json({ artwork });
  } catch (error) {
    next(error);
  }
});

// Upload artwork (artists only)
router.post(
  '/',
  authenticate,
  requireArtist,
  [
    body('title').notEmpty().trim(),
    body('description').optional().trim(),
    body('imageUrl').isURL(),
    body('thumbnailUrl').optional().isURL(),
    body('tags').optional().isArray(),
    body('isFeatured').optional().isBoolean(),
    body('displayOrder').optional().isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        imageUrl,
        thumbnailUrl,
        tags,
        isFeatured,
        displayOrder,
        aspectRatio,
      } = req.body;

      const { data: artwork, error } = await supabaseAdmin
        .from('artworks')
        .insert({
          artist_id: req.user.id,
          title,
          description,
          image_url: imageUrl,
          thumbnail_url: thumbnailUrl,
          tags: tags || [],
          is_featured: isFeatured || false,
          display_order: displayOrder || 0,
          aspect_ratio: aspectRatio || '4:5',
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create "Created" board and add artwork to it
      try {
        // Check if user has "Created" board
        const { data: createdBoard, error: boardCheckError } = await supabaseAdmin
          .from('boards')
          .select('id')
          .eq('user_id', req.user.id)
          .eq('board_type', 'created')
          .maybeSingle();

        if (boardCheckError && boardCheckError.code !== 'PGRST116') {
          console.error('Error checking for Created board:', boardCheckError);
        }

        let boardId;

        if (!createdBoard) {
          // Create "Created" board
          const { data: newBoard, error: createBoardError } = await supabaseAdmin
            .from('boards')
            .insert({
              user_id: req.user.id,
              name: 'Created',
              description: 'All your uploaded artworks',
              board_type: 'created',
              is_public: true,
            })
            .select('id')
            .single();

          if (createBoardError) {
            console.error('Error creating Created board:', createBoardError);
          } else {
            boardId = newBoard.id;
          }
        } else {
          boardId = createdBoard.id;
        }

        // Add artwork to Created board
        if (boardId) {
          const { error: addArtworkError } = await supabaseAdmin
            .from('board_artworks')
            .insert({
              board_id: boardId,
              artwork_id: artwork.id,
            });

          if (addArtworkError) {
            console.error('Error adding artwork to Created board:', addArtworkError);
          }
        }
      } catch (boardError) {
        // Log error but don't fail the artwork upload
        console.error('Error with Created board auto-add:', boardError);
      }

      res.status(201).json({
        message: 'Artwork uploaded successfully',
        artwork,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update artwork
router.put(
  '/:id',
  authenticate,
  requireArtist,
  [
    body('title').optional().trim(),
    body('description').optional().trim(),
    body('tags').optional().isArray(),
    body('isFeatured').optional().isBoolean(),
    body('displayOrder').optional().isInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check ownership
      const { data: existing } = await supabase
        .from('artworks')
        .select('artist_id')
        .eq('id', req.params.id)
        .single();

      if (!existing || existing.artist_id !== req.user.id) {
        throw new AppError('Artwork not found or unauthorized', 403);
      }

      const updateData = {};
      if (req.body.title) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.tags) updateData.tags = req.body.tags;
      if (req.body.isFeatured !== undefined) updateData.is_featured = req.body.isFeatured;
      if (req.body.displayOrder !== undefined) updateData.display_order = req.body.displayOrder;

      const { data: artwork, error } = await supabase
        .from('artworks')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      res.json({ message: 'Artwork updated successfully', artwork });
    } catch (error) {
      next(error);
    }
  }
);

// Delete artwork
router.delete('/:id', authenticate, requireArtist, async (req, res, next) => {
  try {
    // Check ownership
    const { data: existing } = await supabase
      .from('artworks')
      .select('artist_id')
      .eq('id', req.params.id)
      .single();

    if (!existing || existing.artist_id !== req.user.id) {
      throw new AppError('Artwork not found or unauthorized', 403);
    }

    const { error } = await supabase
      .from('artworks')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Artwork deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Like artwork
router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const { data: artwork, error } = await supabase
      .from('artworks')
      .update({ like_count: supabase.raw('like_count + 1') })
      .eq('id', req.params.id)
      .select('like_count')
      .single();

    if (error) throw error;

    res.json({ message: 'Artwork liked', likeCount: artwork.like_count });
  } catch (error) {
    next(error);
  }
});

export default router;
