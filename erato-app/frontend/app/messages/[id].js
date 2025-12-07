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
  Modal,
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCommissionDetails, setSelectedCommissionDetails] = useState(null);
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

      console.log('Conversation data:', response.data);

      const otherParticipant = response.data.participants?.find(p => p.id !== user?.id);
      setOtherUser(otherParticipant);

      // Get commission details if this conversation has one
      if (response.data.commission_id) {
        console.log('Found commission_id in conversation:', response.data.commission_id);
        const commissionResponse = await axios.get(
          `${API_URL}/commissions/${response.data.commission_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Commission data:', commissionResponse.data);
        setCommission(commissionResponse.data);
      } else {
        console.log('No commission_id in conversation data');
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
      const msgs = response.data.messages || [];

      // Check for commission request in messages
      const commissionRequestMsg = msgs.find(m => m.message_type === 'commission_request');
      if (commissionRequestMsg) {
        console.log('Found commission request message:', commissionRequestMsg);
        console.log('Commission ID from metadata:', commissionRequestMsg.metadata?.commission_id);

        // If we have a commission_id in metadata but no commission loaded, fetch it
        if (commissionRequestMsg.metadata?.commission_id && !commission) {
          try {
            const commissionResponse = await axios.get(
              `${API_URL}/commissions/${commissionRequestMsg.metadata.commission_id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('Loaded commission from message metadata:', commissionResponse.data);
            setCommission(commissionResponse.data);
          } catch (err) {
            console.error('Error loading commission from message:', err);
          }
        }
      }

      setMessages(msgs);
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
    const isPending = commission && commission.status === 'pending';

    // Debug logging
    console.log('Commission Request Debug:', {
      currentUserId: user?.id,
      senderId: item.sender_id,
      isArtist,
      commission,
      commissionStatus: commission?.status,
      isPending,
      showButtons: isArtist && isPending
    });

    return (
      <View style={[styles.commissionCard, isArtist && styles.commissionCardReceived]}>
        <TouchableOpacity
          style={styles.commissionCardContent}
          onPress={() => {
            setSelectedCommissionDetails({
              title: metadata.title,
              description: item.content,
              budget: metadata.budget,
              deadline: metadata.deadline,
            });
            setShowDetailsModal(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.commissionHeader}>
            <View style={styles.commissionHeaderLeft}>
              <Ionicons name="briefcase" size={20} color={colors.primary} />
              <Text style={styles.commissionTitle}>Commission Request</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
          </View>

          {metadata.title && (
            <Text style={styles.commissionRequestTitle} numberOfLines={2}>
              {metadata.title}
            </Text>
          )}

          <View style={styles.commissionQuickInfo}>
            {metadata.budget && (
              <View style={styles.quickInfoChip}>
                <Ionicons name="cash-outline" size={14} color={colors.primary} />
                <Text style={styles.quickInfoText}>${metadata.budget}</Text>
              </View>
            )}
            {metadata.deadline && (
              <View style={styles.quickInfoChip}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={styles.quickInfoText}>{metadata.deadline}</Text>
              </View>
            )}
          </View>

          <Text style={styles.tapToViewText}>Tap to view details</Text>
        </TouchableOpacity>

        {isArtist && isPending && (
          <View style={styles.commissionActions}>
            <TouchableOpacity
              style={[styles.commissionButton, styles.declineButton]}
              onPress={() => handleCommissionResponse(metadata.commission_id, 'declined', '')}
            >
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.commissionButton, styles.acceptButton]}
              onPress={() => handleCommissionResponse(metadata.commission_id, 'accepted', '')}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
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
    <>
      {/* Commission Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Commission Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {selectedCommissionDetails && (
              <View style={styles.modalBody}>
                {selectedCommissionDetails.title && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>Title</Text>
                    <Text style={styles.modalSectionValue}>
                      {selectedCommissionDetails.title}
                    </Text>
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Description</Text>
                  <Text style={styles.modalSectionValue}>
                    {selectedCommissionDetails.description}
                  </Text>
                </View>

                {selectedCommissionDetails.budget && (
                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionHeader}>
                      <Ionicons name="cash-outline" size={20} color={colors.primary} />
                      <Text style={styles.modalSectionLabel}>Budget</Text>
                    </View>
                    <Text style={styles.modalSectionValue}>
                      ${selectedCommissionDetails.budget}
                    </Text>
                  </View>
                )}

                {selectedCommissionDetails.deadline && (
                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionHeader}>
                      <Ionicons name="time-outline" size={20} color={colors.primary} />
                      <Text style={styles.modalSectionLabel}>Deadline</Text>
                    </View>
                    <Text style={styles.modalSectionValue}>
                      {selectedCommissionDetails.deadline}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

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
    </>
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
    marginVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    maxWidth: '90%',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  commissionCardReceived: {
    backgroundColor: colors.primary + '10',
  },
  commissionCardContent: {
    padding: spacing.md,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  commissionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commissionTitle: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commissionRequestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  commissionQuickInfo: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  quickInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickInfoText: {
    ...typography.small,
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  tapToViewText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  commissionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
  },
  commissionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  acceptButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '700',
  },
  commissionTime: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
  },
  modalSection: {
    marginBottom: spacing.lg,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  modalSectionLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalSectionValue: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
    lineHeight: 24,
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
