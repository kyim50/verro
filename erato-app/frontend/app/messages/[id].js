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
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { useCallback } from 'react';
import { uploadImage } from '../../utils/imageUpload';

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

  // Mark messages as read when screen is focused
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
        // Refresh messages when screen comes into focus
        fetchMessages();
        fetchConversationDetails();
      }

      return () => {
        // Cleanup if needed
      };
    }, [id, token])
  );

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
        if (!imageUrl) {
          throw new Error('Upload failed');
        }

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

  const handleCommissionResponse = async (commissionId, status, response) => {
    try {
      await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status, artist_response: response },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh messages and commission details to update UI immediately
      await Promise.all([fetchMessages(), fetchConversationDetails()]);
    } catch (error) {
      console.error('Error responding to commission:', error);
      Alert.alert('Error', 'Failed to update commission status. Please try again.');
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

  const renderCommissionRequest = (item, index) => {
    const metadata = item.metadata || {};
    // The sender is the client, so if current user is NOT the sender, they are the artist
    const isArtist = user?.id !== item.sender_id;
    const isPending = commission && commission.status === 'pending';

    return (
      <>
        {shouldShowDayHeader(item, index) && (
          <View style={styles.dayHeaderContainer}>
            <Text style={styles.dayHeaderText}>{formatDayHeader(item.created_at)}</Text>
          </View>
        )}
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
      </>
    );
  };

  const formatDayHeader = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { 
        month: 'long', 
        day: 'numeric', 
        year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined 
      });
    }
  };

  const shouldShowDayHeader = (item, index) => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    if (!prevMessage) return true;

    const currentDate = new Date(item.created_at);
    const prevDate = new Date(prevMessage.created_at);

    return currentDate.toDateString() !== prevDate.toDateString();
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
              // Primary (original) route
              await axios.delete(
                `${API_URL}/messages/conversations/${id}/messages/${messageId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchMessages();
            } catch (error) {
              // Fallback route
              try {
                await axios.delete(
                  `${API_URL}/conversations/${id}/messages/${messageId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchMessages();
              } catch (err) {
                console.error('Error deleting message:', err?.response?.data || err.message || err);
                const msg = err.response?.data?.error || 'Failed to delete message';
                Alert.alert('Error', msg);
              }
            }
          },
        },
      ]
    );
  };

  const renderCommissionUpdate = (item, index) => {
    const metadata = item.metadata || {};
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showTime = !prevMessage ||
      prevMessage.sender_id !== item.sender_id ||
      (new Date(item.created_at) - new Date(prevMessage.created_at)) > 60000;

    // Determine icon and color based on update type
    let iconName = 'information-circle';
    let iconColor = colors.primary;

    if (item.content.toLowerCase().includes('accepted')) {
      iconName = 'checkmark-circle';
      iconColor = '#4CAF50';
    } else if (item.content.toLowerCase().includes('completed')) {
      iconName = 'checkmark-done-circle';
      iconColor = '#4CAF50';
    } else if (item.content.toLowerCase().includes('cancelled') || item.content.toLowerCase().includes('declined')) {
      iconName = 'close-circle';
      iconColor = '#F44336';
    } else if (item.content.toLowerCase().includes('progress')) {
      iconName = 'time';
      iconColor = colors.primary;
    }

    return (
      <>
        {shouldShowDayHeader(item, index) && (
          <View style={styles.dayHeaderContainer}>
            <Text style={styles.dayHeaderText}>{formatDayHeader(item.created_at)}</Text>
          </View>
        )}
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessageBubble, { borderColor: iconColor + '30' }]}>
            <Ionicons name={iconName} size={18} color={iconColor} />
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
          {showTime && (
            <Text style={styles.systemMessageTime}>{formatTime(item.created_at)}</Text>
          )}
        </View>
      </>
    );
  };

  const renderMessage = ({ item, index }) => {
    // Handle special message types
    if (item.message_type === 'commission_request') {
      return renderCommissionRequest(item, index);
    }

    if (item.message_type === 'commission_update') {
      return renderCommissionUpdate(item);
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
        {shouldShowDayHeader(item, index) && (
          <View style={styles.dayHeaderContainer}>
            <Text style={styles.dayHeaderText}>{formatDayHeader(item.created_at)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.messageRow, isOwn && styles.messageRowOwn]}
          onLongPress={() => {
            if (isOwn) {
              handleDeleteMessage(item.id);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.messageContentContainer, isOwn && styles.messageContentContainerOwn]}>
            {item.image_url ? (
              <View style={styles.imageMessageContainer}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.imageMessage}
                  contentFit="cover"
                  cachePolicy="none"
                />
              </View>
            ) : (
              <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                  {item.content}
                </Text>
              </View>
            )}
            
            {(showTime || (isOwn && isLastInGroup)) && (
              <View style={styles.messageFooter}>
                {showTime && isLastInGroup && (
                  <Text style={[styles.time, isOwn && styles.timeOwn]}>
                    {formatTime(item.created_at)}
                  </Text>
                )}
                {isOwn && isLastInGroup && (
                  <Text style={[styles.statusText, isRead && styles.statusTextRead]}>
                    {isRead ? 'Read' : 'Delivered'}
                  </Text>
                )}
              </View>
            )}
          </View>
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
                                { status: 'cancelled' },
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              setShowDetailsModal(false);
                              await Promise.all([fetchMessages(), fetchConversationDetails()]);
                              Alert.alert('Success', 'Commission has been cancelled');
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
                                  { status: 'completed' },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                setShowDetailsModal(false);
                                await Promise.all([fetchMessages(), fetchConversationDetails()]);
                                Alert.alert('Success', 'Commission has been completed!');
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

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => {
          if (otherUser?.id) {
            // Navigate to artist profile if they have an artist record, otherwise client profile
            if (otherUser.artists) {
              router.push(`/artist/${otherUser.artists.id}`);
            } else {
              router.push(`/client/${otherUser.id}`);
            }
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

        {commission && (commission.status === 'in_progress' || commission.status === 'accepted') && (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              setSelectedCommissionDetails({
                title: commission.title,
                description: commission.details,
                budget: commission.price,
                deadline: commission.deadline,
              });
              setShowDetailsModal(true);
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
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
          <TouchableOpacity 
            style={styles.inputActionButton}
            onPress={handleImagePick}
          >
            <Ionicons name="add-circle" size={32} color={colors.primary} />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
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
  dayHeaderContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dayHeaderText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    alignItems: 'flex-end',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageContentContainer: {
    flex: 1,
    maxWidth: '90%',
  },
  messageContentContainerOwn: {
    alignItems: 'flex-end',
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
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: 16,
    marginBottom: spacing.xs / 2,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1.5,
    elevation: 1,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 10,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceLight,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text.secondary,
    fontSize: 11,
  },
  timeOwn: {
    color: colors.text.secondary,
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginLeft: spacing.sm,
  },
  statusTextRead: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  imageMessageContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 2,
    maxWidth: 260,
    backgroundColor: colors.surfaceLight,
  },
  imageMessage: {
    width: 260,
    height: 220,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  statusContainer: {
    marginLeft: spacing.xs / 2,
  },
  systemMessageTime: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: '85%',
  },
  systemMessageText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
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
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  inputActionButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    maxHeight: 110,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});
