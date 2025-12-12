import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * @route   POST /api/engagement/track
 * @desc    Track user engagement with an artwork
 * @access  Private
 */
router.post('/track', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      artwork_id,
      engagement_type, // 'view', 'click', 'like', 'save', 'share', 'commission_inquiry'
      duration_seconds,
      metadata
    } = req.body;

    // Validate engagement type
    const validTypes = ['view', 'click', 'like', 'save', 'share', 'commission_inquiry'];
    if (!validTypes.includes(engagement_type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid engagement type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Verify artwork exists
    const { data: artwork, error: artworkError } = await supabaseAdmin
      .from('artworks')
      .select('id')
      .eq('id', artwork_id)
      .maybeSingle();

    if (artworkError || !artwork) {
      return res.status(404).json({
        success: false,
        error: 'Artwork not found'
      });
    }

    // Track engagement
    const engagementData = {
      user_id: userId,
      artwork_id,
      engagement_type,
      duration_seconds: duration_seconds || null,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };

    const { data: engagement, error } = await supabaseAdmin
      .from('user_engagement')
      .insert(engagementData)
      .select()
      .single();

    if (error) {
      // If duplicate, update the timestamp for certain types
      if (error.code === '23505') {
        // Duplicate - this is okay for views, just return success
        return res.json({
          success: true,
          message: 'Engagement already tracked',
          data: null
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: 'Engagement tracked successfully',
      data: engagement
    });
  } catch (error) {
    console.error('Error tracking engagement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/engagement/batch
 * @desc    Track multiple engagement events at once
 * @access  Private
 */
router.post('/batch', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { engagements } = req.body; // Array of engagement objects

    if (!Array.isArray(engagements) || engagements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Engagements array is required and must not be empty'
      });
    }

    // Validate and prepare engagement data
    const validTypes = ['view', 'click', 'like', 'save', 'share', 'commission_inquiry'];
    const engagementData = engagements.map(eng => ({
      user_id: userId,
      artwork_id: eng.artwork_id,
      engagement_type: eng.engagement_type,
      duration_seconds: eng.duration_seconds || null,
      metadata: eng.metadata || {},
      created_at: new Date().toISOString()
    }));

    // Validate types
    for (const eng of engagementData) {
      if (!validTypes.includes(eng.engagement_type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid engagement type: ${eng.engagement_type}`
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('user_engagement')
      .insert(engagementData)
      .select();

    if (error) {
      console.error('Batch engagement error:', error);
      // Continue even with duplicates
    }

    res.json({
      success: true,
      message: 'Batch engagement tracked successfully',
      data: data || []
    });
  } catch (error) {
    console.error('Error tracking batch engagement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/engagement/artwork/:artworkId/stats
 * @desc    Get engagement statistics for an artwork
 * @access  Public
 */
router.get('/artwork/:artworkId/stats', optionalAuth, async (req, res) => {
  try {
    const { artworkId } = req.params;

    const { data: stats, error } = await supabaseAdmin
      .from('artwork_engagement_stats')
      .select('*')
      .eq('artwork_id', artworkId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Calculate engagement score if stats exist
    let engagementScore = 0;
    if (stats) {
      const { data: scoreData } = await supabaseAdmin
        .rpc('calculate_engagement_score', { artwork_id_param: artworkId });

      engagementScore = scoreData || 0;
    }

    res.json({
      success: true,
      data: stats ? {
        ...stats,
        engagement_score: engagementScore
      } : {
        artwork_id: artworkId,
        total_views: 0,
        total_clicks: 0,
        total_saves: 0,
        total_shares: 0,
        total_commission_inquiries: 0,
        engagement_score: 0,
        last_engagement_at: null
      }
    });
  } catch (error) {
    console.error('Error fetching engagement stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/engagement/user/history
 * @desc    Get user's engagement history
 * @access  Private
 */
router.get('/user/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      limit = 50,
      offset = 0,
      engagement_type
    } = req.query;

    let query = supabaseAdmin
      .from('user_engagement')
      .select(`
        *,
        artwork:artworks(id, title, image_url, artist_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (engagement_type) {
      query = query.eq('engagement_type', engagement_type);
    }

    const { data: engagements, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: engagements || []
    });
  } catch (error) {
    console.error('Error fetching engagement history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/engagement/trending
 * @desc    Get trending artworks based on engagement
 * @access  Public
 */
router.get('/trending', optionalAuth, async (req, res) => {
  try {
    const {
      time_window = 'day', // 'hour', 'day', 'week', 'month'
      limit = 20
    } = req.query;

    // First try to get from cache
    const { data: trending, error: trendingError } = await supabaseAdmin
      .from('trending_artworks')
      .select(`
        *,
        artwork:artworks(
          *,
          artist:artists(
            id,
            user:users(id, username, avatar_url, full_name)
          )
        )
      `)
      .eq('time_window', time_window)
      .order('rank', { ascending: true })
      .limit(parseInt(limit));

    if (trendingError) throw trendingError;

    // If cache is empty or stale, calculate on the fly
    if (!trending || trending.length === 0) {
      // Get artworks with highest engagement scores
      const { data: artworks, error } = await supabaseAdmin
        .from('artworks_with_engagement')
        .select(`
          *,
          artist:artists(
            id,
            user:users(id, username, avatar_url, full_name)
          )
        `)
        .order('engagement_score', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      return res.json({
        success: true,
        data: artworks || [],
        from_cache: false
      });
    }

    res.json({
      success: true,
      data: trending.map(t => t.artwork),
      from_cache: true
    });
  } catch (error) {
    console.error('Error fetching trending artworks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/engagement/user/recommendations
 * @desc    Get personalized artwork recommendations based on user engagement
 * @access  Private
 */
router.get('/user/recommendations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    // Get user's preferences
    const { data: preferences } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Get user's engagement history to understand patterns
    const { data: engagements } = await supabaseAdmin
      .from('user_engagement')
      .select('artwork_id, engagement_type')
      .eq('user_id', userId)
      .in('engagement_type', ['like', 'save', 'commission_inquiry'])
      .order('created_at', { ascending: false })
      .limit(50);

    const engagedArtworkIds = engagements?.map(e => e.artwork_id) || [];

    // Build recommendation query
    let query = supabaseAdmin
      .from('artworks')
      .select(`
        *,
        artist:artists(
          id,
          user:users(id, username, avatar_url, full_name)
        ),
        engagement:artwork_engagement_stats(
          total_views,
          total_clicks,
          total_saves,
          engagement_score
        )
      `)
      .order('created_at', { ascending: false });

    // Exclude artworks user has already engaged with
    if (engagedArtworkIds.length > 0) {
      query = query.not('id', 'in', `(${engagedArtworkIds.join(',')})`);
    }

    // Filter by preferred styles if available
    if (preferences?.preferred_styles && preferences.preferred_styles.length > 0) {
      query = query.overlaps('tags', preferences.preferred_styles);
    }

    const { data: artworks, error } = await query.limit(parseInt(limit));

    if (error) throw error;

    // Sort by a combination of recency and engagement
    const scoredArtworks = (artworks || []).map(artwork => {
      const engagement = artwork.engagement?.[0] || {};
      const engagementScore = engagement.engagement_score || 0;

      // Calculate recency score (newer = higher)
      const daysOld = (Date.now() - new Date(artwork.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 100 - daysOld);

      // Combined score: 60% engagement, 40% recency
      const finalScore = (engagementScore * 0.6) + (recencyScore * 0.4);

      return {
        ...artwork,
        recommendation_score: finalScore
      };
    }).sort((a, b) => b.recommendation_score - a.recommendation_score);

    res.json({
      success: true,
      data: scoredArtworks,
      based_on: {
        has_preferences: !!preferences?.completed_quiz,
        engagement_history_count: engagements?.length || 0
      }
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
