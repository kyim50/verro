import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Request a commission
router.post('/request', authenticate, async (req, res) => {
  try {
    const { artist_id, artwork_id, details, client_note } = req.body;

    if (!artist_id || !details) {
      return res.status(400).json({ error: 'artist_id and details are required' });
    }

    // Prevent requesting commission to yourself
    if (artist_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot request a commission from yourself' });
    }

    // Verify artist exists
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', artist_id)
      .single();

    if (artistError || !artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Create commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .insert({
        client_id: req.user.id,
        artist_id,
        artwork_id: artwork_id || null,
        details,
        client_note: client_note || null,
        status: 'pending'
      })
      .select()
      .single();

    if (commissionError) throw commissionError;

    // Create a conversation for this commission
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .insert({
        commission_id: commission.id
      })
      .select()
      .single();

    if (conversationError) throw conversationError;

    // Add both participants to the conversation
    const participants = [
      { conversation_id: conversation.id, user_id: req.user.id },
      { conversation_id: conversation.id, user_id: artist_id }
    ];

    await supabaseAdmin.from('conversation_participants').insert(participants);

    // Send initial message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: req.user.id,
      message_type: 'commission_request',
      content: details,
      metadata: {
        commission_id: commission.id,
        artwork_id: artwork_id || null
      }
    });

    res.status(201).json({
      commission,
      conversation
    });
  } catch (error) {
    console.error('Error creating commission request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's commissions (as client or artist)
router.get('/', authenticate, async (req, res) => {
  try {
    const { type = 'all', status } = req.query;

    let query = supabaseAdmin
      .from('commissions')
      .select(`
        *,
        artwork:artworks(id, title, thumbnail_url, image_url)
      `)
      .order('created_at', { ascending: false });

    if (type === 'received') {
      // Commissions received as artist
      query = query.eq('artist_id', req.user.id);
    } else if (type === 'sent') {
      // Commissions sent as client
      query = query.eq('client_id', req.user.id);
    } else {
      // All commissions (either as client or artist)
      query = query.or(`client_id.eq.${req.user.id},artist_id.eq.${req.user.id}`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: commissions, error } = await query;

    if (error) throw error;

    // Manually fetch client and artist data for each commission
    const enrichedCommissions = await Promise.all(
      commissions.map(async (commission) => {
        // Fetch client data
        const { data: client } = await supabaseAdmin
          .from('users')
          .select('id, username, full_name, avatar_url')
          .eq('id', commission.client_id)
          .single();

        // Fetch artist data
        const { data: artist } = await supabaseAdmin
          .from('artists')
          .select('id')
          .eq('id', commission.artist_id)
          .single();

        let artistWithUser = null;
        if (artist) {
          const { data: artistUser } = await supabaseAdmin
            .from('users')
            .select('username, full_name, avatar_url')
            .eq('id', artist.id)
            .single();

          artistWithUser = {
            ...artist,
            users: artistUser
          };
        }

        return {
          ...commission,
          client,
          artist: artistWithUser
        };
      })
    );

    res.json({ commissions: enrichedCommissions });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single commission
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data: commission, error } = await supabaseAdmin
      .from('commissions')
      .select(`
        *,
        artwork:artworks(id, title, thumbnail_url, image_url)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Verify user is part of this commission
    if (commission.client_id !== req.user.id && commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch client data
    const { data: client } = await supabaseAdmin
      .from('users')
      .select('id, username, full_name, avatar_url, bio')
      .eq('id', commission.client_id)
      .single();

    // Fetch artist data
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id, min_price, max_price, turnaround_days')
      .eq('id', commission.artist_id)
      .single();

    let artistWithUser = null;
    if (artist) {
      const { data: artistUser } = await supabaseAdmin
        .from('users')
        .select('username, full_name, avatar_url, bio')
        .eq('id', artist.id)
        .single();

      artistWithUser = {
        ...artist,
        users: artistUser
      };
    }

    res.json({
      ...commission,
      client,
      artist: artistWithUser
    });
  } catch (error) {
    console.error('Error fetching commission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update commission status (artist only)
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, artist_response } = req.body;

    if (!['accepted', 'declined', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get commission to verify artist
    const { data: commission } = await supabaseAdmin
      .from('commissions')
      .select('artist_id, client_id')
      .eq('id', req.params.id)
      .single();

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Verify user is the artist or client
    const isArtist = commission.artist_id === req.user.id;
    const isClient = commission.client_id === req.user.id;

    if (!isArtist && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Artists can accept/reject/complete, clients can cancel
    if (isClient && status !== 'cancelled') {
      return res.status(403).json({ error: 'Clients can only cancel commissions' });
    }

    // Prepare update data
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    // Add artist_response and responded_at if artist is responding
    if (isArtist && (status === 'accepted' || status === 'declined')) {
      if (artist_response) {
        updates.artist_response = artist_response;
      }
      updates.responded_at = new Date().toISOString();
    }

    // Update status
    const { data: updated, error } = await supabaseAdmin
      .from('commissions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Send status update message
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('commission_id', req.params.id)
      .single();

    if (conversation) {
      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: req.user.id,
        message_type: 'commission_update',
        content: `Commission status updated to: ${status}`,
        metadata: { status, commission_id: req.params.id }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating commission status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update commission details (artist only - for price/deadline)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { price, deadline } = req.body;

    // Get commission to verify artist
    const { data: commission } = await supabaseAdmin
      .from('commissions')
      .select('artist_id')
      .eq('id', req.params.id)
      .single();

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can update commission details' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (price !== undefined) updates.price = price;
    if (deadline !== undefined) updates.deadline = deadline;

    const { data: updated, error } = await supabaseAdmin
      .from('commissions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(updated);
  } catch (error) {
    console.error('Error updating commission:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
