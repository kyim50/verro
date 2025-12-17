import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, optionalAuth, requireArtist } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { cache, cacheKeys } from '../utils/cache.js';

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
    query('sort').optional().isIn(['created_at', 'like_count', 'engagement_score']),
    query('order').optional().isIn(['asc', 'desc']),
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

      // Handle sorting (define before cache key)
      const sortBy = req.query.sort || 'created_at';
      const order = req.query.order || 'desc';

      // Try to get from cache (include sort params in cache key)
      const cacheKey = cacheKeys.artworksList({ page, limit, tags, artistId, search: searchQuery, sort: sortBy, order });
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      
      let query;
      if (sortBy === 'engagement_score') {
        // Use the view that includes engagement scores
        query = supabaseAdmin
          .from('artworks_with_engagement')
          .select('*', { count: 'exact' })
          .order('engagement_score', { ascending: order === 'asc', nullsFirst: false });
      } else {
        query = supabaseAdmin
          .from('artworks')
          .select('*', { count: 'exact' })
          .order(sortBy, { ascending: order === 'asc' });
      }
      
      query = query.range(offset, offset + limit - 1);

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

      // Batch fetch all artists and users
      const artistIds = [...new Set(artworks.map(a => a.artist_id).filter(Boolean))];
      
      const [artistsResult, usersResult] = await Promise.all([
        artistIds.length > 0
          ? supabaseAdmin
              .from('artists')
              .select('id, rating, commission_status, user_id')
              .in('id', artistIds)
          : { data: [] },
        artistIds.length > 0
          ? supabaseAdmin
              .from('users')
              .select('id, username, avatar_url, full_name')
              .in('id', artistIds)
          : { data: [] }
      ]);

      const artistsMap = new Map(artistsResult.data?.map(a => [a.id, a]) || []);
      const usersMap = new Map(usersResult.data?.map(u => [u.id, u]) || []);

      // Enrich artworks with batched data
      const enrichedArtworks = artworks.map(artwork => {
        const artist = artistsMap.get(artwork.artist_id);
        const userId = artist?.user_id || artwork.artist_id;
        const user = usersMap.get(userId);

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
      });

      const response = {
        artworks: enrichedArtworks,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };

      // Cache for 5 minutes
      await cache.set(cacheKey, response, 300);

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Get single artwork
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    // Try to get from cache
    const cacheKey = cacheKeys.artwork(req.params.id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

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

    // Calculate actual like count from "Liked" boards
    const { data: likedBoards } = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('name', 'Liked');

    const likedBoardIds = likedBoards?.map(b => b.id) || [];
    let actualLikeCount = 0;

    if (likedBoardIds.length > 0) {
      const { count } = await supabaseAdmin
        .from('board_artworks')
        .select('*', { count: 'exact', head: true })
        .eq('artwork_id', req.params.id)
        .in('board_id', likedBoardIds);
      
      actualLikeCount = count || 0;
    }

    // Update like_count if it's different (sync)
    if (actualLikeCount !== (artwork.like_count || 0)) {
      await supabaseAdmin
        .from('artworks')
        .update({ like_count: actualLikeCount })
        .eq('id', req.params.id);
      
      artwork.like_count = actualLikeCount;
    }

    // Increment view count
    await supabaseAdmin
      .from('artworks')
      .update({ view_count: (artwork.view_count || 0) + 1 })
      .eq('id', req.params.id);

    const response = { artwork };

    // Cache for 10 minutes (longer for single artwork)
    await cache.set(cacheKey, response, 600);

    res.json(response);
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

      // Invalidate related caches
      await Promise.all([
        cache.delPattern('artworks:list:*'),
        cache.delPattern(`artist:${req.user.id}:artworks`),
        cache.delPattern(`feed:*`),
      ]);

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

      // Invalidate related caches
      await Promise.all([
        cache.del(cacheKeys.artwork(req.params.id)),
        cache.delPattern('artworks:list:*'),
        cache.delPattern(`artist:${req.user.id}:artworks`),
      ]);

      res.json({ message: 'Artwork updated successfully', artwork });
    } catch (error) {
      next(error);
    }
  }
);

// Delete artwork
router.delete('/:id', authenticate, requireArtist, async (req, res, next) => {
  try {
    const artworkId = req.params.id;

    // Check ownership and that artwork exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('artworks')
      .select('artist_id, image_url, thumbnail_url')
      .eq('id', artworkId)
      .single();

    if (fetchError || !existing) {
      throw new AppError('Artwork not found', 404);
    }

    if (existing.artist_id !== req.user.id) {
      throw new AppError('Unauthorized to delete this artwork', 403);
    }

    // Delete all related data first (cleanup related data)
    // 1. Delete all board_artworks entries
    const { error: boardArtworksError } = await supabaseAdmin
      .from('board_artworks')
      .delete()
      .eq('artwork_id', artworkId);

    if (boardArtworksError) {
      console.error('Error deleting board_artworks:', boardArtworksError);
      // Continue anyway - artwork might not be in any boards
    }

    // 2. Delete the artwork itself (this should cascade to any foreign key references if configured)
    const { error: deleteError } = await supabaseAdmin
      .from('artworks')
      .delete()
      .eq('id', artworkId);

    if (deleteError) {
      console.error('Error deleting artwork:', deleteError);
      throw new AppError(`Failed to delete artwork: ${deleteError.message}`, 500);
    }

    // Verify deletion
    const { data: verifyDeleted } = await supabaseAdmin
      .from('artworks')
      .select('id')
      .eq('id', artworkId)
      .maybeSingle();

    if (verifyDeleted) {
      throw new AppError('Artwork deletion failed - artwork still exists', 500);
    }

    // Invalidate related caches
    await Promise.all([
      cache.del(cacheKeys.artwork(artworkId)),
      cache.delPattern('artworks:list:*'),
      cache.delPattern(`artist:${req.user.id}:artworks`),
      cache.delPattern('feed:*'),
      cache.delPattern('board:*:artworks'),
    ]);

    res.json({ message: 'Artwork deleted successfully', deleted: true });
  } catch (error) {
    console.error('Error in delete artwork endpoint:', error);
    next(error);
  }
});

// Like artwork - increments like_count and ensures artwork is in user's Liked board
router.post('/:id/like', authenticate, async (req, res, next) => {
  try {
    const artworkId = req.params.id;

    // Check if artwork exists
    const { data: artwork, error: artworkError } = await supabaseAdmin
      .from('artworks')
      .select('id, like_count')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      throw new AppError('Artwork not found', 404);
    }

    // Get or create user's "Liked" board
    let { data: likedBoard } = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('name', 'Liked')
      .maybeSingle();

    if (!likedBoard) {
      const { data: newBoard, error: createError } = await supabaseAdmin
        .from('boards')
        .insert({
          user_id: req.user.id,
          name: 'Liked',
          description: 'Artworks you liked',
          board_type: 'general',
          is_public: false
        })
        .select('id')
        .single();

      if (createError) throw createError;
      likedBoard = newBoard;
    }

    // Check if artwork is already in the board
    // Use a fresh query (not cached) to check current state
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('board_artworks')
      .select('id')
      .eq('board_id', likedBoard.id)
      .eq('artwork_id', artworkId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking if artwork is in board:', checkError);
      throw checkError;
    }

    console.log('Like check:', { artworkId, boardId: likedBoard.id, existing: !!existing });

    // Toggle behavior: if already liked, unlike it; otherwise like it
    if (existing) {
      // Already liked - unlike it
      // Remove from board
      await supabaseAdmin
        .from('board_artworks')
        .delete()
        .eq('board_id', likedBoard.id)
        .eq('artwork_id', artworkId);

      // Decrement like_count (don't go below 0)
      const newCount = Math.max(0, (artwork.like_count || 0) - 1);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('artworks')
        .update({ like_count: newCount })
        .eq('id', artworkId)
        .select('like_count')
        .single();

      if (updateError) throw updateError;

      // Invalidate caches
      await cache.del(cacheKeys.artwork(artworkId));
      await cache.del(cacheKeys.userBoards(req.user.id)); // Invalidate user boards cache
      await cache.del(cacheKeys.board(likedBoard.id)); // Invalidate specific board cache
      await cache.delPattern(`board:${likedBoard.id}:*`); // Invalidate all board-related caches

      res.json({ message: 'Artwork unliked', likeCount: updated.like_count });
    } else {
      // Not liked - like it
      // Add to board
      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('board_artworks')
        .insert({
          board_id: likedBoard.id,
          artwork_id: artworkId
        })
        .select('id');

      if (insertError) {
        console.error('Error inserting artwork into liked board:', insertError);
        throw insertError;
      }

      console.log('Artwork inserted into liked board:', { 
        artworkId, 
        boardId: likedBoard.id, 
        insertResult,
        insertError: null 
      });

      // Verify the insert actually worked by querying it back
      const { data: verifyInsert, error: verifyError } = await supabaseAdmin
        .from('board_artworks')
        .select('id')
        .eq('board_id', likedBoard.id)
        .eq('artwork_id', artworkId)
        .maybeSingle();

      if (verifyError) {
        console.error('Error verifying insert:', verifyError);
      } else if (!verifyInsert) {
        console.error('⚠️ CRITICAL: Insert succeeded but artwork not found in board!');
        throw new Error('Failed to verify artwork was added to board');
      } else {
        console.log('✅ Verified artwork is in board:', verifyInsert);
      }

      // Increment like_count
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('artworks')
        .update({ like_count: (artwork.like_count || 0) + 1 })
        .eq('id', artworkId)
        .select('like_count')
        .single();

      if (updateError) {
        console.error('Error updating artwork like_count:', updateError);
        throw updateError;
      }

      // Invalidate caches
      await cache.del(cacheKeys.artwork(artworkId));
      await cache.del(cacheKeys.userBoards(req.user.id)); // Invalidate user boards cache
      await cache.del(cacheKeys.board(likedBoard.id)); // Invalidate specific board cache
      await cache.delPattern(`board:${likedBoard.id}:*`); // Invalidate all board-related caches

      console.log('Successfully liked artwork:', { artworkId, likeCount: updated.like_count });
      res.json({ message: 'Artwork liked', likeCount: updated.like_count });
    }
  } catch (error) {
    next(error);
  }
});

// Unlike artwork - decrements like_count and removes from user's Liked board
router.post('/:id/unlike', authenticate, async (req, res, next) => {
  try {
    const artworkId = req.params.id;

    // Check if artwork exists
    const { data: artwork, error: artworkError } = await supabaseAdmin
      .from('artworks')
      .select('id, like_count')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      throw new AppError('Artwork not found', 404);
    }

    // Get user's "Liked" board
    const { data: likedBoard } = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('name', 'Liked')
      .maybeSingle();

    if (likedBoard) {
      // Remove from board
      await supabaseAdmin
        .from('board_artworks')
        .delete()
        .eq('board_id', likedBoard.id)
        .eq('artwork_id', artworkId);

      // Decrement like_count (don't go below 0)
      const newCount = Math.max(0, (artwork.like_count || 0) - 1);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('artworks')
        .update({ like_count: newCount })
        .eq('id', artworkId)
        .select('like_count')
        .single();

      if (updateError) throw updateError;

      // Invalidate caches
      await cache.del(cacheKeys.artwork(artworkId));
      await cache.del(cacheKeys.userBoards(req.user.id)); // Invalidate user boards cache
      await cache.del(cacheKeys.board(likedBoard.id)); // Invalidate specific board cache
      await cache.delPattern(`board:${likedBoard.id}:*`); // Invalidate all board-related caches

      res.json({ message: 'Artwork unliked', likeCount: updated.like_count });
    } else {
      res.json({ message: 'Not liked', likeCount: artwork.like_count });
    }
  } catch (error) {
    next(error);
  }
});

// Get actual like count from boards (for syncing)
router.get('/:id/like-count', optionalAuth, async (req, res, next) => {
  try {
    const artworkId = req.params.id;

    // Get all "Liked" boards
    const { data: likedBoards } = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('name', 'Liked');

    const likedBoardIds = likedBoards?.map(b => b.id) || [];
    let count = 0;

    if (likedBoardIds.length > 0) {
      // Count how many users have this artwork in their "Liked" board
      const { count: likeCount, error } = await supabaseAdmin
        .from('board_artworks')
        .select('*', { count: 'exact', head: true })
        .eq('artwork_id', artworkId)
        .in('board_id', likedBoardIds);

      if (error) throw error;
      count = likeCount || 0;
    }

    // Update the artwork's like_count to match
    await supabaseAdmin
      .from('artworks')
      .update({ like_count: count })
      .eq('id', artworkId);

    res.json({ likeCount: count });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/artworks/personalized
 * @desc    Get personalized artwork feed based on user preferences and engagement
 * @access  Private
 */
router.get('/personalized/feed', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get user preferences
    const { data: preferences } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Get user's engagement history to understand what they like
    const { data: engagements } = await supabaseAdmin
      .from('user_engagement')
      .select('artwork_id, engagement_type, artworks(tags)')
      .eq('user_id', userId)
      .in('engagement_type', ['like', 'save', 'commission_inquiry'])
      .order('created_at', { ascending: false })
      .limit(50);

    // Extract tags from artworks user has engaged with AND track their weights
    const engagedTags = new Map(); // tag -> count/weight
    const engagedArtworkIds = new Set();

    engagements?.forEach(eng => {
      engagedArtworkIds.add(eng.artwork_id);
      eng.artworks?.tags?.forEach(tag => {
        // Weight: like=3, save=2, commission_inquiry=5
        const weight = eng.engagement_type === 'commission_inquiry' ? 5 :
                      eng.engagement_type === 'like' ? 3 : 2;
        engagedTags.set(tag, (engagedTags.get(tag) || 0) + weight);
      });
    });

    // Combine preferred styles and engaged tags (engaged tags weighted higher)
    const allPreferredTags = new Map();

    // Add quiz preferences with lower weight (1 point each)
    (preferences?.preferred_styles || []).forEach(tag => {
      allPreferredTags.set(tag, (allPreferredTags.get(tag) || 0) + 1);
    });
    (preferences?.interests || []).forEach(tag => {
      allPreferredTags.set(tag, (allPreferredTags.get(tag) || 0) + 1);
    });

    // Add engaged tags with their accumulated weights (much higher priority)
    engagedTags.forEach((weight, tag) => {
      allPreferredTags.set(tag, (allPreferredTags.get(tag) || 0) + weight);
    });

    let query = supabaseAdmin
      .from('artworks_with_engagement')
      .select(`
        *,
        artist:artists(
          id,
          commission_status,
          user:users(id, username, avatar_url, full_name)
        )
      `);

    // Exclude artworks user has already heavily engaged with (but only if we have many)
    // For new users, show everything to help them discover
    if (engagedArtworkIds.size > 10) {
      query = query.not('id', 'in', `(${Array.from(engagedArtworkIds).slice(0, 100).join(',')})`);
    }

    // Get initial results (more than needed for scoring)
    const { data: allArtworks, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + (parseInt(limit) * 3) - 1); // Get 3x more for better scoring

    if (error) throw error;

    // If no preferences or tags, return recent artworks
    if (allPreferredTags.size === 0 || !allArtworks || allArtworks.length === 0) {
      // Fallback: get recent artworks without filtering
      const fallbackQuery = supabaseAdmin
        .from('artworks_with_engagement')
        .select(`
          *,
        artist:artists(
          id,
          commission_status,
          user:users(id, username, avatar_url, full_name)
        )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);
      
      const { data: fallbackArtworks, error: fallbackError } = await fallbackQuery;
      
      if (fallbackError) throw fallbackError;
      
      return res.json({
        artworks: fallbackArtworks || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: fallbackArtworks?.length || 0,
          totalPages: Math.ceil((fallbackArtworks?.length || 0) / parseInt(limit)),
        },
        personalization_info: {
          has_preferences: false,
          preferred_tags_count: 0,
          engagement_history_count: engagements?.length || 0,
          fallback_used: true,
        }
      });
    }

    // Filter by preferred tags if available (but don't be too restrictive)
    let artworks = allArtworks || [];
    if (allPreferredTags.size > 0) {
      // Score all artworks based on weighted tag matches
      const scored = artworks.map(artwork => {
        const matchingTags = artwork.tags?.filter(tag => allPreferredTags.has(tag)) || [];
        const weightedScore = matchingTags.reduce((sum, tag) => sum + (allPreferredTags.get(tag) || 0), 0);
        return { artwork, matchingTags: matchingTags.length, weightedScore };
      });

      // Sort by weighted score (not just count)
      scored.sort((a, b) => b.weightedScore - a.weightedScore);

      // Take top matches, but ensure we have enough results
      artworks = scored
        .slice(0, Math.max(parseInt(limit), scored.filter(s => s.matchingTags > 0).length))
        .map(s => s.artwork);

      // If we don't have enough matches, fill with recent artworks
      if (artworks.length < parseInt(limit)) {
        const recentArtworks = allArtworks
          .filter(a => !artworks.some(aw => aw.id === a.id))
          .slice(0, parseInt(limit) - artworks.length);
        artworks = [...artworks, ...recentArtworks];
      }

      // Limit to requested amount
      artworks = artworks.slice(0, parseInt(limit));
    }

    // Score artworks based on:
    // 1. Weighted tag match with user preferences (50% if preferences exist, else 0%)
    // 2. Engagement score (25%)
    // 3. Recency (25%)
    const scoredArtworks = artworks.map(artwork => {
      // Calculate weighted tag match score
      const matchingTags = artwork.tags?.filter(tag => allPreferredTags.has(tag)) || [];
      let tagMatchScore = 0;

      if (allPreferredTags.size > 0 && matchingTags.length > 0) {
        // Calculate weighted score based on tag importance
        const totalWeight = matchingTags.reduce((sum, tag) => sum + (allPreferredTags.get(tag) || 0), 0);
        const maxPossibleWeight = Math.max(...Array.from(allPreferredTags.values())) * matchingTags.length;

        // Normalize to 0-100, with bonus for multiple matching tags
        tagMatchScore = Math.min(100, (totalWeight / maxPossibleWeight) * 100 * 1.2);

        // Extra boost if artwork matches RECENTLY LIKED tags (weight > 2)
        const hasRecentLikedTags = matchingTags.some(tag => allPreferredTags.get(tag) > 2);
        if (hasRecentLikedTags) {
          tagMatchScore = Math.min(100, tagMatchScore * 1.3); // 30% boost for recently liked content
        }
      } else if (allPreferredTags.size > 0) {
        tagMatchScore = 15; // Lower score if no match but preferences exist
      } else {
        tagMatchScore = 50; // Neutral score if no preferences
      }

      // Engagement score (normalized to 0-100)
      const engagementScore = Math.min(100, (artwork.engagement_score || 0) * 10);

      // Recency score
      const daysOld = (Date.now() - new Date(artwork.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 100 - (daysOld * 2)); // 2 points off per day

      // Calculate final score - give MORE weight to tag matches
      const hasPreferences = allPreferredTags.size > 0;
      const finalScore = hasPreferences
        ? (tagMatchScore * 0.5) + (engagementScore * 0.25) + (recencyScore * 0.25)
        : (engagementScore * 0.5) + (recencyScore * 0.5); // More weight on engagement/recency if no preferences

      return {
        ...artwork,
        personalization_score: finalScore,
        match_reasons: {
          matching_tags: matchingTags,
          tag_weights: matchingTags.map(tag => ({ tag, weight: allPreferredTags.get(tag) || 0 })),
          tag_match_percentage: artwork.tags?.length > 0
            ? Math.round((matchingTags.length / artwork.tags.length) * 100)
            : 0,
        }
      };
    });

    // Sort by personalization score
    scoredArtworks.sort((a, b) => b.personalization_score - a.personalization_score);

    // Get total count for pagination (estimate based on current page)
    const totalEstimate = scoredArtworks.length < parseInt(limit) 
      ? offset + scoredArtworks.length 
      : (offset + scoredArtworks.length) * 2; // Estimate if we got full page

    res.json({
      artworks: scoredArtworks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalEstimate,
        totalPages: Math.ceil(totalEstimate / parseInt(limit)),
        hasMore: scoredArtworks.length === parseInt(limit),
      },
      personalization_info: {
        has_preferences: !!preferences?.completed_quiz,
        preferred_tags_count: allPreferredTags.size,
        engagement_history_count: engagements?.length || 0,
        fallback_used: false,
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
