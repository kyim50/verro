import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
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
import PaymentOptions from '../../components/PaymentOptions';
import PayPalCheckout from '../../components/PayPalCheckout';
import EscrowStatus from '../../components/EscrowStatus';
import MilestoneTracker from '../../components/MilestoneTracker';
import TipJar from '../../components/TipJar';
import TransactionHistory from '../../components/TransactionHistory';
import ReferenceBoard from '../../components/ReferenceBoard';

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
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [showProgressActions, setShowProgressActions] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionImage, setRevisionImage] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [markupPaths, setMarkupPaths] = useState([]);
  const [showReferences, setShowReferences] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [showPayPalCheckout, setShowPayPalCheckout] = useState(false);
  const [showTipJar, setShowTipJar] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [selectedImageForViewer, setSelectedImageForViewer] = useState(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
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

  // Screen entrance animation - faster and start visible
  useEffect(() => {
    // Start visible immediately to prevent black screen
    fadeAnim.setValue(1);
    slideAnim.setValue(0);
    
    // Optional: subtle animation if needed, but start visible
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150, // Much faster
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150, // Much faster
        easing: (t) => t * (2 - t),
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

        // Fetch progress updates
        try {
          const progressResponse = await axios.get(
            `${API_URL}/commissions/${response.data.commission_id}/progress`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setProgressUpdates(progressResponse.data.progress_updates || []);
        } catch (err) {
          console.error('Error fetching progress updates:', err);
        }

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
      
      // Filter out commission_update messages (but keep progress_update)
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

  const handleImagePick = async (forProgressUpdate = false, updateType = null) => {
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
      mediaTypes: ["images"],
      allowsEditing: !forProgressUpdate, // Don't allow editing for progress updates (we'll add markup)
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (forProgressUpdate && updateType === 'revision_request') {
        // For revision requests, open markup modal
        setRevisionImage(result.assets[0].uri);
        setShowRevisionModal(true);
        return;
      }

      // Regular image or WIP/approval checkpoint
      const tempMessage = {
        id: `temp-img-${Date.now()}`,
        image_url: result.assets[0].uri,
        sender_id: user?.id,
        conversation_id: id,
        message_type: forProgressUpdate ? 'progress_update' : 'image',
        content: '',
        created_at: new Date().toISOString(),
        isPending: true,
      };
      setMessages(prev => [...prev, tempMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      try {
        const imageUrl = await uploadImage(result.assets[0].uri, 'messages', '', token);
        if (!imageUrl) throw new Error('Upload failed');

        if (forProgressUpdate && updateType) {
          // Create progress update
          await axios.post(
            `${API_URL}/commissions/${commission?.id}/progress`,
            {
              update_type: updateType,
              image_url: imageUrl,
              requires_approval: updateType === 'approval_checkpoint',
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          await fetchConversationDetails(); // Refresh progress updates
        } else {
          // Regular message
          await axios.post(
            `${API_URL}/messages/conversations/${id}/messages`,
            {
              image_url: imageUrl,
              message_type: 'image',
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }

        // Socket.io will emit the real message, which will replace the temp one
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

  const handleWIPUpload = () => {
    if (!commission || commission.status !== 'in_progress') {
      Toast.show({
        type: 'info',
        text1: 'Not available',
        text2: 'Progress updates are only available for active commissions',
        visibilityTime: 3000,
      });
      return;
    }
    handleImagePick(true, 'wip_image');
    setShowProgressActions(false);
  };

  const handleApprovalCheckpoint = () => {
    if (!commission || commission.status !== 'in_progress') {
      Toast.show({
        type: 'info',
        text1: 'Not available',
        text2: 'Progress updates are only available for active commissions',
        visibilityTime: 3000,
      });
      return;
    }
    handleImagePick(true, 'approval_checkpoint');
    setShowProgressActions(false);
  };

  const handleRequestRevision = () => {
    if (!commission || commission.status !== 'in_progress') {
      Toast.show({
        type: 'info',
        text1: 'Not available',
        text2: 'Revisions are only available for active commissions',
        visibilityTime: 3000,
      });
      return;
    }
    handleImagePick(true, 'revision_request');
    setShowProgressActions(false);
  };

  const handleApproveCheckpoint = async (progressId) => {
    try {
      await axios.patch(
        `${API_URL}/commissions/${commission?.id}/progress/${progressId}/approve`,
        { approval_status: 'approved' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchConversationDetails();
      Toast.show({
        type: 'success',
        text1: 'Approved',
        text2: 'Checkpoint has been approved',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error approving checkpoint:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to approve checkpoint',
        visibilityTime: 3000,
      });
    }
  };

  const handleRejectCheckpoint = async (progressId) => {
    showAlert({
      title: 'Reject Checkpoint',
      message: 'Are you sure you want to reject this checkpoint?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.patch(
                `${API_URL}/commissions/${commission?.id}/progress/${progressId}/approve`,
                { approval_status: 'rejected' },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchConversationDetails();
              Toast.show({
                type: 'success',
                text1: 'Rejected',
                text2: 'Checkpoint has been rejected',
                visibilityTime: 2000,
              });
            } catch (error) {
              console.error('Error rejecting checkpoint:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.error || 'Failed to reject checkpoint',
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
    });
  };

  const handleSubmitRevision = async () => {
    if (!revisionImage) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an image',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      // Upload image with markup
      const imageUrl = await uploadImage(revisionImage, 'messages', '', token);
      if (!imageUrl) throw new Error('Upload failed');

      await axios.post(
        `${API_URL}/commissions/${commission?.id}/progress`,
        {
          update_type: 'revision_request',
          image_url: imageUrl,
          revision_notes: revisionNotes,
          markup_data: markupPaths.length > 0 ? { paths: markupPaths } : null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowRevisionModal(false);
      setRevisionImage(null);
      setRevisionNotes('');
      setMarkupPaths([]);
      await fetchConversationDetails();
      Toast.show({
        type: 'success',
        text1: 'Revision requested',
        text2: 'Your revision request has been sent',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error submitting revision:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to submit revision request',
        visibilityTime: 3000,
      });
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

  const renderProgressUpdate = (item, index) => {
    const metadata = item.metadata || {};
    const updateType = metadata.update_type;
    const isOwn = item.sender_id === user?.id;
    const progressUpdate = progressUpdates.find(p => p.id === metadata.progress_update_id);

    return (
      <>
        {shouldShowDayHeader(item, index) && renderDayHeader(item.created_at)}
        <View style={[styles.progressUpdateCard, isOwn && styles.progressUpdateCardOwn]}>
          {updateType === 'wip_image' && (
            <>
              <View style={styles.progressUpdateHeader}>
                <Ionicons name="image-outline" size={18} color={colors.primary} />
                <Text style={styles.progressUpdateTitle}>Work in Progress</Text>
              </View>
              {item.image_url && (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.progressUpdateImage}
                  contentFit="contain"
                />
              )}
            </>
          )}
          {updateType === 'approval_checkpoint' && (
            <>
              <View style={styles.progressUpdateHeader}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.status.warning} />
                <Text style={styles.progressUpdateTitle}>Approval Checkpoint</Text>
              </View>
              {item.image_url && (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.progressUpdateImage}
                  contentFit="contain"
                />
              )}
              {progressUpdate && progressUpdate.approval_status === 'pending' && !isOwn && commission?.client_id === user?.id && (
                <View style={styles.approvalActions}>
                  <TouchableOpacity
                    style={[styles.approvalButton, styles.approveButton]}
                    onPress={() => handleApproveCheckpoint(progressUpdate.id)}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.text.primary} />
                    <Text style={styles.approvalButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalButton, styles.rejectButton]}
                    onPress={() => handleRejectCheckpoint(progressUpdate.id)}
                  >
                    <Ionicons name="close" size={16} color={colors.text.primary} />
                    <Text style={styles.approvalButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
              {progressUpdate && progressUpdate.approval_status === 'approved' && (
                <View style={styles.approvalStatus}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                  <Text style={styles.approvalStatusText}>Approved</Text>
                </View>
              )}
              {progressUpdate && progressUpdate.approval_status === 'rejected' && (
                <View style={styles.approvalStatus}>
                  <Ionicons name="close-circle" size={16} color={colors.status.error} />
                  <Text style={styles.approvalStatusText}>Rejected</Text>
                </View>
              )}
            </>
          )}
          {updateType === 'revision_request' && (
            <>
              <View style={styles.progressUpdateHeader}>
                <Ionicons name="refresh-outline" size={18} color={colors.status.warning} />
                <Text style={styles.progressUpdateTitle}>
                  Revision Request #{progressUpdate?.revision_number || '?'}
                </Text>
              </View>
              {item.image_url && (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.progressUpdateImage}
                  contentFit="contain"
                />
              )}
              {progressUpdate?.revision_notes && (
                <Text style={styles.revisionNotes}>{progressUpdate.revision_notes}</Text>
              )}
            </>
          )}
          {updateType === 'approval_response' && (
            <View style={styles.progressUpdateHeader}>
              <Ionicons 
                name={metadata.approval_status === 'approved' ? 'checkmark-circle' : 'close-circle'} 
                size={18} 
                color={metadata.approval_status === 'approved' ? colors.status.success : colors.status.error} 
              />
              <Text style={styles.progressUpdateTitle}>
                Checkpoint {metadata.approval_status === 'approved' ? 'approved' : 'rejected'}
              </Text>
            </View>
          )}
        </View>
      </>
    );
  };

  const renderCommissionRequest = (item, index) => {
    const metadata = item.metadata || {};
    const isArtist = user?.id !== item.sender_id;

    return (
      <>
        {shouldShowDayHeader(item, index) && renderDayHeader(item.created_at)}
        <TouchableOpacity
          style={[styles.compactCommissionCard, isArtist && styles.compactCommissionCardReceived]}
          onPress={() => {
            if (commission?.id) {
              // Navigate to Commissions tab (explore) with commission ID
              router.push({
                pathname: '/(tabs)/explore',
                params: { commissionId: commission.id }
              });
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.compactCommissionIcon}>
            <Ionicons name="briefcase" size={18} color={colors.primary} />
          </View>
          <View style={styles.compactCommissionContent}>
            <Text style={styles.compactCommissionTitle}>Commission Request</Text>
            <Text style={styles.compactCommissionSubtitle}>Tap to view details</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.text.disabled} />
        </TouchableOpacity>
      </>
    );
  };

  const renderMessage = React.useCallback(({ item, index }) => {
    if (item.message_type === 'commission_request') {
      return renderCommissionRequest(item, index);
    }

    if (item.message_type === 'progress_update') {
      return renderProgressUpdate(item, index);
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
              onPress={() => {
                // Open full screen image viewer
                setSelectedImageForViewer(item.image_url);
                setShowImageViewer(true);
              }}
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
  }, [messages, user, progressUpdates, handleDeleteMessage, renderCommissionRequest, renderProgressUpdate, renderDayHeader, shouldShowDayHeader]);

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
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {commission && (
                <>
                  {/* Commission Status */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Status</Text>
                    <View style={styles.statusBadgeContainer}>
                      <View style={[
                        styles.statusBadge,
                        commission.status === 'completed' && styles.statusBadgeSuccess,
                        commission.status === 'in_progress' && styles.statusBadgeWarning,
                        commission.status === 'pending' && styles.statusBadgeInfo,
                        commission.status === 'cancelled' && styles.statusBadgeError,
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {commission.status === 'in_progress' ? 'In Progress' :
                           commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Commission Details */}
                  {commission.details && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Details</Text>
                      <Text style={styles.modalValue}>{commission.details}</Text>
                    </View>
                  )}

                  {commission.client_note && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Client Notes</Text>
                      <Text style={styles.modalValue}>{commission.client_note}</Text>
                    </View>
                  )}

                  {commission.budget && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Budget</Text>
                      <Text style={styles.modalValue}>${commission.budget}</Text>
                    </View>
                  )}

                  {commission.final_price && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Final Price</Text>
                      <Text style={styles.modalValue}>${commission.final_price}</Text>
                    </View>
                  )}

                  {commission.deadline_text && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Deadline</Text>
                      <Text style={styles.modalValue}>{commission.deadline_text}</Text>
                    </View>
                  )}

                  {/* Progress Updates */}
                  {progressUpdates.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Progress Updates ({progressUpdates.length})</Text>
                      <View style={styles.progressList}>
                        {progressUpdates.slice(0, 3).map((update, idx) => (
                          <View key={update.id} style={styles.progressItem}>
                            <Ionicons
                              name={
                                update.update_type === 'wip_image' ? 'image-outline' :
                                update.update_type === 'approval_checkpoint' ? 'checkmark-circle-outline' :
                                'refresh-outline'
                              }
                              size={16}
                              color={colors.primary}
                            />
                            <Text style={styles.progressItemText}>
                              {update.update_type === 'wip_image' ? 'WIP Update' :
                               update.update_type === 'approval_checkpoint' ? 'Approval Checkpoint' :
                               `Revision #${update.revision_number}`}
                            </Text>
                          </View>
                        ))}
                        {progressUpdates.length > 3 && (
                          <Text style={styles.progressMoreText}>
                            +{progressUpdates.length - 3} more in chat
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Payment Information */}
                  {/* Escrow Status */}
                  {commission.escrow_status && (
                    <View style={styles.modalSection}>
                      <EscrowStatus
                        commission={commission}
                        isClient={commission.client_id === user?.id}
                        onRelease={async () => {
                          try {
                            await axios.post(
                              `${API_URL}/payments/release-escrow`,
                              { commissionId: commission.id },
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            await fetchConversationDetails();
                            Toast.show({
                              type: 'success',
                              text1: 'Success',
                              text2: 'Funds released to artist',
                            });
                          } catch (error) {
                            console.error('Error releasing escrow:', error);
                            Toast.show({
                              type: 'error',
                              text1: 'Error',
                              text2: error.response?.data?.error || 'Failed to release funds',
                            });
                          }
                        }}
                      />
                    </View>
                  )}

                  {/* Milestone Tracker */}
                  {commission.payment_type === 'milestone' && (
                    <View style={styles.modalSection}>
                      <MilestoneTracker
                        commissionId={commission.id}
                        isClient={commission.client_id === user?.id}
                        onPayMilestone={async (milestone) => {
                          setPaymentData({
                            commissionId: commission.id,
                            amount: milestone.amount,
                            paymentType: 'milestone',
                            milestoneId: milestone.id,
                          });
                          setShowDetailsModal(false);
                          setShowPayPalCheckout(true);
                        }}
                      />
                    </View>
                  )}

                  {/* Payment Options for Pending Commissions */}
                  {commission.status === 'pending' && commission.client_id === user?.id && (
                    <View style={styles.modalSection}>
                      <TouchableOpacity
                        style={styles.paymentButton}
                        onPress={() => {
                          setShowDetailsModal(false);
                          setShowPaymentOptions(true);
                        }}
                      >
                        <Ionicons name="card-outline" size={20} color={colors.text.primary} />
                        <Text style={styles.paymentButtonText}>Make Payment</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Transaction History */}
                  {commission.payment_status && commission.payment_status !== 'unpaid' && (
                    <View style={styles.modalSection}>
                      <TransactionHistory commissionId={commission.id} />
                    </View>
                  )}

                  {/* Tip Jar for Completed Commissions */}
                  {commission.status === 'completed' && commission.client_id === user?.id && (
                    <View style={styles.modalSection}>
                      <TouchableOpacity
                        style={styles.tipButton}
                        onPress={() => {
                          setShowDetailsModal(false);
                          setShowTipJar(true);
                        }}
                      >
                        <Ionicons name="heart" size={20} color={colors.status.error} />
                        <Text style={styles.tipButtonText}>Tip Artist</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

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

      {/* References Modal */}
      <Modal
        visible={showReferences}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowReferences(false)}
      >
        {commission && (
          <ReferenceBoard
            commissionId={commission.id}
            onReferenceAdded={() => {
              // Optionally refresh conversation details
            }}
            onReferenceRemoved={() => {
              // Optionally refresh conversation details
            }}
            onClose={() => setShowReferences(false)}
          />
        )}
      </Modal>

      {/* Revision Markup Modal */}
      <Modal
        visible={showRevisionModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setShowRevisionModal(false);
          setRevisionImage(null);
          setRevisionNotes('');
          setMarkupPaths([]);
        }}
      >
        <View style={styles.revisionModalContainer}>
          <View style={styles.revisionModalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowRevisionModal(false);
                setRevisionImage(null);
                setRevisionNotes('');
                setMarkupPaths([]);
              }}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.revisionModalTitle}>Request Revision</Text>
            <TouchableOpacity onPress={handleSubmitRevision}>
              <Text style={styles.revisionModalSubmit}>Submit</Text>
            </TouchableOpacity>
          </View>
          
          {revisionImage && (
            <View style={styles.revisionImageContainer}>
              <Image
                source={{ uri: revisionImage }}
                style={styles.revisionImage}
                contentFit="contain"
              />
              <View style={styles.revisionMarkupOverlay} pointerEvents="box-none">
                {/* Simple markup instructions */}
                <View style={styles.markupInstructions}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.text.secondary} />
                  <Text style={styles.markupInstructionsText}>
                    Tap and drag to mark areas that need changes
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.revisionNotesContainer}>
            <Text style={styles.revisionNotesLabel}>Revision Notes</Text>
            <TextInput
              style={styles.revisionNotesInput}
              value={revisionNotes}
              onChangeText={setRevisionNotes}
              placeholder="Describe what needs to be changed..."
              placeholderTextColor={colors.text.disabled}
              multiline
              maxLength={500}
            />
          </View>
        </View>
      </Modal>

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
                // Navigate with a small delay to ensure smooth transition
                setTimeout(() => {
                  if (otherUser.artists) {
                    router.push(`/artist/${otherUser.artists.id}`);
                  } else {
                    router.push(`/client/${otherUser.id}`);
                  }
                }, 50);
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
          {commission && (
            <TouchableOpacity
              style={styles.referencesButton}
              onPress={() => setShowReferences(true)}
            >
              <Ionicons name="images-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item.id || `msg-${index}`}
          removeClippedSubviews={true}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          initialNumToRender={20}
          windowSize={10}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
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

        {/* Progress Actions Menu */}
        {showProgressActions && commission && commission.status === 'in_progress' && (
          <View style={styles.progressActionsMenu}>
            {commission.artist_id === user?.id && (
              <>
                <TouchableOpacity style={styles.progressActionButton} onPress={handleWIPUpload}>
                  <Ionicons name="image-outline" size={20} color={colors.primary} />
                  <Text style={styles.progressActionText}>Share WIP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.progressActionButton} onPress={handleApprovalCheckpoint}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.status.warning} />
                  <Text style={styles.progressActionText}>Request Approval</Text>
                </TouchableOpacity>
              </>
            )}
            {commission.client_id === user?.id && (
              <TouchableOpacity style={styles.progressActionButton} onPress={handleRequestRevision}>
                <Ionicons name="refresh-outline" size={20} color={colors.status.warning} />
                <Text style={styles.progressActionText}>Request Revision</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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
          {commission && commission.status === 'in_progress' && (
            <TouchableOpacity 
              style={styles.progressButton} 
              onPress={() => setShowProgressActions(!showProgressActions)}
            >
              <Ionicons name="layers-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
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

      {/* Payment Options Modal */}
      <PaymentOptions
        visible={showPaymentOptions}
        onClose={() => setShowPaymentOptions(false)}
        commission={commission}
        onProceed={(paymentData) => {
          // Calculate amount based on payment type
          let amount = commission.final_price || commission.total_price || 0;
          if (paymentData.paymentType === 'deposit' && paymentData.depositPercentage) {
            amount = amount * (paymentData.depositPercentage / 100);
          }
          
          setPaymentData({
            ...paymentData,
            commissionId: commission.id,
            amount,
          });
          setShowPaymentOptions(false);
          setShowPayPalCheckout(true);
        }}
      />

      {/* PayPal Checkout Modal */}
      {paymentData && (
        <PayPalCheckout
          visible={showPayPalCheckout}
          onClose={() => {
            setShowPayPalCheckout(false);
            setPaymentData(null);
          }}
          commissionId={paymentData.commissionId}
          amount={paymentData.amount}
          paymentType={paymentData.paymentType}
          onSuccess={(data) => {
            setShowPayPalCheckout(false);
            setPaymentData(null);
            fetchConversationDetails();
            fetchMessages();
          }}
          onError={(error) => {
            console.error('Payment error:', error);
          }}
        />
      )}

      {/* Image Viewer Modal */}
      {selectedImageForViewer && (
        <Modal
          visible={showImageViewer}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            setShowImageViewer(false);
            setSelectedImageForViewer(null);
          }}
        >
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => {
                setShowImageViewer(false);
                setSelectedImageForViewer(null);
              }}
            >
              <Ionicons name="close" size={32} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.imageViewerPage}>
              <Image
                source={{ uri: selectedImageForViewer }}
                style={styles.fullImage}
                contentFit="contain"
              />
            </View>
          </View>
        </Modal>
      )}
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
    backgroundColor: colors.background, // Ensure background during animation
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
  // Compact commission request card
  compactCommissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '85%',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    ...shadows.small,
  },
  compactCommissionCardReceived: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08',
  },
  compactCommissionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCommissionContent: {
    flex: 1,
  },
  compactCommissionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactCommissionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
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
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  paymentButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.error + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  tipButtonText: {
    ...typography.bodyBold,
    color: colors.status.error,
  },
  modalSection: {
    marginBottom: spacing.lg,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.text.disabled + '20',
  },
  statusBadgeSuccess: {
    backgroundColor: colors.status.success + '20',
  },
  statusBadgeWarning: {
    backgroundColor: colors.status.warning + '20',
  },
  statusBadgeInfo: {
    backgroundColor: colors.primary + '20',
  },
  statusBadgeError: {
    backgroundColor: colors.status.error + '20',
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
  },
  progressItemText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
  },
  progressMoreText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.xs,
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
  // Progress Updates
  progressUpdateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressUpdateCardOwn: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary + '40',
  },
  progressUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressUpdateTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
  },
  progressUpdateImage: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  approvalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  approveButton: {
    backgroundColor: colors.status.success,
  },
  rejectButton: {
    backgroundColor: colors.status.error,
  },
  approvalButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
  },
  approvalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  approvalStatusText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
  },
  revisionNotes: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    marginTop: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
  },
  // Progress Actions Menu
  progressActionsMenu: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressActionText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 13,
  },
  progressButton: {
    width: IS_SMALL_SCREEN ? 36 : 40,
    height: IS_SMALL_SCREEN ? 36 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
  },
  // Revision Modal
  revisionModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  revisionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: STATUS_BAR_HEIGHT + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  revisionModalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
  },
  referencesButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  referencesModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  referencesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  referencesModalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  revisionModalSubmit: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
  },
  revisionImageContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  revisionImage: {
    width: '100%',
    height: '100%',
  },
  revisionMarkupOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  markupInstructions: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background + 'E6',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  markupInstructionsText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    flex: 1,
  },
  revisionNotesContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  revisionNotesLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  revisionNotesInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    maxHeight: 150,
    textAlignVertical: 'top',
  },
  // Image Viewer Styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
