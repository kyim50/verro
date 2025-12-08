import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create a review for a completed commission
router.post('/', authenticate, async (req, res) => {
  try {
    const { commission_id, rating, comment } = req.body;

    // Validate inputs
    if (!commission_id || !rating) {
      return res.status(400).json({ error: 'Commission ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('*, artists(user_id)')
      .eq('id', commission_id)
      .single();

    if (commissionError || !commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Verify commission is completed
    if (commission.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed commissions' });
    }

    // Verify user is the client (not the artist)
    if (commission.artists.user_id === req.user.id) {
      return res.status(403).json({ error: 'Artists cannot review their own work' });
    }

    if (commission.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the client can review this commission' });
    }

    // Check if review already exists
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('commission_id', commission_id)
      .single();

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this commission' });
    }

    // Create the review
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .insert({
        commission_id,
        artist_id: commission.artist_id,
        client_id: req.user.id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for an artist
router.get('/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        clients:users!reviews_client_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        ),
        commissions(
          title,
          created_at
        )
      `)
      .eq('artist_id', artistId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate average rating
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      reviews,
      averageRating: averageRating.toFixed(1),
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get review for a specific commission
router.get('/commission/:commissionId', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;

    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        clients:users!reviews_client_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('commission_id', commissionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }

    res.json(review || null);
  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a review
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get existing review
    const { data: existingReview, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingReview) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verify user is the review author
    if (existingReview.client_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own reviews' });
    }

    // Update the review
    const updates = {};
    if (rating !== undefined) updates.rating = rating;
    if (comment !== undefined) updates.comment = comment;

    const { data: review, error: updateError } = await supabaseAdmin
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a review
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing review
    const { data: existingReview, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingReview) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Verify user is the review author
    if (existingReview.client_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own reviews' });
    }

    // Delete the review
    const { error: deleteError } = await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
