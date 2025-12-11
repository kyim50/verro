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
  Dimensions,
  Modal,
  RefreshControl,
  Animated,
  Keyboard,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import { uploadImage } from '../../utils/imageUpload';
import ReviewModal from '../../components/ReviewModal';
import { initSocket, getSocket, disconnectSocket } from '../../lib/socket';
import { showAlert } from '../../components/StyledAlert';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 44;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function ConversationScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const [commission, setCommission] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCommissionDetails, setSelectedCommissionDetails] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingReviewCommission, setPendingReviewCommission] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);
  const socketRef = useRef(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // Initialize Socket.io connection for real-time messaging
  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    const socket = initSocket(token);
    socketRef.current = socket;

    // Join conversation room
    if (id && socket.connected) {
      socket.emit('join-conversation', id);
    }

    // Handle socket connection
    socket.on('connect', () => {
      console.log('Socket connected in conversation');
      if (id) {
        socket.emit('join-conversation', id);
      }
    });

    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages(prev => {
        // Check for exact ID match first (most common case)
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        
        // If this is our own message, find and replace the temp one
        if (message.sender_id === user?.id) {
          const tempMessage = prev.find(m => 
            m.id?.startsWith('temp-') && 
            m.sender_id === user?.id &&
            ((m.message_type === 'text' && m.content === message.content) ||
             (m.message_type === 'image' && m.image_url && message.image_url))
          );
          
          if (tempMessage) {
            // Replace temp with real message
            return prev.map(m => m.id === tempMessage.id ? message : m);
          }
        }
        
        // Otherwise, just add the new message
        return [...prev, message];
      });
      
      // Scroll to bottom when new message arrives
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off('new-message');
        socket.off('connect');
      }
    };
  }, [id, token]);

  useEffect(() => {
    if (id && token) {
      fetchMessages();
      fetchConversationDetails();
    }
  }, [id, token]);

  // Screen entrance animation
  useEffect(() => {
    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        easing: (t) => t * (2 - t), // Ease out quadratic for smoother feel
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Keyboard animations
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          easing: (t) => t * (2 - t), // Smooth ease out
          useNativeDriver: false,
        }).start();
        
        // Scroll to bottom when keyboard opens
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, Platform.OS === 'ios' ? (e.duration || 250) : 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          easing: (t) => t * (2 - t), // Smooth ease out
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

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

    Toast.show({
      type: 'success',
      text1: 'Thank you!',
      text2: 'Your review has been submitted.',
      visibilityTime: 2000,
    });
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
      Toast.show({
        type: 'info',
        text1: 'Permission needed',
        text2: 'Please allow access to your photos',
        visibilityTime: 3000,
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Optimistic update - add placeholder message immediately
      const tempMessage = {
        id: `temp-img-${Date.now()}`,
        image_url: result.assets[0].uri,
        sender_id: user?.id,
        conversation_id: id,
        message_type: 'image',
        content: '',
        created_at: new Date().toISOString(),
        isPending: true,
      };
      setMessages(prev => [...prev, tempMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      try {
        const imageUrl = await uploadImage(result.assets[0].uri, 'messages', '', token);
        if (!imageUrl) throw new Error('Upload failed');

        await axios.post(
          `${API_URL}/messages/conversations/${id}/messages`,
          {
            image_url: imageUrl,
            message_type: 'image',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Socket.io will emit the real message, which will replace the temp one
        // Remove temp after a short delay if not replaced
        setTimeout(() => {
          setMessages(prev => {
            const stillHasTemp = prev.some(m => m.id === tempMessage.id);
            if (stillHasTemp) {
              return prev.filter(m => m.id !== tempMessage.id);
            }
            return prev;
          });
        }, 1000);
      } catch (error) {
        console.error('Error sending image:', error);
        // Remove temp message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to send image. Please try again.',
          visibilityTime: 3000,
        });
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    // Optimistic update - add message immediately for instant feedback
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: messageContent,
      sender_id: user?.id,
      conversation_id: id,
      message_type: 'text',
      created_at: new Date().toISOString(),
      isPending: true,
    };
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      await axios.post(
        `${API_URL}/messages/conversations/${id}/messages`,
        { content: messageContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Socket.io will emit the real message, which will replace the temp one
      // But in case Socket.io doesn't work, remove temp after a short delay
      setTimeout(() => {
        setMessages(prev => {
          // Check if temp message still exists (Socket.io should have replaced it)
          const stillHasTemp = prev.some(m => m.id === tempId);
          if (stillHasTemp) {
            // Remove temp if it wasn't replaced (fallback)
            return prev.filter(m => m.id !== tempId);
          }
          return prev;
        });
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error and restore input
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageContent);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to send message. Please try again.',
        visibilityTime: 3000,
      });
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update commission status. Please try again.',
        visibilityTime: 3000,
      });
    }
  };

  const handleDeleteMessage = async (messageId) => {
    showAlert({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      type: 'warning',
      buttons: [
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
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Message deleted successfully',
                visibilityTime: 2000,
              });
            } catch (error) {
              try {
                await axios.delete(
                  `${API_URL}/conversations/${id}/messages/${messageId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                await fetchMessages();
                Toast.show({
                  type: 'success',
                  text1: 'Deleted',
                  text2: 'Message deleted successfully',
                  visibilityTime: 2000,
                });
              } catch (err) {
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: err.response?.data?.error || 'Failed to delete message',
                  visibilityTime: 3000,
                });
              }
            }
          },
        },
      ],
    });
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
    const isPending = item.isPending;
    
    // Check if this is the most recent message from the current user
    const isMostRecentOwnMessage = isOwn && (() => {
      // Find the last message sent by the current user
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].sender_id === user?.id && !messages[i].isPending) {
          return messages[i].id === item.id;
        }
      }
      return false;
    })();

    return (
      <>
        {shouldShowDayHeader(item, index) && renderDayHeader(item.created_at)}
        {item.image_url ? (
          <View style={[styles.imageMessageWrapper, isOwn && styles.imageMessageWrapperOwn]}>
            <TouchableOpacity
              onLongPress={() => {
                if (isOwn && !isPending) handleDeleteMessage(item.id);
              }}
              activeOpacity={0.9}
              style={styles.imageMessageTouchable}
            >
              <Image
                source={{ uri: item.image_url }}
                style={[styles.messageImage, isPending && styles.pendingMessage]}
                contentFit="cover"
              />
            </TouchableOpacity>
            {isOwn && !isPending && isMostRecentOwnMessage && (
              <View style={styles.messageStatusContainer}>
                <Text style={styles.messageStatusText}>
                  {isRead ? 'Read' : 'Delivered'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.messageWrapper, isOwn && styles.messageWrapperOwn]}>
            <View style={styles.textMessageContainer}>
              <TouchableOpacity
                onLongPress={() => {
                  if (isOwn && !isPending) handleDeleteMessage(item.id);
                }}
                activeOpacity={0.7}
                style={styles.messageTouchable}
                disabled={isPending}
              >
                <View style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther, isPending && styles.pendingMessage]}>
                  <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
                    {item.content}
                  </Text>
                </View>
              </TouchableOpacity>
              {isOwn && !isPending && isMostRecentOwnMessage && (
                <View style={styles.messageStatusContainer}>
                  <Text style={styles.messageStatusText}>
                    {isRead ? 'Read' : 'Delivered'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
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
                    showAlert({
                      title: 'Cancel Commission',
                      message: 'Are you sure you want to cancel this commission? This action cannot be undone.',
                      type: 'warning',
                      buttons: [
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
                              Toast.show({
                                type: 'success',
                                text1: 'Success',
                                text2: 'Commission has been cancelled',
                                visibilityTime: 2000,
                              });
                              router.back();
                            } catch (error) {
                              console.error('Error cancelling commission:', error);
                              Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: 'Failed to cancel commission. Please try again.',
                                visibilityTime: 3000,
                              });
                            }
                          }
                        }
                      ]
                    });
                  }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.status.error} />
                  <Text style={styles.cancelActionButtonText}>Cancel Commission</Text>
                </TouchableOpacity>

                {user?.artists && commission.artist_id === user.artists.id && (
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.completeActionButton]}
                    onPress={() => {
                      showAlert({
                        title: 'Complete Commission',
                        message: 'Mark this commission as completed?',
                        type: 'info',
                        buttons: [
                          { text: 'Not Yet', style: 'cancel' },
                          {
                            text: 'Complete',
                            style: 'default',
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
                                Toast.show({
                                  type: 'success',
                                  text1: 'Success',
                                  text2: 'Commission has been completed!',
                                  visibilityTime: 2000,
                                });
                                // Prompt for review after completion
                                setTimeout(() => {
                                  setPendingReviewCommission(updatedCommission.data);
                                  setShowReviewModal(true);
                                }, 1500);
                              } catch (error) {
                                console.error('Error completing commission:', error);
                                Toast.show({
                                  type: 'error',
                                  text1: 'Error',
                                  text2: 'Failed to complete commission. Please try again.',
                                  visibilityTime: 3000,
                                });
                              }
                            }
                          }
                        ]
                      });
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.text.primary} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
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
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          contentContainerStyle={styles.messagesList}
          style={styles.messagesFlatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchMessages();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.text.disabled} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send a message to start chatting</Text>
            </View>
          }
        />

        {/* Input */}
        <Animated.View
          style={[
            styles.inputContainer,
            {
              paddingBottom: keyboardHeight.interpolate({
                inputRange: [0, 100, 400],
                outputRange: [
                  insets.bottom + spacing.sm,
                  insets.bottom + spacing.xs,
                  insets.bottom + spacing.xs,
                ],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
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
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          )}
        </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  animatedContainer: {
    flex: 1,
  },
  messagesFlatList: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingTop: STATUS_BAR_HEIGHT + (IS_SMALL_SCREEN ? spacing.xs : spacing.sm),
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    backgroundColor: colors.background,
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
    width: IS_SMALL_SCREEN ? 36 : 40,
    height: IS_SMALL_SCREEN ? 36 : 40,
    borderRadius: IS_SMALL_SCREEN ? 18 : 20,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  headerStatus: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  infoButton: {
    padding: spacing.xs,
  },
  messagesList: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingVertical: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
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
    marginBottom: spacing.sm,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  messageWrapperOwn: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg + 2,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    maxWidth: '100%',
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: borderRadius.lg + 2,
  },
  messageBubbleOther: {
    backgroundColor: colors.surface,
  },
  messageText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  messageTextOwn: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  textMessageContainer: {
    alignItems: 'flex-end',
  },
  imageMessageContainer: {
    alignItems: 'flex-end',
  },
  messageTouchable: {
    alignSelf: 'flex-end',
  },
  messageStatusContainer: {
    marginTop: 4,
    alignSelf: 'flex-end',
    paddingRight: spacing.xs,
  },
  messageStatusText: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  imageMessageWrapper: {
    marginBottom: spacing.sm,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  imageMessageWrapperOwn: {
    alignSelf: 'flex-end',
  },
  imageMessageTouchable: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  messageImage: {
    width: 250,
    height: 200,
    borderRadius: borderRadius.lg,
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
    backgroundColor: colors.overlay,
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
    borderColor: colors.status.error,
  },
  cancelActionButtonText: {
    ...typography.bodyBold,
    color: colors.status.error,
    fontSize: 15,
    fontWeight: '700',
  },
  completeActionButton: {
    backgroundColor: colors.status.success,
  },
  completeActionButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
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
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  attachButton: {
    width: IS_SMALL_SCREEN ? 36 : 40,
    height: IS_SMALL_SCREEN ? 36 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
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
    overflow: 'hidden',
    ...shadows.medium,
  },
  pendingMessage: {
    opacity: 0.5,
  },
});
