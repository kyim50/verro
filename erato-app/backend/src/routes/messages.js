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
            sender:users!messages_sender_id_fkey(id, username, avatar_url)
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
        sender:users!messages_sender_id_fkey(id, username, full_name, avatar_url)
      `)
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: msgError } = await query;

    if (msgError) throw msgError;

    // Update last_read_at
    await supabaseAdmin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
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
        sender:users!messages_sender_id_fkey(id, username, full_name, avatar_url)
      `)
      .single();

    if (msgError) throw msgError;

    // Update conversation updated_at
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new conversation (direct message, not commission-related)
router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { participant_id } = req.body;

    if (!participant_id) {
      return res.status(400).json({ error: 'participant_id is required' });
    }

    if (participant_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }

    // Check if conversation already exists between these users
    const { data: existingParticipations } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    if (existingParticipations && existingParticipations.length > 0) {
      const conversationIds = existingParticipations.map(p => p.conversation_id);

      const { data: otherUserParticipations } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', participant_id)
        .in('conversation_id', conversationIds);

      if (otherUserParticipations && otherUserParticipations.length > 0) {
        // Conversation exists
        const existingConvId = otherUserParticipations[0].conversation_id;
        const { data: existingConv } = await supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', existingConvId)
          .single();

        return res.json({ conversation: existingConv, existed: true });
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
    const participants = [
      { conversation_id: conversation.id, user_id: req.user.id },
      { conversation_id: conversation.id, user_id: participant_id }
    ];

    await supabaseAdmin.from('conversation_participants').insert(participants);

    res.status(201).json({ conversation, existed: false });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
