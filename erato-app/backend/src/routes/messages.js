import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { MessageCountService, NotificationService } from '../utils/redisServices.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

const router = express.Router();

// Get all conversations for user
router.get('/conversations', authenticate, async (req, res) => {
  try {
    // Try cache first (2 minute TTL - conversations change frequently)
    const { cache, cacheKeys } = await import('../utils/cache.js');
    const cacheKey = `conversations:${req.user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get conversations where user is a participant
    const { data: participations, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', req.user.id);

    if (partError) throw partError;

    if (!participations || participations.length === 0) {
      const emptyResponse = { conversations: [] };
      await cache.set(cacheKey, emptyResponse, 120); // Cache empty for 2 minutes
      return res.json(emptyResponse);
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

    // OPTIMIZED: Get latest message for each conversation using a subquery approach
    // Query all messages for these conversations, ordered by created_at DESC
    // Then group in memory (faster than multiple queries)
    const { data: allMessages } = await supabaseAdmin
      .from('messages')
      .select('id, content, message_type, created_at, sender_id, conversation_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(conversationIds.length * 2); // Limit to reduce data transfer
    
    // Group by conversation and get latest for each (most recent first in results)
    const latestMessagesMap = new Map();
    allMessages?.forEach(msg => {
      if (!latestMessagesMap.has(msg.conversation_id)) {
        latestMessagesMap.set(msg.conversation_id, msg);
      }
    });

    // OPTIMIZED: Get all other participants in a single query
    const { data: allParticipants } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id, user:users(id, username, full_name, avatar_url)')
      .in('conversation_id', conversationIds)
      .neq('user_id', req.user.id);
    
    // Group by conversation
    const otherParticipantsMap = new Map();
    allParticipants?.forEach(p => {
      if (!otherParticipantsMap.has(p.conversation_id)) {
        otherParticipantsMap.set(p.conversation_id, p.user);
      }
    });

    // Get unread counts from Redis (batch) with fallback to database - OPTIMIZED
    // Reuse conversationIds from above (already declared on line 23)
    const redisCounts = await MessageCountService.getBatchUnreadCounts(req.user.id, conversationIds);
    
    const unreadCountMap = new Map();
    const dbFallbacks = [];
    
    // Process Redis results and identify which need database fallback
    conversations.forEach((conv) => {
      const redisCount = redisCounts.get(conv.id) || 0;
      if (redisCount > 0) {
        unreadCountMap.set(conv.id, redisCount);
      } else {
        // Queue for database lookup
        const userParticipation = participations.find(p => p.conversation_id === conv.id);
        dbFallbacks.push({ 
          convId: conv.id, 
          lastReadAt: userParticipation?.last_read_at || conv.created_at 
        });
      }
    });
    
    // Batch all database fallback queries in parallel (only for missing counts)
    if (dbFallbacks.length > 0) {
      const dbCounts = await Promise.all(
        dbFallbacks.map(async ({ convId, lastReadAt }) => {
          const { count } = await supabaseAdmin
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', convId)
            .neq('sender_id', req.user.id)
            .gt('created_at', lastReadAt);
          return { convId, count: count || 0 };
        })
      );
      
      dbCounts.forEach(({ convId, count }) => {
        unreadCountMap.set(convId, count);
      });
    }

    // Combine all data
    const conversationsWithMessages = conversations.map(conv => ({
      ...conv,
      latest_message: latestMessagesMap.get(conv.id) || null,
      other_participant: otherParticipantsMap.get(conv.id) || null,
      unread_count: unreadCountMap.get(conv.id) || 0
    }));

    const response = { conversations: conversationsWithMessages };
    
    // Cache response for 2 minutes
    await cache.set(cacheKey, response, 120);
    
    res.json(response);
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

    const allParticipants = [req.user.id, ...participants].sort();

    // Find existing conversation with exactly these participants
    // First, get all conversations the current user is in
    const { data: userConversations } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', req.user.id);

    let existingConversation = null;
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

            existingConversation = conversation;
            break;
          }
        }
      }
    }

    // If existing conversation found, return it
    if (existingConversation) {
      return res.json({ conversation: existingConversation, existed: true });
    }

    // If current user is NOT an artist (i.e., they are a client) and no existing conversation
    if (!currentUserIsArtist) {
      // Check if any of the participants are artists
      const { data: targetArtists } = await supabaseAdmin
        .from('artists')
        .select('id')
        .in('id', participants);

      // If messaging an artist as a client, require existing conversation
      if (targetArtists && targetArtists.length > 0) {
        return res.status(403).json({
          error: 'You can only message artists you\'ve chatted with before. Please start a conversation through an existing commission or previous conversation.'
        });
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

    // Reset Redis unread count
    await MessageCountService.resetUnreadCount(req.user.id, req.params.id);

    // Invalidate conversations cache for this user
    const { cache } = await import('../utils/cache.js');
    await cache.del(`conversations:${req.user.id}`);

    res.json({ messages: messages.reverse() }); // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send a message
router.post('/conversations/:id/messages', authenticate, async (req, res) => {
  try {
    const { content, message_type = 'text', image_url } = req.body;

    // For image messages, image_url is required; for text messages, content is required
    if (message_type === 'image' && !image_url) {
      return res.status(400).json({ error: 'image_url is required for image messages' });
    }
    if (message_type === 'text' && !content) {
      return res.status(400).json({ error: 'content is required for text messages' });
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
    const messageData = {
      conversation_id: req.params.id,
      sender_id: req.user.id,
      message_type
    };
    
    if (message_type === 'image' && image_url) {
      messageData.image_url = image_url;
      messageData.content = ''; // Empty string for image messages (content column is NOT NULL)
    } else {
      messageData.content = content;
      messageData.image_url = null;
    }

    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert(messageData)
      .select(`
        *,
        sender_id
      `)
      .single();

    if (msgError) throw msgError;

    // IMPORTANT: Emit via Socket.io IMMEDIATELY for real-time delivery
    const io = req.app.locals.io;
    if (io) {
      io.to(`conversation-${req.params.id}`).emit('new-message', message);
    }

    // Return response immediately (optimistic response)
    res.status(201).json(message);

    // Handle heavy operations asynchronously (don't block response)
    (async () => {
      try {
        // Update conversation updated_at
        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', req.params.id);

        // Invalidate conversations cache for all participants
        const { cache } = await import('../utils/cache.js');
        const { data: allParticipants } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', req.params.id);
        
        if (allParticipants) {
          await Promise.all(
            allParticipants.map(p => cache.del(`conversations:${p.user_id}`))
          );
        }

        // Get other participants (for notifications)
        const { data: otherParticipants } = await supabaseAdmin
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', req.params.id)
          .neq('user_id', req.user.id);

        // Get sender info for notifications
        const { data: senderInfo } = await supabaseAdmin
          .from('users')
          .select('username, full_name, avatar_url')
          .eq('id', req.user.id)
          .single();

        if (otherParticipants && otherParticipants.length > 0) {
          for (const participant of otherParticipants) {
            // Get current unread count and increment
            const { data: current } = await supabaseAdmin
              .from('conversation_participants')
              .select('unread_count')
              .eq('conversation_id', req.params.id)
              .eq('user_id', participant.user_id)
              .single();
            
            // Update database unread count
            await supabaseAdmin
              .from('conversation_participants')
              .update({ unread_count: (current?.unread_count || 0) + 1 })
              .eq('conversation_id', req.params.id)
              .eq('user_id', participant.user_id);

            // Update Redis unread count (for instant access)
            await MessageCountService.updateUnreadCount(participant.user_id, req.params.id, 1);

            // Send notification
            const notificationMessage = message_type === 'image' 
              ? 'Sent an image'
              : (content || '').substring(0, 100) + ((content || '').length > 100 ? '...' : '');
            
            await NotificationService.publish(participant.user_id, {
              type: 'new_message',
              title: `New message from ${senderInfo?.username || 'Someone'}`,
              message: notificationMessage,
              action: { type: 'view_conversation', id: req.params.id },
              priority: 'normal',
            });

            // Push notification (foreground/background)
            await sendPushToUser(participant.user_id, {
              title: `New message from ${senderInfo?.username || 'Someone'}`,
              body: notificationMessage || 'New message',
              data: { type: 'message', conversationId: req.params.id },
            });
          }
        }
      } catch (error) {
        console.error('Error in async message processing:', error);
      }
    })();
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a conversation
router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Verify user is part of conversation
    const { data: participation, error: partError } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (partError || !participation) {
      console.error('Conversation deletion authorization error:', partError);
      console.error('Conversation ID:', conversationId, 'User ID:', req.user.id);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove user from conversation participants (don't delete conversation if it has a commission)
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('commission_id')
      .eq('id', conversationId)
      .maybeSingle();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      return res.status(500).json({ error: 'Failed to fetch conversation' });
    }

    if (conversation?.commission_id) {
      // Conversation has a commission - just remove user from participants
      const { error: deleteError } = await supabaseAdmin
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', req.user.id);

      if (deleteError) throw deleteError;
    } else {
      // No commission - can safely delete the conversation and all its messages
      // First delete messages
      await supabaseAdmin
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Then delete participants
      await supabaseAdmin
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      // Finally delete the conversation
      const { error: deleteError } = await supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (deleteError) throw deleteError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
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
