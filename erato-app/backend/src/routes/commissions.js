import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { NotificationService } from '../utils/redisServices.js';

const router = express.Router();

// Request a commission
router.post('/request', authenticate, async (req, res) => {
  try {
    const { artist_id, artwork_id, details, client_note, budget, deadline } = req.body;

    if (!artist_id || !details) {
      return res.status(400).json({ error: 'artist_id and details are required' });
    }

    // Prevent requesting commission to yourself
    if (artist_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot request a commission from yourself' });
    }

    // Check if requester is also an artist (artists cannot request commissions from other artists)
    const { data: requesterArtist, error: requesterArtistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (requesterArtist) {
      return res.status(403).json({ error: 'Artists cannot request commissions from other artists. Only clients can request commissions.' });
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
        budget: budget || null,
        deadline_text: deadline || null,
        status: 'pending'
      })
      .select()
      .single();

    if (commissionError) throw commissionError;

    // Check if there's an existing conversation between client and artist
    // First, get all conversations the client is in
    const { data: clientConversations } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    let conversation = null;

    if (clientConversations && clientConversations.length > 0) {
      const conversationIds = clientConversations.map(p => p.conversation_id);
      
      // Check each conversation to see if it has both client and artist
      for (const convId of conversationIds) {
        const { data: convParticipants } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', convId);

        if (convParticipants) {
          const participantIds = convParticipants.map(p => p.user_id);
          // Check if both client and artist are in this conversation
          if (participantIds.includes(req.user.id) && participantIds.includes(artist_id)) {
            // Found existing conversation - get it
            const { data: existingConv } = await supabaseAdmin
              .from('conversations')
              .select('*')
              .eq('id', convId)
              .single();
            
            if (existingConv) {
              conversation = existingConv;
              // Update the conversation to link it to this commission
              await supabaseAdmin
                .from('conversations')
                .update({ commission_id: commission.id })
                .eq('id', convId);
              break;
            }
          }
        }
      }
    }

    // If no existing conversation found, create a new one
    if (!conversation) {
      const { data: newConversation, error: conversationError } = await supabaseAdmin
        .from('conversations')
        .insert({
          commission_id: commission.id
        })
        .select()
        .single();

      if (conversationError) throw conversationError;
      conversation = newConversation;

      // Add both participants to the conversation (only if new conversation)
      const participants = [
        { conversation_id: conversation.id, user_id: req.user.id },
        { conversation_id: conversation.id, user_id: artist_id }
      ];

      await supabaseAdmin.from('conversation_participants').insert(participants);
    }

    // Send initial message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: req.user.id,
      message_type: 'commission_request',
      content: details,
      metadata: {
        commission_id: commission.id,
        artwork_id: artwork_id || null,
        title: client_note || null,
        budget: budget || null,
        deadline: deadline || null
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
    const { type = 'all', status, clientId, artistId } = req.query;

    let query = supabaseAdmin
      .from('commissions')
      .select('*')
      .order('created_at', { ascending: false });

    // Support filtering by clientId and artistId (for client profile view)
    if (clientId && artistId) {
      query = query.eq('client_id', clientId).eq('artist_id', artistId);
    } else if (clientId) {
      query = query.eq('client_id', clientId);
    } else if (artistId) {
      query = query.eq('artist_id', artistId);
    } else if (type === 'received') {
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

    if (!commissions || commissions.length === 0) {
      return res.json({ commissions: [] });
    }

    // Get unique client and artist IDs for batch fetching
    const clientIds = [...new Set(commissions.map(c => c.client_id).filter(Boolean))];
    const artistIds = [...new Set(commissions.map(c => c.artist_id).filter(Boolean))];
    const artworkIds = [...new Set(commissions.map(c => c.artwork_id).filter(Boolean))];

    console.log('Fetching related data:');
    console.log(`- Client IDs: ${clientIds.length}`, clientIds);
    console.log(`- Artist IDs: ${artistIds.length}`, artistIds);

    // Fetch all related data in parallel (no loops!)
    const [clientsResult, artistsResult, artworksResult] = await Promise.all([
      // Fetch all clients
      supabaseAdmin
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', clientIds),
      
      // Fetch all artists
      // Note: artistIds here are actually user_ids (commission.artist_id is user_id)
      artistIds.length > 0
        ? supabaseAdmin
            .from('artists')
            .select('id')
            .in('id', artistIds)
        : Promise.resolve({ data: [], error: null }),
      
      // Fetch all artworks (if any)
      artworkIds.length > 0
        ? supabaseAdmin
            .from('artworks')
            .select('id, title, thumbnail_url, image_url')
            .in('id', artworkIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    // Check for errors
    if (clientsResult.error) {
      console.error('Error fetching clients:', clientsResult.error);
    }
    if (artistsResult.error) {
      console.error('Error fetching artists:', artistsResult.error);
      console.error('Artist IDs we tried to fetch:', artistIds);
    }
    if (artworksResult.error) {
      console.error('Error fetching artworks:', artworksResult.error);
    }

    // Note: artistIds are actually user_ids, and artists.id equals user_id
    // So we can fetch artist users directly using the artistIds (which are user_ids)
    const { data: artistUsers } = artistIds.length > 0
      ? await supabaseAdmin
          .from('users')
          .select('id, username, full_name, avatar_url')
          .in('id', artistIds)
      : { data: [] };

    // Create lookup maps for O(1) access
    const clientMap = new Map(clientsResult.data?.map(c => [c.id, c]) || []);
    const artistMap = new Map(artistsResult.data?.map(a => [a.id, a]) || []);
    const artistUserMap = new Map(artistUsers?.map(u => [u.id, u]) || []);
    const artworkMap = new Map(artworksResult.data?.map(a => [a.id, a]) || []);

    // Debug logging
    console.log('Commissions data enrichment:');
    console.log(`- Found ${commissions.length} commissions`);
    console.log(`- Found ${clientsResult.data?.length || 0} clients`);
    console.log(`- Found ${artistsResult.data?.length || 0} artists`);
    console.log(`- Found ${artistUsers?.length || 0} artist users`);
    console.log(`- Commission artist IDs:`, artistIds);
    console.log(`- Artist IDs found in DB:`, artistsResult.data?.map(a => a.id) || []);
    console.log(`- Artist user IDs to fetch:`, artistUserIds);
    console.log(`- Artist map keys:`, Array.from(artistMap.keys()));
    
    if (commissions.length > 0) {
      commissions.forEach((comm, idx) => {
        if (idx < 3) { // Log first 3 commissions
          const artist = artistMap.get(comm.artist_id);
          // commission.artist_id is the user_id, so look it up directly
          const artistUser = artistUserMap.get(comm.artist_id);
          console.log(`Commission ${idx + 1} (${comm.id}):`);
          console.log(`  - artist_id: ${comm.artist_id}`);
          console.log(`  - artist found: ${!!artist}`);
          console.log(`  - artist object:`, artist);
          console.log(`  - artist.user_id: ${artist?.user_id}`);
          console.log(`  - artistUser found: ${!!artistUser}`);
        }
      });
    }

    // Enrich commissions with pre-fetched data (no additional queries)
    const enrichedCommissions = commissions.map((commission) => {
      const client = clientMap.get(commission.client_id);
      const artist = artistMap.get(commission.artist_id);
      // commission.artist_id IS the user_id, so look it up directly
      const artistUser = artistUserMap.get(commission.artist_id);
      const artwork = commission.artwork_id ? artworkMap.get(commission.artwork_id) : null;

      // Debug missing data
      if (!client && commission.client_id) {
        console.warn(`Missing client data for commission ${commission.id}, client_id: ${commission.client_id}`);
      }
      if (!artist && commission.artist_id) {
        console.warn(`Missing artist data for commission ${commission.id}, artist_id: ${commission.artist_id}`);
      }
      if (!artistUser && commission.artist_id) {
        console.warn(`Missing artist user data for commission ${commission.id}, artist_id (user_id): ${commission.artist_id}, artistUserMap keys:`, Array.from(artistUserMap.keys()));
      }

      return {
        ...commission,
        client,
        artist: artist ? {
          ...artist,
          users: artistUser || null
        } : null,
        artwork: artwork || null
      };
    });

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
    // commission.artist_id IS the user_id (not the artists table ID)
    const isArtist = String(commission.artist_id) === String(req.user.id);
    const isClient = String(commission.client_id) === String(req.user.id);

    if (!isArtist && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Artists can accept/reject/complete, clients can cancel
    if (isClient && status !== 'cancelled') {
      return res.status(403).json({ error: 'Clients can only cancel commissions' });
    }

    // Handle declined commissions - delete commission and conversation
    if (status === 'declined') {
      // Get conversation for this commission
      const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('commission_id', req.params.id)
        .single();

      // Delete all messages in the conversation
      if (conversation) {
        await supabaseAdmin
          .from('messages')
          .delete()
          .eq('conversation_id', conversation.id);

        // Delete conversation participants
        await supabaseAdmin
          .from('conversation_participants')
          .delete()
          .eq('conversation_id', conversation.id);

        // Delete conversation
        await supabaseAdmin
          .from('conversations')
          .delete()
          .eq('id', conversation.id);
      }

      // Delete the commission
      await supabaseAdmin
        .from('commissions')
        .delete()
        .eq('id', req.params.id);

      return res.json({ message: 'Commission declined and deleted' });
    }

    // Change "accepted" to "in_progress" to prevent multiple accepts
    const finalStatus = status === 'accepted' ? 'in_progress' : status;

    // Prepare update data
    const updates = {
      status: finalStatus,
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

    // Get user info for notifications
    const { data: artistInfo } = await supabaseAdmin
      .from('users')
      .select('username, full_name')
      .eq('id', commission.artist_id)
      .single();

    const { data: clientInfo } = await supabaseAdmin
      .from('users')
      .select('username, full_name')
      .eq('id', commission.client_id)
      .single();

    // Send notifications based on status
    if (finalStatus === 'in_progress' && isArtist) {
      // Commission accepted - notify client
      await NotificationService.publish(commission.client_id, {
        type: 'commission_accepted',
        title: 'Commission Accepted! 🎨',
        message: `${artistInfo?.username || 'An artist'} has accepted your commission request`,
        action: { type: 'view_commission', id: req.params.id },
        priority: 'high',
      });
    } else if (status === 'declined' && isArtist) {
      // Commission declined - notify client
      await NotificationService.publish(commission.client_id, {
        type: 'commission_declined',
        title: 'Commission Declined',
        message: `${artistInfo?.username || 'An artist'} has declined your commission request`,
        action: { type: 'view_commissions' },
        priority: 'normal',
      });
    } else if (finalStatus === 'completed' && isArtist) {
      // Commission completed - notify client
      await NotificationService.publish(commission.client_id, {
        type: 'commission_completed',
        title: 'Commission Completed! ✨',
        message: `Your commission from ${artistInfo?.username || 'an artist'} has been completed`,
        action: { type: 'view_commission', id: req.params.id },
        priority: 'high',
      });
    } else if (finalStatus === 'cancelled' && isClient) {
      // Commission cancelled - notify artist
      await NotificationService.publish(commission.artist_id, {
        type: 'commission_cancelled',
        title: 'Commission Cancelled',
        message: `${clientInfo?.username || 'A client'} has cancelled their commission request`,
        action: { type: 'view_commission', id: req.params.id },
        priority: 'normal',
      });
    }

    // Only send status update message if skip_message is not true
    if (!req.body.skip_message) {
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
          content: `Commission status updated to: ${finalStatus}`,
          metadata: { status: finalStatus, commission_id: req.params.id }
        });
      }
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
