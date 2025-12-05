import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Record a swipe
router.post('/', authenticate, async (req, res) => {
  try {
    const { artistId, direction } = req.body;

    if (!artistId || !direction) {
      return res.status(400).json({ error: 'artistId and direction are required' });
    }

    if (!['left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "left" or "right"' });
    }

    // Record the swipe (upsert to handle duplicate attempts)
    const { data, error } = await supabaseAdmin
      .from('swipes')
      .upsert({
        user_id: req.user.id,
        artist_id: artistId,
        direction,
      }, {
        onConflict: 'user_id,artist_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Swipe insert error:', error);
      throw error;
    }

    res.json({ success: true, swipe: data });
  } catch (error) {
    console.error('Error recording swipe:', error);
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

export default router;
