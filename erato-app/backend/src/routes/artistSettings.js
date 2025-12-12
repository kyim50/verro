import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * @route   GET /api/artists/settings
 * @desc    Get artist commission settings
 * @access  Private (Artist)
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get artist profile - artists.id = user_id (artists table primary key IS the user_id)
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', userId)  // artists.id is the user_id
      .maybeSingle();

    if (artistError) {
      console.error('Error fetching artist:', artistError);
      return res.status(500).json({
        success: false,
        error: 'Database error: ' + artistError.message
      });
    }

    if (!artist) {
      return res.status(404).json({
        success: false,
        error: 'Artist profile not found'
      });
    }

    // Get commission settings from artist_commission_settings table
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('artist_commission_settings')
      .select('*')
      .eq('artist_id', artist.id)
      .maybeSingle();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching commission settings:', settingsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch settings: ' + settingsError.message
      });
    }

    res.json({
      success: true,
      settings: settings || {
        artist_id: artist.id,
        max_queue_slots: 5,
        allow_waitlist: false,
        is_open: true,
        status_message: null,
        terms_of_service: null,
        will_draw: [],
        wont_draw: [],
        avg_response_hours: null
      }
    });
  } catch (error) {
    console.error('Error fetching artist settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/artists/settings
 * @desc    Update artist commission settings
 * @access  Private (Artist)
 */
router.put('/settings', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { settings } = req.body;

    if (!settings) {
      return res.status(400).json({
        success: false,
        error: 'Settings object is required'
      });
    }

    // Validate settings
    const validatedSettings = {
      queue_slots: parseInt(settings.queue_slots) || 3,
      waitlist_enabled: Boolean(settings.waitlist_enabled),
      auto_decline_when_full: Boolean(settings.auto_decline_when_full),
      commissions_paused: Boolean(settings.commissions_paused),
      will_draw: settings.will_draw?.trim() || '',
      wont_draw: settings.wont_draw?.trim() || '',
      terms_of_service: settings.terms_of_service?.trim() || '',
      revision_limit: parseInt(settings.revision_limit) || 2,
      turnaround_time: settings.turnaround_time?.trim() || '7-14',
      updated_at: new Date().toISOString()
    };

    // Get artist profile - artists.id = user_id
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (artistError || !artist) {
      return res.status(404).json({
        success: false,
        error: 'Artist profile not found'
      });
    }

    // Validate and prepare settings for artist_commission_settings table
    const validatedSettings = {
      artist_id: artist.id,
      max_queue_slots: parseInt(settings.queue_slots || settings.max_queue_slots) || 5,
      allow_waitlist: Boolean(settings.waitlist_enabled || settings.allow_waitlist),
      is_open: !Boolean(settings.commissions_paused),
      status_message: settings.status_message?.trim() || null,
      terms_of_service: settings.terms_of_service?.trim() || null,
      will_draw: Array.isArray(settings.will_draw) ? settings.will_draw : (settings.will_draw ? [settings.will_draw] : []),
      wont_draw: Array.isArray(settings.wont_draw) ? settings.wont_draw : (settings.wont_draw ? [settings.wont_draw] : []),
      avg_response_hours: settings.avg_response_hours ? parseInt(settings.avg_response_hours) : null,
      updated_at: new Date().toISOString()
    };

    // Upsert settings in artist_commission_settings table
    const { data, error } = await supabaseAdmin
      .from('artist_commission_settings')
      .upsert(validatedSettings, { onConflict: 'artist_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: validatedSettings
    });
  } catch (error) {
    console.error('Error updating artist settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/artists/:artistId/public-settings
 * @desc    Get public-facing artist commission settings
 * @access  Public
 */
router.get('/:artistId/public-settings', async (req, res) => {
  try {
    const { artistId } = req.params;

    const { data: artist, error } = await supabaseAdmin
      .from('artists')
      .select('commission_settings')
      .eq('id', artistId)
      .single();

    if (error) throw error;

    const settings = artist.commission_settings || {};

    // Return only public-facing settings
    const publicSettings = {
      commissions_paused: settings.commissions_paused || false,
      queue_slots: settings.queue_slots || 3,
      waitlist_enabled: settings.waitlist_enabled || false,
      will_draw: settings.will_draw || '',
      wont_draw: settings.wont_draw || '',
      terms_of_service: settings.terms_of_service || '',
      revision_limit: settings.revision_limit || 2,
      turnaround_time: settings.turnaround_time || '7-14'
    };

    res.json({
      success: true,
      settings: publicSettings
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/artists/:artistId/queue-status
 * @desc    Get current queue status (slots used/available)
 * @access  Public
 */
router.get('/:artistId/queue-status', async (req, res) => {
  try {
    const { artistId } = req.params;

    // Get artist settings
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('commission_settings')
      .eq('id', artistId)
      .single();

    if (artistError) throw artistError;

    const settings = artist.commission_settings || {};
    const queueSlots = settings.queue_slots || 3;
    const commissionsPaused = settings.commissions_paused || false;
    const waitlistEnabled = settings.waitlist_enabled || false;

    // Count active commissions
    const { count: activeCount, error: countError } = await supabaseAdmin
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .in('status', ['pending', 'accepted', 'in_progress']);

    if (countError) throw countError;

    const slotsUsed = activeCount || 0;
    const slotsAvailable = Math.max(0, queueSlots - slotsUsed);
    const isFull = slotsUsed >= queueSlots;

    res.json({
      success: true,
      queue: {
        slots_total: queueSlots,
        slots_used: slotsUsed,
        slots_available: slotsAvailable,
        is_full: isFull,
        commissions_paused: commissionsPaused,
        accepting_commissions: !commissionsPaused && (!isFull || waitlistEnabled)
      }
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
