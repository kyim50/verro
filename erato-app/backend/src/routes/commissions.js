import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { NotificationService } from '../utils/redisServices.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

const router = express.Router();

// Request a commission
router.post('/request', authenticate, async (req, res) => {
  try {
    const {
      artist_id,
      artwork_id,
      details,
      client_note,
      budget,
      deadline,
      package_id: packageId,
      selected_addons: selectedAddons = [],
      reference_images: referenceImages = []
    } = req.body;

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

    // Slots / queue guard
    const { data: queueStatus, error: queueError } = await supabaseAdmin
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artist_id)
      .in('status', ['pending', 'accepted', 'in_progress']);

    if (queueError) throw queueError;

    const { data: settings } = await supabaseAdmin
      .from('artist_commission_settings')
      .select('max_queue_slots, allow_waitlist, is_open')
      .eq('artist_id', artist_id)
      .maybeSingle();

    const maxSlots = settings?.max_queue_slots ?? 5;
    const allowWaitlist = settings?.allow_waitlist ?? false;
    const isOpen = settings?.is_open ?? true;
    const currentCount = queueStatus || 0;
    const isFull = currentCount >= maxSlots;

    if (!isOpen) {
      return res.status(400).json({ error: 'Commissions are closed' });
    }

    if (isFull && !allowWaitlist) {
      return res.status(400).json({ error: 'Commission slots are full' });
    }

    // Validate package selection (if provided)
    let selectedPackage = null;
    if (packageId) {
      const { data: pkg, error: packageError } = await supabaseAdmin
        .from('commission_packages')
        .select('id, artist_id, is_active, base_price, name, estimated_delivery_days, revision_count')
        .eq('id', packageId)
        .maybeSingle();

      if (packageError || !pkg) {
        return res.status(404).json({ error: 'Selected package not found' });
      }

      if (pkg.artist_id !== artist_id) {
        return res.status(400).json({ error: 'Package does not belong to this artist' });
      }

      if (!pkg.is_active) {
        return res.status(400).json({ error: 'This package is currently hidden' });
      }

      selectedPackage = pkg;
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
        status: 'pending',
        package_id: selectedPackage?.id || null,
        selected_addons: Array.isArray(selectedAddons) ? selectedAddons : [],
        final_price: selectedPackage?.base_price || null
      })
      .select()
      .single();

    if (commissionError) throw commissionError;

    // Add reference images to commission files
    if (referenceImages && referenceImages.length > 0) {
      const fileInserts = referenceImages.map(imageUrl => ({
        commission_id: commission.id,
        uploader_id: req.user.id,
        file_url: imageUrl,
        file_name: `Reference - ${imageUrl.split('/').pop()}`,
        file_type: 'image'
      }));

      const { error: filesError } = await supabaseAdmin
        .from('commission_files')
        .insert(fileInserts);

      if (filesError) {
        console.error('Error adding reference images to commission:', filesError);
      }
    }

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
    const { data: initialMessage } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: req.user.id,
      message_type: 'commission_request',
      content: details,
      metadata: {
        commission_id: commission.id,
        artwork_id: artwork_id || null,
        title: client_note || null,
        budget: budget || null,
        deadline: deadline || null,
        package: selectedPackage
          ? {
              id: selectedPackage.id,
              name: selectedPackage.name,
              base_price: selectedPackage.base_price,
              estimated_delivery_days: selectedPackage.estimated_delivery_days,
              revision_count: selectedPackage.revision_count
            }
          : null,
        selected_addons: Array.isArray(selectedAddons) ? selectedAddons : []
      }
    }).select().single();

    // Emit Socket.io event for real-time update
    const io = req.app.locals.io;
    if (io && initialMessage) {
      io.to(conversation.id).emit('new-message', {
        ...initialMessage,
        created_at: new Date().toISOString()
      });
    }

    res.status(201).json({
      commission,
      conversation
    });

    // Fire-and-forget push to artist (new commission)
    (async () => {
      try {
        const { data: clientInfo } = await supabaseAdmin
          .from('users')
          .select('username, full_name')
          .eq('id', req.user.id)
          .single();

        const title = 'New commission request';
        const message = `${clientInfo?.username || 'A client'} sent you a commission request`;

        await sendPushToUser(artist_id, {
          title,
          body: message,
          data: { type: 'commission', commissionId: commission.id },
        });
      } catch (error) {
        console.error('Push error on commission request:', error?.message || error);
      }
    })();
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
    const packageIds = [...new Set(commissions.map(c => c.package_id).filter(Boolean))];
    const { data: packages } = packageIds.length > 0
      ? await supabaseAdmin
          .from('commission_packages')
          .select('id, name, base_price, estimated_delivery_days, revision_count')
          .in('id', packageIds)
      : { data: [] };
    const packageMap = new Map(packages?.map(p => [p.id, p]) || []);

    // Debug logging
    console.log('Commissions data enrichment:');
    console.log(`- Found ${commissions.length} commissions`);
    console.log(`- Found ${clientsResult.data?.length || 0} clients`);
    console.log(`- Found ${artistsResult.data?.length || 0} artists`);
    console.log(`- Found ${artistUsers?.length || 0} artist users`);
    console.log(`- Commission artist IDs (user_ids):`, artistIds);
    console.log(`- Artist IDs found in DB:`, artistsResult.data?.map(a => a.id) || []);
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
        artwork: artwork || null,
        package: commission.package_id ? packageMap.get(commission.package_id) || null : null
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
        artwork:artworks(id, title, thumbnail_url, image_url),
        package:commission_packages(id, name, base_price, estimated_delivery_days, revision_count)
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

    // Fetch artist data - commission.artist_id is the user_id
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id, min_price, max_price, turnaround_days')
      .eq('id', commission.artist_id) // artist.id equals user_id
      .maybeSingle();

    // Fetch artist user data directly using commission.artist_id (which is user_id)
    const { data: artistUser } = await supabaseAdmin
      .from('users')
      .select('id, username, full_name, avatar_url, bio')
      .eq('id', commission.artist_id)
      .maybeSingle();

    const artistWithUser = artist ? {
      ...artist,
      users: artistUser || null
    } : null;

    res.json({
      ...commission,
      client: client || null,
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
      await sendPushToUser(commission.client_id, {
        title: 'Commission accepted',
        body: `${artistInfo?.username || 'An artist'} accepted your request`,
        data: { type: 'commission', commissionId: req.params.id },
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
      await sendPushToUser(commission.client_id, {
        title: 'Commission declined',
        body: `${artistInfo?.username || 'An artist'} declined your request`,
        data: { type: 'commissions' },
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
      await sendPushToUser(commission.client_id, {
        title: 'Commission completed',
        body: `Your commission from ${artistInfo?.username || 'an artist'} is done`,
        data: { type: 'commission', commissionId: req.params.id },
      });

      // Send review prompts to both artist and client
      await NotificationService.publish(commission.artist_id, {
        type: 'review_prompt',
        title: 'Leave a Review 🌟',
        message: `How was working with ${clientInfo?.username || 'the client'}? Leave a review!`,
        action: { type: 'review_commission', id: req.params.id, reviewType: 'artist_to_client' },
        priority: 'normal',
      });

      await NotificationService.publish(commission.client_id, {
        type: 'review_prompt',
        title: 'Leave a Review 🌟',
        message: `How was your experience with ${artistInfo?.username || 'the artist'}? Leave a review!`,
        action: { type: 'review_commission', id: req.params.id, reviewType: 'client_to_artist' },
        priority: 'normal',
      });

      // Create pending review records
      try {
        await supabaseAdmin.from('pending_reviews').insert([
          {
            commission_id: req.params.id,
            user_id: commission.artist_id,
            review_type: 'artist_to_client',
          },
          {
            commission_id: req.params.id,
            user_id: commission.client_id,
            review_type: 'client_to_artist',
          },
        ]);
      } catch (err) {
        console.error('Error creating pending reviews:', err);
        // Don't fail the request if pending reviews fail
      }
    } else if (finalStatus === 'cancelled' && isClient) {
      // Commission cancelled - notify artist
      await NotificationService.publish(commission.artist_id, {
        type: 'commission_cancelled',
        title: 'Commission Cancelled',
        message: `${clientInfo?.username || 'A client'} has cancelled their commission request`,
        action: { type: 'view_commission', id: req.params.id },
        priority: 'normal',
      });
      await sendPushToUser(commission.artist_id, {
        title: 'Commission cancelled',
        body: `${clientInfo?.username || 'A client'} cancelled their request`,
        data: { type: 'commission', commissionId: req.params.id },
      });
    }

    // Removed automatic status update messages - users can communicate manually

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

// Save artist note for commission (artist only)
router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

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
      return res.status(403).json({ error: 'Only the artist can add notes' });
    }

    // Update commission with artist note
    const { data: updated, error } = await supabaseAdmin
      .from('commissions')
      .update({
        artist_notes: note.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Note saved successfully', commission: updated });
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get artist note for commission (artist only)
router.get('/:id/notes', authenticate, async (req, res) => {
  try {
    // Get commission to verify artist
    const { data: commission } = await supabaseAdmin
      .from('commissions')
      .select('artist_id, artist_notes')
      .eq('id', req.params.id)
      .single();

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can view notes' });
    }

    res.json({ note: commission.artist_notes || '' });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== PROGRESS UPDATES ==========

// Create a progress update (WIP image, approval checkpoint, or revision request)
router.post('/:id/progress', authenticate, async (req, res) => {
  try {
    const { update_type, image_url, additional_images, notes, requires_approval, revision_notes, markup_data } = req.body;

    if (!['wip_image', 'approval_checkpoint', 'revision_request'].includes(update_type)) {
      return res.status(400).json({ error: 'Invalid update_type' });
    }

    // Get commission to verify access
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('artist_id, client_id, status, max_revision_count, current_revision_count')
      .eq('id', req.params.id)
      .single();

    if (commissionError) {
      console.error('Error fetching commission for progress upload:', commissionError);
      return res.status(500).json({ error: 'Failed to fetch commission', details: commissionError.message });
    }

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    const isArtist = String(commission.artist_id) === String(req.user.id);
    const isClient = String(commission.client_id) === String(req.user.id);

    console.log('Progress upload auth check:', {
      commissionId: req.params.id,
      userId: req.user.id,
      artistId: commission.artist_id,
      clientId: commission.client_id,
      isArtist,
      isClient
    });

    if (!isArtist && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validation based on update type
    if (update_type === 'wip_image' && !image_url) {
      return res.status(400).json({ error: 'image_url is required for WIP images' });
    }

    if (update_type === 'approval_checkpoint' && !image_url) {
      return res.status(400).json({ error: 'image_url is required for approval checkpoints' });
    }

    if (update_type === 'revision_request') {
      if (!isClient) {
        return res.status(403).json({ error: 'Only clients can request revisions' });
      }
      if (commission.current_revision_count >= (commission.max_revision_count || 2)) {
        return res.status(400).json({ error: 'Maximum revision count reached' });
      }
    }

    // Prepare progress update data
    const progressData = {
      commission_id: req.params.id,
      update_type,
      created_by: req.user.id,
      notes: notes || null,
    };

    if (image_url) {
      progressData.image_url = image_url;
    }

    // Handle additional images - store as additional_images array in metadata
    if (additional_images && Array.isArray(additional_images) && additional_images.length > 0) {
      progressData.metadata = {
        additional_images: additional_images
      };
    }

    if (update_type === 'approval_checkpoint') {
      progressData.requires_approval = requires_approval !== false; // Default to true
      progressData.approval_status = 'pending';
    }

    if (update_type === 'revision_request') {
      progressData.revision_number = (commission.current_revision_count || 0) + 1;
      progressData.revision_notes = revision_notes || null;
      if (markup_data) {
        progressData.markup_data = markup_data;
      }
    }

    // Create progress update
    const { data: progressUpdate, error: progressError } = await supabaseAdmin
      .from('commission_progress_updates')
      .insert(progressData)
      .select()
      .single();

    if (progressError) throw progressError;

    // Update commission revision count if this is a revision request
    if (update_type === 'revision_request') {
      await supabaseAdmin
        .from('commissions')
        .update({ 
          current_revision_count: progressData.revision_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id);
    }

    // Create a message in the conversation
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('commission_id', req.params.id)
      .single();

    if (conversation) {
      let messageContent = '';
      if (update_type === 'wip_image') {
        messageContent = '📸 Work in progress update';
      } else if (update_type === 'approval_checkpoint') {
        messageContent = '✅ Approval checkpoint - Please review';
      } else if (update_type === 'revision_request') {
        messageContent = `🔄 Revision request #${progressData.revision_number}`;
      }

      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: req.user.id,
        message_type: 'progress_update',
        content: messageContent,
        image_url: image_url || null,
        metadata: {
          progress_update_id: progressUpdate.id,
          update_type,
          commission_id: req.params.id
        }
      });

      // Emit socket event
      const io = req.app.locals.io;
      if (io) {
        io.to(conversation.id).emit('new-message', {
          conversation_id: conversation.id,
          sender_id: req.user.id,
          message_type: 'progress_update',
          content: messageContent,
          image_url: image_url || null,
          metadata: {
            progress_update_id: progressUpdate.id,
            update_type,
            commission_id: req.params.id
          },
          created_at: new Date().toISOString()
        });
      }
    }

    // Send notifications
    if (update_type === 'approval_checkpoint' && isArtist) {
      await NotificationService.publish(commission.client_id, {
        type: 'approval_requested',
        title: 'Approval Needed',
        message: 'The artist has requested your approval on a checkpoint',
        action: { type: 'view_commission', id: req.params.id },
        priority: 'high',
      });
    } else if (update_type === 'revision_request' && isClient) {
      await NotificationService.publish(commission.artist_id, {
        type: 'revision_requested',
        title: 'Revision Requested',
        message: `Revision #${progressData.revision_number} requested`,
        action: { type: 'view_commission', id: req.params.id },
        priority: 'high',
      });
    }

    res.json(progressUpdate);
  } catch (error) {
    console.error('Error creating progress update:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all progress updates for a commission
router.get('/:id/progress', authenticate, async (req, res) => {
  try {
    // Get commission to verify access
    const { data: commission } = await supabaseAdmin
      .from('commissions')
      .select('artist_id, client_id')
      .eq('id', req.params.id)
      .single();

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    const isArtist = String(commission.artist_id) === String(req.user.id);
    const isClient = String(commission.client_id) === String(req.user.id);

    if (!isArtist && !isClient) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: progressUpdates, error } = await supabaseAdmin
      .from('commission_progress_updates')
      .select(`
        *,
        created_by_user:users!commission_progress_updates_created_by_fkey(id, username, full_name, avatar_url)
      `)
      .eq('commission_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Format progress updates to include images array
    const formattedUpdates = (progressUpdates || []).map(update => {
      // Convert image_url to images array format
      let images = [];
      if (update.images && Array.isArray(update.images)) {
        images = update.images;
      } else if (update.image_url) {
        images = [update.image_url];
      }
      
      return {
        ...update,
        images: images,
        note: update.note || update.notes || null,
      };
    });

    res.json({ updates: formattedUpdates, progress_updates: formattedUpdates });
  } catch (error) {
    console.error('Error fetching progress updates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve or reject an approval checkpoint
router.patch('/:id/progress/:progressId/approve', authenticate, async (req, res) => {
  try {
    const { approval_status, approval_notes } = req.body;

    if (!['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval_status' });
    }

    // Get progress update
    const { data: progressUpdate, error: progressError } = await supabaseAdmin
      .from('commission_progress_updates')
      .select('*, commission:commissions!inner(artist_id, client_id)')
      .eq('id', req.params.progressId)
      .eq('commission_id', req.params.id)
      .single();

    if (progressError || !progressUpdate) {
      return res.status(404).json({ error: 'Progress update not found' });
    }

    if (progressUpdate.update_type !== 'approval_checkpoint') {
      return res.status(400).json({ error: 'This is not an approval checkpoint' });
    }

    const commission = progressUpdate.commission;
    const isClient = String(commission.client_id) === String(req.user.id);

    if (!isClient) {
      return res.status(403).json({ error: 'Only the client can approve/reject checkpoints' });
    }

    if (progressUpdate.approval_status !== 'pending') {
      return res.status(400).json({ error: 'This checkpoint has already been reviewed' });
    }

    // Update approval status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('commission_progress_updates')
      .update({
        approval_status,
        approval_notes: approval_notes || null,
        approved_at: new Date().toISOString(),
        approved_by: req.user.id
      })
      .eq('id', req.params.progressId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create a message in the conversation
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('commission_id', req.params.id)
      .single();

    if (conversation) {
      const messageContent = approval_status === 'approved' 
        ? '✅ Checkpoint approved'
        : '❌ Checkpoint rejected';

      await supabaseAdmin.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: req.user.id,
        message_type: 'progress_update',
        content: messageContent,
        metadata: {
          progress_update_id: updated.id,
          update_type: 'approval_response',
          approval_status,
          commission_id: req.params.id
        }
      });

      // Emit socket event
      const io = req.app.locals.io;
      if (io) {
        io.to(conversation.id).emit('new-message', {
          conversation_id: conversation.id,
          sender_id: req.user.id,
          message_type: 'progress_update',
          content: messageContent,
          metadata: {
            progress_update_id: updated.id,
            update_type: 'approval_response',
            approval_status,
            commission_id: req.params.id
          },
          created_at: new Date().toISOString()
        });
      }
    }

    // Send notification to artist
    await NotificationService.publish(commission.artist_id, {
      type: approval_status === 'approved' ? 'checkpoint_approved' : 'checkpoint_rejected',
      title: approval_status === 'approved' ? 'Checkpoint Approved' : 'Checkpoint Rejected',
      message: `Your checkpoint has been ${approval_status}`,
      action: { type: 'view_commission', id: req.params.id },
      priority: 'high',
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating approval status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get commission files (including reference images)
router.get('/:id/files', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the commission to verify access
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, client_id, artist_id')
      .eq('id', id)
      .single();

    if (commissionError || !commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    // Verify user is either client or artist
    if (commission.client_id !== req.user.id && commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all files for this commission
    const { data: files, error: filesError } = await supabaseAdmin
      .from('commission_files')
      .select('*')
      .eq('commission_id', id)
      .order('created_at', { ascending: true });

    if (filesError) throw filesError;

    res.json({ files: files || [] });
  } catch (error) {
    console.error('Error fetching commission files:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
