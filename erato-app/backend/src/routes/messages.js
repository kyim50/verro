import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all conversations for user
router.get('/conversations', authenticate, async (req, res) => {
  try {
    // Get conversations where user is a participant
    const { data: participations, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', req.user.id);

    if (partError) throw partError;

    if (!participations || participations.length === 0) {
      return res.json({ conversations: [] });
    }

    const conversationIds = participations.map(p => p.conversation_id);

    // Get conversation details with latest message
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        commission_id,
        created_at,
        updated_at,
        commissions(
          id,
          status,
          client_id,
          artist_id,
          details,
          artwork:artworks(id, title, thumbnail_url, image_url)
        )
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (convError) throw convError;

    // Get latest message for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const { data: latestMessage } = await supabaseAdmin
          .from('messages')
          .select(`
            id,
            content,
            message_type,
            created_at,
            sender_id
          `)
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get other participant info
        const { data: otherParticipant } = await supabaseAdmin
          .from('conversation_participants')
          .select(`
            user:users(id, username, full_name, avatar_url)
          `)
          .eq('conversation_id', conv.id)
          .neq('user_id', req.user.id)
          .single();

        // Count unread messages
        const userParticipation = participations.find(p => p.conversation_id === conv.id);
        const { count: unreadCount } = await supabaseAdmin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', req.user.id)
          .gt('created_at', userParticipation.last_read_at || conv.created_at);

        return {
          ...conv,
          latest_message: latestMessage,
          other_participant: otherParticipant?.user,
          unread_count: unreadCount || 0
        };
      })
    );

    res.json({ conversations: conversationsWithMessages });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create or get conversation with participant(s)
router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { participant_id, participant_ids } = req.body;

    // Support both single participant_id and array of participant_ids
    let participants;
    if (participant_id) {
      participants = [participant_id];
    } else if (participant_ids && Array.isArray(participant_ids)) {
      participants = participant_ids;
    } else {
      return res.status(400).json({ error: 'participant_id or participant_ids is required' });
    }

    if (participants.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required' });
    }

    // Check if trying to message yourself
    if (participants.includes(req.user.id)) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }

    // Check if current user is a client (not an artist)
    const { data: currentUserIsArtist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', req.user.id)
      .maybeSingle();

    // If current user is NOT an artist (i.e., they are a client)
    if (!currentUserIsArtist) {
      // Check if any of the participants are artists
      const { data: targetArtists } = await supabaseAdmin
        .from('artists')
        .select('id')
        .in('id', participants);

      // If messaging an artist as a client, check for in_progress commission
      if (targetArtists && targetArtists.length > 0) {
        // Check if there's an in_progress or completed commission with this artist
        const { data: activeCommission } = await supabaseAdmin
          .from('commissions')
          .select('id')
          .eq('client_id', req.user.id)
          .in('artist_id', participants)
          .in('status', ['in_progress', 'completed'])
          .maybeSingle();

        if (!activeCommission) {
          return res.status(403).json({
            error: 'You must have an accepted commission with this artist before you can message them. Please request a commission first.'
          });
        }
      }
    }

    const allParticipants = [req.user.id, ...participants].sort();

    // Find existing conversation with exactly these participants
    // First, get all conversations the current user is in
    const { data: userConversations } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    if (userConversations && userConversations.length > 0) {
      const conversationIds = userConversations.map(p => p.conversation_id);

      // For each conversation, get all participants
      for (const convId of conversationIds) {
        const { data: convParticipants } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', convId)
          .order('user_id');

        if (convParticipants) {
          const participantIds = convParticipants.map(p => p.user_id).sort();

          // Check if this conversation has exactly the same participants
          if (JSON.stringify(participantIds) === JSON.stringify(allParticipants)) {
            // Found existing conversation
            const { data: conversation } = await supabaseAdmin
              .from('conversations')
              .select('*')
              .eq('id', convId)
              .single();

            return res.json({ conversation, existed: true });
          }
        }
      }
    }

    // Create new conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError) throw convError;

    // Add participants
    const participantInserts = allParticipants.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId,
      last_read_at: new Date().toISOString()
    }));

    const { error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .insert(participantInserts);

    if (partError) throw partError;

    res.status(201).json({ conversation, existed: false });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get conversation details
router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { data: participation, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (partError || !participation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { data: participants, error: partsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id, users(id, username, full_name, avatar_url, is_online, last_seen)')
      .eq('conversation_id', req.params.id);

    if (partsError) throw partsError;

    const participantsList = participants.map(p => p.users);

    res.json({ id: req.params.id, participants: participantsList });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark conversation as read
router.post('/conversations/:id/read', authenticate, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: error.message });
  }
});
// Get messages in a conversation
router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;

    // Verify user is part of conversation
    const { data: participation, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (partError || !participation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender_id
      `)
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: msgError } = await query;

    if (msgError) throw msgError;

    // Update last_read_at and reset unread_count
    await supabaseAdmin
      .from('conversation_participants')
      .update({
        last_read_at: new Date().toISOString(),
        unread_count: 0
      })
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id);

    res.json({ messages: messages.reverse() }); // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send a message
router.post('/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const { content, message_type = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Verify user is part of conversation
    const { data: participation, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (partError || !participation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: req.params.id,
        sender_id: req.user.id,
        content,
        message_type
      })
      .select(`
        *,
        sender_id
      `)
      .single();

    if (msgError) throw msgError;

    // Update conversation updated_at
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    // Increment unread_count for all other participants
    const { data: otherParticipants } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id, unread_count')
      .eq('conversation_id', req.params.id)
      .neq('user_id', req.user.id);

    if (otherParticipants && otherParticipants.length > 0) {
      for (const participant of otherParticipants) {
        await supabaseAdmin
          .from('conversation_participants')
          .update({ unread_count: (participant.unread_count || 0) + 1 })
          .eq('conversation_id', req.params.id)
          .eq('user_id', participant.user_id);
      }
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a message
router.delete('/conversations/:id/messages/:messageId', authenticate, async (req, res) => {
  try {
    // Verify user is part of conversation
    const { data: participation, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (partError || !participation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify message belongs to this conversation and to current user
    const { data: message, error: msgFetchError } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', req.params.messageId)
      .eq('conversation_id', req.params.id)
      .single();

    if (msgFetchError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete another user\'s message' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('id', req.params.messageId)
      .eq('conversation_id', req.params.id);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
