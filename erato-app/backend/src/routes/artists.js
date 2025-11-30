import express from 'express';
import { supabase } from '../config/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all artists with filters
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { data: artists, error } = await supabase
      .from('artists')
      .select(`
        *,
        users(username, avatar_url, full_name, bio)
      `)
      .eq('commission_status', 'open')
      .order('rating', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ artists });
  } catch (error) {
    next(error);
  }
});

// Get artist profile
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { data: artist, error } = await supabase
      .from('artists')
      .select(`
        *,
        users(username, avatar_url, full_name, bio),
        artworks(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json({ artist });
  } catch (error) {
    next(error);
  }
});

export default router;
