import { useState, useEffect, useRef, useCallback } from 'react';
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
  Alert,
  Dimensions,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import { uploadImage } from '../../utils/imageUpload';
import ReviewModal from '../../components/ReviewModal';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 44;

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
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingReviewCommission, setPendingReviewCommission] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (id && token) {
      fetchMessages();
      fetchConversationDetails();
    }
  }, [id, token]);

  useFocusEffect(
    useCallback(() => {
      const markAsRead = async () => {
        try {
          await axios.post(
            `${API_URL}/messages/conversations/${id}/read`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      };

      if (id && token) {
        markAsRead();
        fetchMessages();
        fetchConversationDetails();
      }
    }, [id, token])
  );

  const fetchConversationDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const otherParticipant = response.data.participants?.find(p => p.id !== user?.id);
      setOtherUser(otherParticipant);

      if (response.data.commission_id) {
        const commissionResponse = await axios.get(
          `${API_URL}/commissions/${response.data.commission_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const commissionData = commissionResponse.data;
        setCommission(commissionData);

        // Check if commission is completed and if user needs to review
        if (commissionData.status === 'completed') {
          await checkAndPromptReview(commissionData);
        }
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error);
    }
  };

  const checkAndPromptReview = async (commissionData) => {
    try {
      // Check if user has already reviewed
      const reviewType = commissionData.client_id === user?.id ? 'client_to_artist' : 'artist_to_client';
      
      // Check existing reviews for this commission
      const response = await axios.get(
        `${API_URL}/reviews/commission/${commissionData.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const existingReviews = Array.isArray(response.data) ? response.data : [];

      // Check if review already exists for this type
      const hasReviewed = existingReviews.some(r => r.review_type === reviewType);

      if (!hasReviewed) {
        // Show review prompt after a short delay
        setTimeout(() => {
          setPendingReviewCommission(commissionData);
          setShowReviewModal(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking review status:', error);
    }
  };

  const handleSubmitReview = async (rating, comment) => {
    if (!pendingReviewCommission) return;

    const reviewType = pendingReviewCommission.client_id === user?.id 
      ? 'client_to_artist' 
      : 'artist_to_client';

    await axios.post(
      `${API_URL}/reviews`,
      {
        commission_id: pendingReviewCommission.id,
        rating,
        comment,
        review_type: reviewType,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    Alert.alert('Thank you!', 'Your review has been submitted.');
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const msgs = response.data.messages || [];
      
      // Filter out commission_update messages
      const filteredMsgs = msgs.filter(m => m.message_type !== 'commission_update');

      const commissionRequestMsg = filteredMsgs.find(m => m.message_type === 'commission_request');
      if (commissionRequestMsg?.metadata?.commission_id && !commission) {
        try {
          const commissionResponse = await axios.get(
            `${API_URL}/commissions/${commissionRequestMsg.metadata.commission_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setCommission(commissionResponse.data);
        } catch (err) {
          console.error('Error loading commission:', err);
        }
      }

      setMessages(filteredMsgs);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSending(true);
      try {
        const imageUrl = await uploadImage(result.assets[0].uri, 'messages', '', token);
        if (!imageUrl) throw new Error('Upload failed');

        await axios.post(
          `${API_URL}/messages/conversations/${id}/messages`,
          {
            content: ' ',
            image_url: imageUrl,
            message_type: 'image',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        await fetchMessages();
      } catch (error) {
        console.error('Error sending image:', error);
        Alert.alert('Error', 'Failed to send image. Please try again.');
      } finally {
        setSending(false);
      }
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

  const formatDayHeader = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
    return date.toLocaleDateString([], { 
      month: 'long', 
      day: 'numeric', 
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined 
    });
  };

  const shouldShowDayHeader = (item, index) => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    if (!prevMessage) return true;
    return new Date(item.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();
  };

  const handleCommissionResponse = async (commissionId, status, response) => {
    try {
      await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status, artist_response: response, skip_message: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await Promise.all([fetchMessages(), fetchConversationDetails()]);
    } catch (error) {
      console.error('Error responding to commission:', error);
      Alert.alert('Error', 'Failed to update commission status. Please try again.');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/messages/conversations/${id}/messages/${messageId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchMessages();
            } catch (error) {
              try {
                await axios.delete(
                  `${API_URL}/conversations/${id}/messages/${messageId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchMessages();
              } catch (err) {
                Alert.alert('Error', err.response?.data?.error || 'Failed to delete message');
              }
            }
          },
        },
      ]
    );
  };

  const renderDayHeader = (timestamp) => (
    <View style={styles.dayHeader}>
      <View style={styles.dayHeaderLine} />
      <Text style={styles.dayHeaderText}>{formatDayHeader(timestamp)}</Text>
      <View style={styles.dayHeaderLine} />
    </View>
  );

  const renderCommissionRequest = (item, index) => {
    const metadata = item.metadata || {};
    const isArtist = user?.id !== item.sender_id;

    return (
      <>
        {shouldShowDayHeader(item, index) && renderDayHeader(item.created_at)}
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
        </View>
      </>
    );
  };

  const renderMessage = ({ item, index }) => {
    if (item.message_type === 'commission_request') {
      return renderCommissionRequest(item, index);
    }

    const isOwn = item.sender_id === user?.id;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const showTime = !prevMessage ||
      prevMessage.sender_id !== item.sender_id ||
      (new Date(item.created_at) - new Date(prevMessage.created_at)) > 1000 * 60 * 5;
    const isLastInGroup = !nextMessage ||
      nextMessage.sender_id !== item.sender_id ||
      (new Date(nextMessage.created_at) - new Date(item.created_at)) > 1000 * 60 * 5;

    const isRead = item.is_read && isOwn;

    return (
      <>
        {shouldShowDayHeader(item, index) && renderDayHeader(item.created_at)}
        <TouchableOpacity
          style={[styles.messageWrapper, isOwn && styles.messageWrapperOwn]}
          onLongPress={() => {
            if (isOwn) handleDeleteMessage(item.id);
          }}
          activeOpacity={0.7}
        >
          {item.image_url ? (
            <View style={styles.imageMessageContainer}>
              <View style={[styles.imageBubble, isOwn && styles.imageBubbleOwn]}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.messageImage}
                  contentFit="cover"
                />
              </View>
              {isLastInGroup && isOwn && (
                <View style={styles.messageStatusContainer}>
                  <Text style={styles.messageStatusText}>
                    {isRead ? 'Read' : 'Delivered'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.textMessageContainer}>
              <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
                <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                  {item.content}
                </Text>
              </View>
              {isLastInGroup && isOwn && (
                <View style={styles.messageStatusContainer}>
                  <Text style={styles.messageStatusText}>
                    {isRead ? 'Read' : 'Delivered'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </>
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
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {selectedCommissionDetails && (
              <View style={styles.modalBody}>
                {selectedCommissionDetails.title && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Title</Text>
                    <Text style={styles.modalValue}>{selectedCommissionDetails.title}</Text>
                  </View>
                )}
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Description</Text>
                  <Text style={styles.modalValue}>{selectedCommissionDetails.description}</Text>
                </View>
                {selectedCommissionDetails.budget && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Budget</Text>
                    <Text style={styles.modalValue}>${selectedCommissionDetails.budget}</Text>
                  </View>
                )}
                {selectedCommissionDetails.deadline && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Deadline</Text>
                    <Text style={styles.modalValue}>{selectedCommissionDetails.deadline}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons for In-Progress Commissions */}
            {commission && (commission.status === 'in_progress' || commission.status === 'accepted') && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.cancelActionButton]}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Commission',
                      'Are you sure you want to cancel this commission? This action cannot be undone.',
                      [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Yes, Cancel',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await axios.patch(
                                `${API_URL}/commissions/${commission.id}/status`,
                                { status: 'cancelled', skip_message: true },
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              setShowDetailsModal(false);
                              await Promise.all([fetchMessages(), fetchConversationDetails()]);
                              Alert.alert('Success', 'Commission has been cancelled');
                              router.back();
                            } catch (error) {
                              console.error('Error cancelling commission:', error);
                              Alert.alert('Error', 'Failed to cancel commission. Please try again.');
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={22} color="#F44336" />
                  <Text style={styles.cancelActionButtonText}>Cancel Commission</Text>
                </TouchableOpacity>

                {user?.artists && commission.artist_id === user.artists.id && (
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.completeActionButton]}
                    onPress={() => {
                      Alert.alert(
                        'Complete Commission',
                        'Mark this commission as completed?',
                        [
                          { text: 'Not Yet', style: 'cancel' },
                          {
                            text: 'Complete',
                            onPress: async () => {
                              try {
                                await axios.patch(
                                  `${API_URL}/commissions/${commission.id}/status`,
                                  { status: 'completed', skip_message: true },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                setShowDetailsModal(false);
                                const updatedCommission = await axios.get(
                                  `${API_URL}/commissions/${commission.id}`,
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                await Promise.all([fetchMessages(), fetchConversationDetails()]);
                                Alert.alert('Success', 'Commission has been completed!');
                                // Prompt for review after completion
                                setTimeout(() => {
                                  setPendingReviewCommission(updatedCommission.data);
                                  setShowReviewModal(true);
                                }, 1500);
                              } catch (error) {
                                console.error('Error completing commission:', error);
                                Alert.alert('Error', 'Failed to complete commission. Please try again.');
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
                    <Text style={styles.completeActionButtonText}>Mark as Complete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setPendingReviewCommission(null);
        }}
        onSubmit={handleSubmitReview}
        userName={
          pendingReviewCommission
            ? (user?.id === pendingReviewCommission.client_id
                ? (otherUser?.full_name || otherUser?.username || 'Artist')
                : (otherUser?.full_name || otherUser?.username || 'Client'))
            : ''
        }
        userAvatar={otherUser?.avatar_url || DEFAULT_AVATAR}
        reviewType={
          pendingReviewCommission && user?.id === pendingReviewCommission.client_id
            ? 'client_to_artist'
            : 'artist_to_client'
        }
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => {
              if (otherUser?.id) {
                if (otherUser.artists) {
                  router.push(`/artist/${otherUser.artists.id}`);
                } else {
                  router.push(`/client/${otherUser.id}`);
                }
              }
            }}
            activeOpacity={0.7}
          >
            {otherUser && (
              <>
                <View style={styles.headerAvatarContainer}>
                  <Image
                    source={{ uri: otherUser.avatar_url || DEFAULT_AVATAR }}
                    style={styles.headerAvatar}
                    contentFit="cover"
                  />
                  {isUserOnline(otherUser) && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerName}>{otherUser.username || 'Unknown'}</Text>
                  <Text style={styles.headerStatus}>
                    {isUserOnline(otherUser) ? 'Active now' : 'Offline'}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Messages List */}
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

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={handleImagePick}>
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
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
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
    paddingTop: STATUS_BAR_HEIGHT + spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
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
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineDot: {
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
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
  },
  infoButton: {
    padding: spacing.xs,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dayHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dayHeaderText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    maxWidth: '80%',
  },
  messageWrapperOwn: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    ...shadows.small,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: borderRadius.lg,
  },
  messageBubbleOther: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.text.primary,
  },
  textMessageContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  imageMessageContainer: {
    width: '100%',
    alignItems: 'flex-end',
  },
  messageStatusContainer: {
    marginTop: 4,
    paddingRight: spacing.xs,
  },
  messageStatusText: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  imageBubble: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  imageBubbleOwn: {
    backgroundColor: colors.surface,
  },
  messageImage: {
    width: 250,
    height: 200,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '90%',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    ...shadows.small,
  },
  commissionCardReceived: {
    backgroundColor: colors.surface,
    borderColor: colors.primary + '30',
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
    fontWeight: '700',
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
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
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
  commissionTime: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 11,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
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
  modalLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
    lineHeight: 24,
  },
  modalActions: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  cancelActionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#F44336',
  },
  cancelActionButtonText: {
    ...typography.bodyBold,
    color: '#F44336',
    fontSize: 15,
    fontWeight: '700',
  },
  completeActionButton: {
    backgroundColor: '#4CAF50',
  },
  completeActionButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
