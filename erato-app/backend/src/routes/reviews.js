import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create a review for a completed commission
router.post('/', authenticate, async (req, res) => {
  try {
    const { commission_id, rating, comment, review_type } = req.body;

    // Validate inputs
    if (!commission_id || !rating) {
      return res.status(400).json({ error: 'Commission ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // review_type: 'client_to_artist' or 'artist_to_client'
    const type = review_type || 'client_to_artist';

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, client_id, artist_id, status')
      .eq('id', commission_id)
      .single();

    if (commissionError || !commission) {
      console.error('Commission fetch error:', commissionError);
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Verify commission is completed
    if (commission.status !== 'completed') {
      return res.status(400).json({ error: 'Can only review completed commissions' });
    }

    // Ensure IDs are compared as strings to avoid type mismatch issues
    const userId = String(req.user.id);
    const clientId = String(commission.client_id);
    
    // Get artist to find user_id
    // commission.artist_id is the artists table ID, not the user_id
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('user_id')
      .eq('id', commission.artist_id)
      .maybeSingle();

    if (artistError) {
      console.error('Error fetching artist:', artistError);
      console.error('Commission artist_id:', commission.artist_id);
      console.error('Commission ID:', commission.id);
      console.error('User ID:', userId);
    }

    if (!artist) {
      console.error('Artist not found for commission:', {
        commissionId: commission.id,
        artistId: commission.artist_id,
        userId: userId
      });
      return res.status(500).json({ error: 'Failed to verify commission ownership - artist not found' });
    }

    const artistUserId = String(artist.user_id);

    // Check if user is client or artist
    const isClient = clientId === userId;
    const isArtist = artistUserId === userId;

    console.log('Review authorization check:', {
      userId,
      clientId,
      artistUserId,
      isClient,
      isArtist,
      commissionId: commission.id,
      reviewType: type
    });

    if (!isClient && !isArtist) {
      console.error('Authorization failed:', {
        userId,
        clientId,
        artistUserId,
        commissionId: commission.id
      });
      return res.status(403).json({ error: 'You must be part of this commission to review' });
    }

    // Verify review type matches user role
    if (type === 'client_to_artist' && !isClient) {
      return res.status(403).json({ error: 'Only the client can review the artist' });
    }

    if (type === 'artist_to_client' && !isArtist) {
      return res.status(403).json({ error: 'Only the artist can review the client' });
    }

    // Check if review already exists for this type
    const { data: existingReview } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('commission_id', commission_id)
      .eq('review_type', type)
      .single();

    if (existingReview) {
      return res.status(400).json({ error: `You have already left a ${type === 'client_to_artist' ? 'review for the artist' : 'review for the client'}` });
    }

    // Create the review based on type
    let reviewData = {
      commission_id,
      rating,
      comment: comment || null,
      review_type: type,
    };

    if (type === 'client_to_artist') {
      reviewData.artist_id = commission.artist_id;
      reviewData.client_id = req.user.id;
    } else {
      reviewData.artist_id = commission.artist_id;
      reviewData.client_id = commission.client_id;
    }

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .insert(reviewData)
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

    // Get reviews - optimized to avoid complex joins
    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('artist_id', artistId)
      .eq('review_type', 'client_to_artist')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!reviews || reviews.length === 0) {
      return res.json({
        reviews: [],
        averageRating: '0.0',
        totalReviews: 0,
      });
    }

    // Get unique client IDs and commission IDs
    const clientIds = [...new Set(reviews.map(r => r.client_id).filter(Boolean))];
    const commissionIds = [...new Set(reviews.map(r => r.commission_id).filter(Boolean))];

    // Fetch clients and commissions in parallel
    const [clientsResult, commissionsResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', clientIds),
      supabaseAdmin
        .from('commissions')
        .select('id, title, created_at')
        .in('id', commissionIds)
    ]);

    // Create lookup maps
    const clientMap = new Map(clientsResult.data?.map(c => [c.id, c]) || []);
    const commissionMap = new Map(commissionsResult.data?.map(c => [c.id, c]) || []);

    // Transform reviews with pre-fetched data
    const enrichedReviews = reviews.map((review) => ({
      ...review,
      clients: clientMap.get(review.client_id) || null,
      commissions: commissionMap.get(review.commission_id) || null
    }));

    // Calculate average rating
    const averageRating = enrichedReviews.length > 0
      ? enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / enrichedReviews.length
      : 0;

    res.json({
      reviews: enrichedReviews,
      averageRating: averageRating.toFixed(1),
      totalReviews: enrichedReviews.length,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reviews about a client (reviews left by artists about this client)
router.get('/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Get reviews where artists reviewed this client - optimized single query
    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('client_id', clientId)
      .eq('review_type', 'artist_to_client')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!reviews || reviews.length === 0) {
      return res.json({
        reviews: [],
        averageRating: '0.0',
        totalReviews: 0,
      });
    }

    // Get all commission IDs in one batch
    const commissionIds = reviews.map(r => r.commission_id).filter(Boolean);
    
    // Fetch all commissions in one query
    const { data: commissions, error: commError } = await supabaseAdmin
      .from('commissions')
      .select('id, title, created_at, artist_id')
      .in('id', commissionIds);

    if (commError) throw commError;

    // Create a map for fast lookup
    const commissionMap = new Map(commissions?.map(c => [c.id, c]) || []);

    // Get all unique artist IDs
    const artistIds = [...new Set(commissions?.map(c => c.artist_id).filter(Boolean) || [])];
    
    // Fetch all artists and their users in one query
    const { data: artists, error: artistError } = await supabaseAdmin
      .from('artists')
      .select(`
        id,
        user_id,
        users:users!artists_user_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .in('id', artistIds);

    if (artistError) throw artistError;

    // Create maps for fast lookup
    const artistMap = new Map(artists?.map(a => [a.id, a]) || []);

    // Transform reviews with pre-fetched data (no additional queries)
    const transformedReviews = reviews.map((review) => {
      const commission = commissionMap.get(review.commission_id);
      const artist = commission ? artistMap.get(commission.artist_id) : null;

      return {
        ...review,
        artist: artist?.users || null,
        commission: commission ? {
          title: commission.title,
          created_at: commission.created_at
        } : null
      };
    });

    // Calculate average rating
    const averageRating = transformedReviews.length > 0
      ? transformedReviews.reduce((sum, r) => sum + r.rating, 0) / transformedReviews.length
      : 0;

    res.json({
      reviews: transformedReviews,
      averageRating: averageRating.toFixed(1),
      totalReviews: transformedReviews.length,
    });
  } catch (error) {
    console.error('Error fetching client reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for a specific commission
router.get('/commission/:commissionId', async (req, res) => {
  try {
    const { commissionId } = req.params;

    const { data: reviews, error } = await supabaseAdmin
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
      .eq('commission_id', commissionId);

    if (error) throw error;

    res.json(reviews || []);
  } catch (error) {
    console.error('Error fetching reviews:', error);
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
