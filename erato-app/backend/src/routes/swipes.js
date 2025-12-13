import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Record a swipe
router.post('/', authenticate, async (req, res) => {
  try {
    const { artistId, direction } = req.body;

    console.log('[SWIPES API] Received swipe request:', {
      userId: req.user.id,
      artistId,
      direction,
      artistIdType: typeof artistId,
    });

    if (!artistId || !direction) {
      console.error('[SWIPES API] Missing required fields:', { artistId, direction });
      return res.status(400).json({ error: 'artistId and direction are required' });
    }

    if (!['left', 'right'].includes(direction)) {
      console.error('[SWIPES API] Invalid direction:', direction);
      return res.status(400).json({ error: 'direction must be "left" or "right"' });
    }

    // artistId can be either a UUID (user_id) or a number (artist_id)
    // The artists table uses user_id as the primary key, so we accept UUIDs
    let finalArtistId;
    if (typeof artistId === 'string') {
      // Check if it's a UUID (contains hyphens) or a numeric string
      if (artistId.includes('-')) {
        // It's a UUID - use it directly (artists.id is user_id)
        finalArtistId = artistId;
      } else {
        // It's a numeric string - parse it
        const parsed = parseInt(artistId, 10);
        if (isNaN(parsed)) {
          console.error('[SWIPES API] Invalid artistId format:', artistId);
          return res.status(400).json({ error: 'artistId must be a valid UUID or number' });
        }
        finalArtistId = parsed;
      }
    } else if (typeof artistId === 'number') {
      finalArtistId = artistId;
    } else {
      console.error('[SWIPES API] Invalid artistId type:', typeof artistId, artistId);
      return res.status(400).json({ error: 'artistId must be a valid UUID or number' });
    }

    console.log('[SWIPES API] Recording swipe:', {
      userId: req.user.id,
      artistId: finalArtistId,
      direction,
    });

    // Record the swipe (upsert to handle duplicate attempts)
    const { data, error } = await supabaseAdmin
      .from('swipes')
      .upsert({
        user_id: req.user.id,
        artist_id: finalArtistId,
        direction,
      }, {
        onConflict: 'user_id,artist_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[SWIPES API] Swipe insert error:', error);
      throw error;
    }

    console.log('[SWIPES API] Swipe recorded successfully:', {
      userId: req.user.id,
      artistId: finalArtistId,
      direction,
      swipeId: data?.id,
    });

    res.json({ success: true, swipe: data });
  } catch (error) {
    console.error('[SWIPES API] Error recording swipe:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    res.status(500).json({ error: error.message });
  }
});

// Get user's swipes
router.get('/', authenticate, async (req, res) => {
  try {
    const { data: swipes, error } = await supabaseAdmin
      .from('swipes')
      .select(`
        *,
        artists(
          *,
          users(id, username, avatar_url, full_name, bio)
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ swipes });
  } catch (error) {
    console.error('Error fetching swipes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's liked artists (right swipes only)
router.get('/liked', authenticate, async (req, res) => {
  try {
    const { data: likedArtists, error } = await supabaseAdmin
      .from('swipes')
      .select(`
        *,
        artists(
          *,
          users(id, username, avatar_url, full_name, bio)
        )
      `)
      .eq('user_id', req.user.id)
      .eq('direction', 'right')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ likedArtists });
  } catch (error) {
    console.error('Error fetching liked artists:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unlike an artist (remove from liked)
router.delete('/liked/:artistId', authenticate, async (req, res) => {
  try {
    const { artistId } = req.params;

    const { error } = await supabaseAdmin
      .from('swipes')
      .delete()
      .eq('user_id', req.user.id)
      .eq('artist_id', artistId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error unliking artist:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a swipe (for undo functionality)
router.delete('/:artistId', authenticate, async (req, res) => {
  try {
    const { artistId } = req.params;

    // Handle both UUID and numeric artistId
    let finalArtistId = artistId;
    if (typeof artistId === 'string' && !artistId.includes('-')) {
      const parsed = parseInt(artistId, 10);
      if (!isNaN(parsed)) {
        finalArtistId = parsed;
      }
    }

    const { error } = await supabaseAdmin
      .from('swipes')
      .delete()
      .eq('user_id', req.user.id)
      .eq('artist_id', finalArtistId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting swipe:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
