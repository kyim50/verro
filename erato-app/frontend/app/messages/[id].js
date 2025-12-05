import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuthStore();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [commission, setCommission] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (id && token) {
      fetchMessages();
      fetchConversationDetails();
    }
  }, [id, token]);

  const fetchConversationDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const otherParticipant = response.data.participants?.find(p => p.id !== user?.id);
      setOtherUser(otherParticipant);
      // Get commission details if this conversation has one
      if (response.data.commission_id) {
        const commissionResponse = await axios.get(
          `${API_URL}/commissions/${response.data.commission_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCommission(commissionResponse.data);
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await axios.post(
        `${API_URL}/messages/conversations/${id}/messages`,
        { content: messageContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages(prev => [...prev, response.data]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  const handleCommissionResponse = async (commissionId, status, response) => {
    try {
      await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status, artist_response: response },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh messages and commission details to update UI
      fetchMessages();
      fetchConversationDetails();
    } catch (error) {
      console.error('Error responding to commission:', error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const isUserOnline = (user) => {
    if (!user) return false;
    if (user.is_online) return true;

    if (user.last_seen) {
      const lastSeen = new Date(user.last_seen);
      const now = new Date();
      const diffMinutes = (now - lastSeen) / 1000 / 60;
      return diffMinutes < 5;
    }
    return false;
  };

  const renderCommissionRequest = (item) => {
    const metadata = item.metadata || {};
    // The sender is the client, so if current user is NOT the sender, they are the artist
    const isArtist = user?.id !== item.sender_id;
    // Only show buttons if commission status is 'pending'
    const showButtons = isArtist && commission && commission.status === 'pending';

    return (
      <View style={[styles.commissionCard, isArtist && styles.commissionCardReceived]}>
        <View style={styles.commissionHeader}>
          <Ionicons name="briefcase" size={22} color={colors.primary} />
          <Text style={styles.commissionTitle}>Commission Request</Text>
        </View>

        {metadata.title && (
          <Text style={styles.commissionRequestTitle}>{metadata.title}</Text>
        )}

        <View style={styles.commissionDetailsSection}>
          <Text style={styles.commissionDetailsLabel}>Description</Text>
          <Text style={styles.commissionDetails}>{item.content}</Text>
        </View>

        <View style={styles.commissionMetadata}>
          {metadata.budget && (
            <View style={styles.metadataItem}>
              <Ionicons name="cash-outline" size={18} color={colors.primary} />
              <View style={styles.metadataTextContainer}>
                <Text style={styles.metadataLabel}>Budget</Text>
                <Text style={styles.metadataValue}>${metadata.budget}</Text>
              </View>
            </View>
          )}
          {metadata.deadline && (
            <View style={styles.metadataItem}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <View style={styles.metadataTextContainer}>
                <Text style={styles.metadataLabel}>Deadline</Text>
                <Text style={styles.metadataValue}>{metadata.deadline}</Text>
              </View>
            </View>
          )}
        </View>

        {showButtons && (
          <View style={styles.commissionActions}>
            <TouchableOpacity
              style={[styles.commissionButton, styles.declineButton]}
              onPress={() => handleCommissionResponse(metadata.commission_id, 'declined', '')}
            >
              <Ionicons name="close-circle" size={22} color="#F44336" />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.commissionButton, styles.acceptButton]}
              onPress={() => handleCommissionResponse(metadata.commission_id, 'accepted', '')}
            >
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.commissionTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  const renderCommissionUpdate = (item) => {
    const metadata = item.metadata || {};

    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessageBubble}>
          <Ionicons name="information-circle" size={16} color={colors.text.secondary} />
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }) => {
    // Handle special message types
    if (item.message_type === 'commission_request') {
      return renderCommissionRequest(item);
    }

    if (item.message_type === 'commission_update') {
      return renderCommissionUpdate(item);
    }

    const isOwn = item.sender_id === user?.id;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showAvatar = !isOwn && (!prevMessage || prevMessage.sender_id !== item.sender_id);
    const showTime = !prevMessage ||
      prevMessage.sender_id !== item.sender_id ||
      (new Date(item.created_at) - new Date(prevMessage.created_at)) > 60000; // 1 minute

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {!isOwn && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              <Image
                source={{ uri: otherUser?.avatar_url || 'https://via.placeholder.com/28' }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
        )}

        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {item.content}
          </Text>
        </View>

        {showTime && (
          <Text style={[styles.time, isOwn && styles.timeOwn]}>
            {formatTime(item.created_at)}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => {
          if (otherUser?.id) {
            router.push(`/user/${otherUser.id}`);
          }
        }}>
          {otherUser && (
            <>
              <View style={styles.headerAvatarContainer}>
                <Image
                  source={{ uri: otherUser.avatar_url || 'https://via.placeholder.com/36' }}
                  style={styles.headerAvatar}
                  contentFit="cover"
                />
                {isUserOnline(otherUser) && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerName}>{otherUser.username}</Text>
                <Text style={styles.headerStatus}>
                  {isUserOnline(otherUser) ? 'Active now' : 'Offline'}
                </Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.headerActions} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.text.disabled} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Send a message to start chatting</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.inputActionButton}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Message..."
              placeholderTextColor={colors.text.disabled}
              multiline
              maxLength={1000}
            />
          </View>

          {newMessage.trim() && (
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border + '50',
    backgroundColor: colors.background,
  },
  backButton: {
    marginRight: spacing.xs,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  headerStatus: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 2,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 28,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarSpacer: {
    width: 28,
    height: 28,
  },
  bubble: {
    maxWidth: '70%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    marginBottom: 2,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.text.primary,
  },
  time: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
    marginLeft: spacing.xs,
    marginBottom: 4,
  },
  timeOwn: {
    marginRight: spacing.xs,
    marginLeft: 0,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  commissionCardReceived: {
    backgroundColor: colors.primary + '10',
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  commissionTitle: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 15,
  },
  commissionRequestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  commissionDetailsSection: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  commissionDetailsLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  commissionMetadata: {
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  metadataTextContainer: {
    flex: 1,
  },
  metadataLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  metadataValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  commissionActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#F44336',
  },
  declineButtonText: {
    ...typography.bodyBold,
    color: '#F44336',
    fontSize: 16,
    fontWeight: '700',
  },
  commissionTime: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  systemMessageText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  inputContainer: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border + '50',
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  inputActionButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});
