import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * @route   POST /api/review-enhancements/:reviewId/respond
 * @desc    Artist responds to a review
 * @access  Private (Artist)
 */
router.post('/:reviewId/respond', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { response } = req.body;
    const userId = req.user.id;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Response cannot be empty'
      });
    }

    // Get review details
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select(`
        id,
        artist_id,
        artist_response,
        review_type
      `)
      .eq('id', reviewId)
      .single();

    if (reviewError) throw reviewError;

    // Verify it's a client-to-artist review
    if (review.review_type !== 'client_to_artist') {
      return res.status(400).json({
        success: false,
        error: 'Can only respond to client reviews'
      });
    }

    // Verify user is the artist being reviewed
    if (review.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the reviewed artist can respond'
      });
    }

    // Update review with artist response
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({
        artist_response: response,
        artist_responded_at: new Date().toISOString()
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Response added successfully',
      data
    });
  } catch (error) {
    console.error('Error adding artist response:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/review-enhancements/:reviewId/respond
 * @desc    Update artist response to a review
 * @access  Private (Artist)
 */
router.put('/:reviewId/respond', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { response } = req.body;
    const userId = req.user.id;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Response cannot be empty'
      });
    }

    // Get review details
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('id, artist_id, artist_response')
      .eq('id', reviewId)
      .single();

    if (reviewError) throw reviewError;

    // Verify user is the artist
    if (review.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the artist can update their response'
      });
    }

    // Verify there is an existing response
    if (!review.artist_response) {
      return res.status(400).json({
        success: false,
        error: 'No existing response to update'
      });
    }

    // Update response
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ artist_response: response })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Response updated successfully',
      data
    });
  } catch (error) {
    console.error('Error updating artist response:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/review-enhancements/:reviewId/respond
 * @desc    Remove artist response from a review
 * @access  Private (Artist)
 */
router.delete('/:reviewId/respond', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Get review details
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('id, artist_id')
      .eq('id', reviewId)
      .single();

    if (reviewError) throw reviewError;

    // Verify user is the artist
    if (review.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the artist can delete their response'
      });
    }

    // Remove response
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({
        artist_response: null,
        artist_responded_at: null
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Response deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting artist response:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/review-enhancements/:reviewId/helpful
 * @desc    Mark a review as helpful
 * @access  Private
 */
router.post('/:reviewId/helpful', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Check if already marked as helpful
    const { data: existing } = await supabaseAdmin
      .from('review_helpfulness')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'You have already marked this review as helpful'
      });
    }

    // Add helpfulness record
    const { data, error } = await supabaseAdmin
      .from('review_helpfulness')
      .insert({
        review_id: reviewId,
        user_id: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Get updated review with count
    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    res.json({
      success: true,
      message: 'Review marked as helpful',
      data: {
        helpfulCount: review?.helpful_count || 0
      }
    });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/review-enhancements/:reviewId/helpful
 * @desc    Unmark a review as helpful
 * @access  Private
 */
router.delete('/:reviewId/helpful', authenticate, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Remove helpfulness record
    const { error } = await supabaseAdmin
      .from('review_helpfulness')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', userId);

    if (error) throw error;

    // Get updated review with count
    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    res.json({
      success: true,
      message: 'Review unmarked as helpful',
      data: {
        helpfulCount: review?.helpful_count || 0
      }
    });
  } catch (error) {
    console.error('Error unmarking review as helpful:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/review-enhancements/artist/:artistId/with-responses
 * @desc    Get all reviews for an artist with responses and helpful counts
 * @access  Public
 */
router.get('/artist/:artistId/with-responses', async (req, res) => {
  try {
    const { artistId } = req.params;
    const { limit = 20, offset = 0, verified_only = false } = req.query;

    let query = supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('artist_id', artistId)
      .eq('review_type', 'client_to_artist')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (verified_only === 'true') {
      query = query.eq('verified_commission', true);
    }

    const { data: reviews, error } = await query;

    if (error) throw error;

    // Fetch client user data for all reviews
    const clientIds = [...new Set(reviews.map(r => r.client_id).filter(Boolean))];
    const { data: clientUsers } = clientIds.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, username, full_name, avatar_url')
          .in('id', clientIds)
      : { data: [] };
    
    const clientUserMap = new Map(clientUsers?.map(u => [u.id, u]) || []);

    // Get helpful status for current user if authenticated
    let userHelpfulReviews = [];
    const authHeader = req.headers.authorization;
    if (authHeader) {
      // Try to get user's helpful reviews
      const reviewIds = reviews.map(r => r.id);
      const { data: helpful } = await supabaseAdmin
        .from('review_helpfulness')
        .select('review_id')
        .in('review_id', reviewIds);
      userHelpfulReviews = helpful?.map(h => h.review_id) || [];
    }

    // Add user helpful status and client data to each review
    const enrichedReviews = reviews.map(review => ({
      ...review,
      client: clientUserMap.get(review.client_id) || null,
      userMarkedHelpful: userHelpfulReviews.includes(review.id)
    }));

    // Calculate stats
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;
    const verifiedCount = reviews.filter(r => r.verified_commission).length;
    const withResponsesCount = reviews.filter(r => r.artist_response).length;

    res.json({
      success: true,
      data: {
        reviews: enrichedReviews,
        stats: {
          totalReviews,
          averageRating: averageRating.toFixed(1),
          verifiedReviews: verifiedCount,
          responseRate: totalReviews > 0
            ? ((withResponsesCount / totalReviews) * 100).toFixed(1)
            : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching reviews with responses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/review-enhancements/:reviewId/helpful-users
 * @desc    Get list of users who found a review helpful
 * @access  Public
 */
router.get('/:reviewId/helpful-users', async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { limit = 10 } = req.query;

    const { data, error } = await supabaseAdmin
      .from('review_helpfulness')
      .select(`
        created_at,
        users:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('review_id', reviewId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching helpful users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
