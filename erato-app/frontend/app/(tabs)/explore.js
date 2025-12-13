import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import ReviewModal from '../../components/ReviewModal';
import ProgressTracker from '../../components/ProgressTracker';
import MilestoneTracker from '../../components/MilestoneTracker';
import EscrowStatus from '../../components/EscrowStatus';
import PayPalCheckout from '../../components/PayPalCheckout';
import PaymentOptions from '../../components/PaymentOptions';
import TransactionHistory from '../../components/TransactionHistory';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

// Commission Files Tab Component
function CommissionFilesTab({ commissionId, token, isArtist }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, [commissionId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      // Get all progress updates with images
      const response = await axios.get(
        `${API_URL}/commissions/${commissionId}/progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updates = response.data.updates || [];
      
      // Extract all images from progress updates
      const allFiles = [];
      updates.forEach(update => {
        if (update.images && update.images.length > 0) {
          update.images.forEach((imageUrl, index) => {
            allFiles.push({
              id: `${update.id}-${index}`,
              url: imageUrl,
              type: 'image',
              createdAt: update.created_at,
              note: update.note,
              updateId: update.id,
            });
          });
        }
      });
      
      setFiles(allFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load files',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.filesTabContent}>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Loading files...</Text>
        </View>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <ScrollView 
        contentContainerStyle={styles.filesEmptyContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No Files Yet</Text>
          <Text style={styles.emptyText}>
            Progress updates and deliverables will appear here
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={styles.filesTabContent}
      contentContainerStyle={styles.filesGrid}
      showsVerticalScrollIndicator={false}
    >
      {files.map((file) => (
        <TouchableOpacity
          key={file.id}
          style={styles.fileCard}
          onPress={() => {
            // TODO: Open image viewer
            Toast.show({
              type: 'info',
              text1: 'Image Viewer',
              text2: 'Full screen viewer coming soon',
              visibilityTime: 2000,
            });
          }}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: file.url }}
            style={styles.fileImage}
            contentFit="cover"
          />
          {file.note && (
            <View style={styles.fileNoteOverlay}>
              <Text style={styles.fileNoteText} numberOfLines={2}>{file.note}</Text>
            </View>
          )}
          <View style={styles.fileDateBadge}>
            <Text style={styles.fileDateText}>
              {new Date(file.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function CommissionDashboard() {
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const isArtist = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [artistCache, setArtistCache] = useState({});
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode] = useState('list'); // Always use list view
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [noteCommissionId, setNoteCommissionId] = useState(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedCommissions, setSelectedCommissions] = useState(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  const [showTransactionHistoryModal, setShowTransactionHistoryModal] = useState(false);
  const [transactionHistoryCommissionId, setTransactionHistoryCommissionId] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [engagementMetrics, setEngagementMetrics] = useState(null);
  const [loadingEngagement, setLoadingEngagement] = useState(false);
  const [detailTab, setDetailTab] = useState('details'); // details, progress, files
  const [updatingStatus, setUpdatingStatus] = useState(new Set()); // Track which commissions are being updated
  const [showPayPalCheckout, setShowPayPalCheckout] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadCommissions();
        if (isArtist) {
          loadTemplates();
        } else {
          calculateTotalSpent(); // Now async, calculates from actual transactions
        }
      }
    }, [token, user?.user_type, user?.artists])
  );

  // Handle incoming commissionId from navigation params (only once, not on every load)
  const hasOpenedCommissionRef = useRef(false);
  useEffect(() => {
    // Reset ref when component unmounts or when navigating away
    return () => {
      hasOpenedCommissionRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (params.commissionId && commissions.length > 0 && !hasOpenedCommissionRef.current && !showCommissionModal) {
      const commission = commissions.find(c => c.id === params.commissionId);
      if (commission) {
        setSelectedCommission(commission);
        setShowCommissionModal(true);
        setDetailTab('details');
        hasOpenedCommissionRef.current = true;
      }
    }
  }, [params.commissionId, commissions, showCommissionModal]);

  const loadCommissions = async () => {
    if (!token) return;
    setCommissionsLoading(true);
    try {
      const type = isArtist ? 'received' : 'sent';
      const response = await axios.get(`${API_URL}/commissions?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCommissions = response.data.commissions || [];
      
      // Debug: Log commission data structure
      if (allCommissions.length > 0) {
        console.log('Sample commission data:', JSON.stringify(allCommissions[0], null, 2));
      }

      // Fetch missing artist data
      const missingArtistIds = allCommissions
        .filter(c => !isArtist && c.artist_id && !c.artist?.users)
        .map(c => c.artist_id);

      if (missingArtistIds.length > 0 && !isArtist) {
        const artistPromises = missingArtistIds.map(async (artistId) => {
          try {
            const artistResponse = await axios.get(`${API_URL}/artists/${artistId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (artistResponse.data?.users) {
              return { artistId, userData: artistResponse.data.users };
            }
          } catch (error) {
            console.warn(`Failed to fetch artist ${artistId}:`, error);
          }
          return null;
        });

        const artistDataResults = await Promise.all(artistPromises);
        const newCache = { ...artistCache };
        artistDataResults.forEach(result => {
          if (result) {
            newCache[result.artistId] = result.userData;
          }
        });
        setArtistCache(newCache);
      }

      const sorted = [...allCommissions].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setCommissions(sorted);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error loading commissions:', error);
      setCommissions([]);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const loadTemplates = async () => {
    // TODO: Fetch from backend
    setTemplates([
      { id: '1', title: 'Accepted', message: 'Thank you! I\'d love to work on this. Let\'s discuss the details!' },
      { id: '2', title: 'More Info', message: 'Thanks for your interest! Could you provide more details about what you\'re looking for?' },
      { id: '3', title: 'Declined', message: 'Thank you for reaching out, but I\'m unable to take on this project at this time.' },
    ]);
  };

  const calculateTotalSpent = async () => {
    if (!token || isArtist) {
      setTotalSpent(0);
      return;
    }
    
    try {
      // Calculate from actual payment transactions, not commission prices
      const response = await axios.get(`${API_URL}/payments/user/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Backend returns { success: true, data: [...] }
      const transactions = response.data.data || [];
      // Sum all successful transactions (status = 'completed' or 'succeeded')
      const total = transactions
        .filter(t => t.status === 'completed' || t.status === 'succeeded')
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      setTotalSpent(total);
    } catch (error) {
      console.error('Error calculating total spent:', error);
      // Fallback to commission prices if transactions fail
      const total = commissions
        .filter(c => c.final_price && (c.status === 'completed' || c.status === 'in_progress'))
        .reduce((sum, c) => sum + parseFloat(c.final_price || 0), 0);
      setTotalSpent(total);
    }
  };

  const loadAllTransactions = async () => {
    if (!token) return;
    setLoadingTransactions(true);
    try {
      // API_URL already includes /api (e.g., https://api.verrocio.com/api)
      // Use the same pattern as other API calls like /commissions
      const response = await axios.get(`${API_URL}/payments/user/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTransactions(response.data.data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load transaction history',
      });
      setAllTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadEngagementMetrics = async () => {
    if (!token || !isArtist) return;

    setLoadingEngagement(true);
    try {
      // Get the artist.id from the artists table using user_id
      const artistResponse = await axios.get(
        `${API_URL}/artists?user_id=${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Artist response:', artistResponse.data);

      const artists = artistResponse.data?.artists || artistResponse.data || [];
      if (artists.length === 0) {
        // Don't throw error - just return early if no artist profile exists
        console.log('No artist profile found - skipping engagement metrics');
        setLoadingEngagement(false);
        return;
      }

      const artistId = artists[0].id || artists[0].user_id;
      console.log('Using artistId:', artistId, 'from artists:', artists);

      if (!artistId) {
        throw new Error('Could not determine artist ID');
      }

      // Fetch engagement metrics using the artistId
      const response = await axios.get(
        `${API_URL}/engagement/artist/${artistId}/metrics`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Engagement metrics response:', response.data);

      if (response.data?.success && response.data?.data) {
        // Map backend response to frontend format
        const metrics = response.data.data;
        setEngagementMetrics({
          total_artworks: metrics.total_artworks || 0,
          total_views: metrics.total_views || 0,
          total_clicks: metrics.total_clicks || 0,
          total_likes: metrics.total_likes || 0, // Backend doesn't return likes separately, use 0
          total_saves: metrics.total_saves || 0,
          total_shares: metrics.total_shares || 0,
          total_commission_inquiries: metrics.total_commission_inquiries || 0,
          average_engagement_score: metrics.average_engagement_score || 0,
          top_artworks: metrics.top_artworks || [],
        });
      } else if (response.data?.data) {
        // Handle case where success flag might be missing but data exists
        const metrics = response.data.data;
        setEngagementMetrics({
          total_artworks: metrics.total_artworks || 0,
          total_views: metrics.total_views || 0,
          total_clicks: metrics.total_clicks || 0,
          total_likes: metrics.total_likes || 0,
          total_saves: metrics.total_saves || 0,
          total_shares: metrics.total_shares || 0,
          total_commission_inquiries: metrics.total_commission_inquiries || 0,
          average_engagement_score: metrics.average_engagement_score || 0,
          top_artworks: metrics.top_artworks || [],
        });
      } else {
        console.error('Invalid response format:', response.data);
        throw new Error('Invalid response format from engagement metrics endpoint');
      }
    } catch (error) {
      console.error('Error loading engagement metrics:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack,
      });
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load engagement metrics';
      
      // If it's a 403 error or artist not found, show helpful message
      if (error.response?.status === 403 || error.message.includes('No artist profile')) {
        Toast.show({
          type: 'info',
          text1: 'No Metrics Yet',
          text2: 'Complete your artist profile to start tracking engagement',
          visibilityTime: 3000,
        });
        // Set empty metrics
        setEngagementMetrics({
          total_artworks: 0,
          total_views: 0,
          total_clicks: 0,
          total_likes: 0,
          total_saves: 0,
          total_shares: 0,
          total_commission_inquiries: 0,
          average_engagement_score: 0,
          top_artworks: [],
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
          visibilityTime: 3000,
        });
        // Set empty metrics on error so UI doesn't break
        setEngagementMetrics({
          total_artworks: 0,
          total_views: 0,
          total_clicks: 0,
          total_likes: 0,
          total_saves: 0,
          total_shares: 0,
          total_commission_inquiries: 0,
          average_engagement_score: 0,
          top_artworks: [],
        });
      }
    } finally {
      setLoadingEngagement(false);
    }
  };

  const loadClientEngagementMetrics = async () => {
    if (!token || isArtist) return;
    
    setLoadingEngagement(true);
    try {
      // Get client's engagement history
      const historyResponse = await axios.get(
        `${API_URL}/engagement/user/history`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        }
      );
      
      const engagements = historyResponse.data.data || [];
      
      // Calculate statistics
      const stats = {
        total_views: engagements.filter(e => e.engagement_type === 'view').length,
        total_clicks: engagements.filter(e => e.engagement_type === 'click').length,
        total_likes: engagements.filter(e => e.engagement_type === 'like').length,
        total_saves: engagements.filter(e => e.engagement_type === 'save').length,
        total_shares: engagements.filter(e => e.engagement_type === 'share').length,
        total_commission_inquiries: engagements.filter(e => e.engagement_type === 'commission_inquiry').length,
        unique_artworks: new Set(engagements.map(e => e.artwork_id)).size,
        unique_artists: new Set(engagements.map(e => e.artwork?.artist_id).filter(Boolean)).size,
      };

      // Get most engaged artworks
      const artworkEngagementCounts = {};
      engagements.forEach(e => {
        if (!artworkEngagementCounts[e.artwork_id]) {
          artworkEngagementCounts[e.artwork_id] = {
            artwork_id: e.artwork_id,
            artwork: e.artwork,
            count: 0,
            types: new Set()
          };
        }
        artworkEngagementCounts[e.artwork_id].count++;
        artworkEngagementCounts[e.artwork_id].types.add(e.engagement_type);
      });

      const topArtworks = Object.values(artworkEngagementCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(item => ({
          artwork_id: item.artwork_id,
          title: item.artwork?.title || 'Untitled',
          image_url: item.artwork?.image_url || item.artwork?.thumbnail_url,
          engagement_count: item.count,
          engagement_types: Array.from(item.types)
        }));

      setEngagementMetrics({
        ...stats,
        top_artworks: topArtworks,
        recent_engagements: engagements.slice(0, 10)
      });
    } catch (error) {
      console.error('Error loading client engagement metrics:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load engagement metrics',
        visibilityTime: 2000,
      });
    } finally {
      setLoadingEngagement(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCommissions();
    if (isArtist) {
      await loadTemplates();
    } else {
      calculateTotalSpent();
    }
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return colors.primary;
      case 'accepted': return colors.status.success;
      case 'declined': return colors.status.error;
      case 'in_progress': return colors.status.info;
      case 'completed': return colors.status.success;
      case 'cancelled': return colors.text.disabled;
      default: return colors.text.secondary;
    }
  };

  const formatStatus = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'declined': return 'Declined';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default:
        return status
          ? status.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          : 'Status';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'accepted': return 'checkmark-circle-outline';
      case 'declined': return 'close-circle-outline';
      case 'in_progress': return 'hourglass-outline';
      case 'completed': return 'checkmark-done-circle-outline';
      case 'cancelled': return 'ban-outline';
      default: return 'help-circle-outline';
    }
  };


  const commissionStats = {
    pending: commissions.filter(c => c.status === 'pending').length,
    in_progress: commissions.filter(c => c.status === 'in_progress' || c.status === 'accepted').length,
    completed: commissions.filter(c => c.status === 'completed').length,
    total: commissions.length,
    totalRevenue: commissions
      .filter(c => c.status === 'completed' && c.final_price)
      .reduce((sum, c) => sum + parseFloat(c.final_price || 0), 0),
  };

  const filteredCommissions = selectedFilter === 'all'
    ? commissions
    : selectedFilter === 'active'
    ? commissions.filter(c => c.status === 'in_progress' || c.status === 'accepted')
    : commissions.filter(c => c.status === selectedFilter);

  const handleUpdateStatus = async (commissionId, newStatus, closeModal = false) => {
    // Prevent multiple simultaneous updates
    if (updatingStatus.has(commissionId)) {
      return;
    }

    try {
      setUpdatingStatus(prev => new Set(prev).add(commissionId));

      // Find commission to get artwork_id for engagement tracking
      const commission = commissions.find(c => c.id === commissionId);

      // Update commission status via API
      await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Close modal immediately if requested (before heavy operations)
      if (closeModal) {
        setShowCommissionModal(false);
        setSelectedCommission(null);
      }

      // Show success message after a brief delay to ensure modal closes first
      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Commission ${formatStatus(newStatus).toLowerCase()}`,
          visibilityTime: 2000,
        });
      }, 100);

      // Track engagement metrics if artwork exists (fire-and-forget, don't block UI)
      if (commission?.artwork_id && token) {
        const engagementType = newStatus === 'accepted' || newStatus === 'in_progress' 
          ? 'commission_inquiry' 
          : null;
        
        if (engagementType) {
          // Don't await - fire and forget to prevent blocking
          setTimeout(() => {
            axios.post(
              `${API_URL}/engagement/track`,
              {
                artwork_id: commission.artwork_id,
                engagement_type: engagementType,
                metadata: {
                  commission_id: commissionId,
                  action: newStatus === 'accepted' || newStatus === 'in_progress' ? 'accepted' : 'declined',
                  source: 'commission_management'
                }
              },
              { headers: { Authorization: `Bearer ${token}` } }
            ).catch((engagementError) => {
              // Fail silently - don't disrupt user experience
              console.warn('Failed to track engagement:', engagementError);
            });
          }, 200);
        }
      }

      // Reload commissions in background (don't await to prevent blocking)
      // Use longer delay to ensure UI is responsive first
      setTimeout(() => {
        loadCommissions().catch((error) => {
          console.warn('Error reloading commissions:', error);
        });
      }, 300);
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update status';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        visibilityTime: 3000,
      });
    } finally {
      // Clear updating status after a short delay to allow UI to update
      setTimeout(() => {
        setUpdatingStatus(prev => {
          const next = new Set(prev);
          next.delete(commissionId);
          return next;
        });
      }, 50);
    }
  };

  const handleBatchAction = async (action) => {
    if (selectedCommissions.size === 0) {
      Toast.show({
        type: 'info',
        text1: 'No Selection',
        text2: 'Please select commissions first',
        visibilityTime: 2000,
      });
      return;
    }

    showAlert({
      title: `${action} ${selectedCommissions.size} commissions?`,
      message: 'This action will be applied to all selected commissions.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              const promises = Array.from(selectedCommissions).map(id =>
                axios.patch(
                  `${API_URL}/commissions/${id}/status`,
                  { status: action.toLowerCase() },
                  { headers: { Authorization: `Bearer ${token}` } }
                )
              );
              await Promise.all(promises);
              await loadCommissions();
              setSelectedCommissions(new Set());
              setBatchMode(false);
              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: `${selectedCommissions.size} commissions updated`,
                visibilityTime: 2000,
              });
            } catch (error) {
              console.error('Batch action error:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to update some commissions',
                visibilityTime: 2000,
              });
            }
          }
        }
      ]
    });
  };

  const toggleCommissionSelection = (id) => {
    const newSet = new Set(selectedCommissions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCommissions(newSet);
  };

  const loadNote = async (commissionId) => {
    try {
      const response = await axios.get(
        `${API_URL}/commissions/${commissionId}/notes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCurrentNote(response.data.note || '');
    } catch (error) {
      console.error('Error loading note:', error);
      setCurrentNote('');
    }
  };

  const saveNote = async () => {
    if (!noteCommissionId || !currentNote.trim()) return;

    try {
      await axios.post(
        `${API_URL}/commissions/${noteCommissionId}/notes`,
        { note: currentNote.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Note Saved',
        text2: 'Client note saved successfully',
        visibilityTime: 2000,
      });

      // Reload commissions to get updated notes
      await loadCommissions();

      setShowNotesModal(false);
      setCurrentNote('');
      setNoteCommissionId(null);
    } catch (error) {
      console.error('Error saving note:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to save note',
        visibilityTime: 2000,
      });
    }
  };

  const renderKanbanCard = (item, statusColor) => {
    const otherUser = isArtist ? item.client : (item.artist?.users || artistCache[item.artist_id]);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.commissionCard,
          styles.kanbanCardMargin,
          { borderWidth: 1.5, borderColor: statusColor + '60' }
        ]}
        onPress={() => {
          setSelectedCommission(item);
          setShowCommissionModal(true);
        }}
        activeOpacity={0.95}
      >
        {/* Ultra Compact Card - Same as List View */}
        <View style={styles.compactCardContent}>
          <Image
            source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
            style={styles.compactAvatar}
            contentFit="cover"
          />
          <View style={styles.compactInfo}>
            <Text style={styles.compactUsername} numberOfLines={1}>
              {otherUser?.username || otherUser?.full_name || (isArtist ? 'Unknown Client' : 'Unknown Artist')}
            </Text>
            <View style={styles.compactMetaRow}>
              <View style={[styles.compactStatusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.compactDate}>
                {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.compactPrice}>
            {item.final_price || item.price ? (
              <Text style={styles.compactPriceText}>${item.final_price || item.price}</Text>
            ) : item.budget ? (
              <Text style={styles.compactBudgetText}>${item.budget}</Text>
            ) : null}
          </View>
          {item.status === 'pending' && isArtist && (
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={[styles.compactDeclineButton, updatingStatus.has(item.id) && styles.compactDeclineButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (updatingStatus.has(item.id)) return;
                  showAlert({
                    title: 'Decline Commission',
                    message: 'Are you sure you want to decline this commission? This action cannot be undone.',
                    type: 'warning',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Decline',
                        style: 'destructive',
                        onPress: () => {
                          handleUpdateStatus(item.id, 'declined');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
                disabled={updatingStatus.has(item.id)}
              >
                {updatingStatus.has(item.id) ? (
                  <ActivityIndicator size="small" color={colors.status.error} />
                ) : (
                  <Ionicons name="close-circle" size={20} color={colors.status.error} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.compactAcceptButton, updatingStatus.has(item.id) && styles.compactAcceptButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (updatingStatus.has(item.id)) return;
                  showAlert({
                    title: 'Accept Commission',
                    message: 'Accept this commission request?',
                    type: 'info',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Accept',
                        style: 'default',
                        onPress: () => {
                          handleUpdateStatus(item.id, 'accepted');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
                disabled={updatingStatus.has(item.id)}
              >
                {updatingStatus.has(item.id) ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderKanbanColumn = (title, status, items, icon, statusColor) => (
    <View key={status} style={styles.kanbanColumn}>
      <View style={styles.kanbanColumnHeader}>
        <View style={styles.kanbanColumnTitleRow}>
          <Ionicons name={icon} size={22} color={statusColor} />
          <Text style={styles.kanbanColumnTitle}>{title}</Text>
        </View>
        <View style={[styles.kanbanColumnBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.kanbanColumnCount, { color: statusColor }]}>
            {items.length}
          </Text>
        </View>
      </View>
      <ScrollView
        style={styles.kanbanColumnScroll}
        contentContainerStyle={styles.kanbanColumnContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        directionalLockEnabled={true}
        bounces={false}
      >
        {items.map(item => renderKanbanCard(item, statusColor))}
        {items.length === 0 && (
          <View style={styles.kanbanEmptyColumn}>
            <Ionicons name="folder-open-outline" size={40} color={colors.text.disabled} />
            <Text style={styles.kanbanEmptyText}>No {title.toLowerCase()}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderListCard = (item) => {
    const otherUser = isArtist ? item.client : (item.artist?.users || artistCache[item.artist_id]);
    const statusColor = getStatusColor(item.status);
    const isSelected = selectedCommissions.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.commissionCard,
          { borderWidth: 1.5, borderColor: statusColor + '60' },
          item.status === 'pending' && styles.pendingCommissionCard,
          isSelected && styles.selectedCommissionCard,
        ]}
        onPress={async () => {
          if (batchMode) {
            toggleCommissionSelection(item.id);
          } else {
            // Set item immediately for faster UI response
            setSelectedCommission(item);
            setShowCommissionModal(true);
            // Then fetch full commission details in background
            try {
              const response = await axios.get(`${API_URL}/commissions/${item.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setSelectedCommission(response.data);
            } catch (error) {
              console.error('Error fetching commission details:', error);
              // Keep using item data if fetch fails
            }
          }
        }}
        onLongPress={() => {
          if (isArtist) {
            setBatchMode(true);
            toggleCommissionSelection(item.id);
          }
        }}
        activeOpacity={0.95}
      >
        {batchMode && isArtist && (
          <View style={styles.selectionIndicator}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={16} color={colors.text.primary} />}
            </View>
          </View>
        )}

        {/* Ultra Compact Card - Minimal Info */}
        <View style={styles.compactCardContent}>
          <Image
            source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
            style={styles.compactAvatar}
            contentFit="cover"
          />
          <View style={styles.compactInfo}>
            <Text style={styles.compactUsername} numberOfLines={1}>
              {otherUser?.username || otherUser?.full_name || (isArtist ? 'Unknown Client' : 'Unknown Artist')}
            </Text>
            <View style={styles.compactMetaRow}>
              <View style={[styles.compactStatusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.compactDate}>
                {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={styles.compactPrice}>
            {item.final_price || item.price ? (
              <Text style={styles.compactPriceText}>${item.final_price || item.price}</Text>
            ) : item.budget ? (
              <Text style={styles.compactBudgetText}>${item.budget}</Text>
            ) : null}
          </View>
          {item.status === 'pending' && isArtist && !batchMode && (
            <View style={styles.compactActions}>
              <TouchableOpacity
                style={[styles.compactDeclineButton, updatingStatus.has(item.id) && styles.compactDeclineButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (updatingStatus.has(item.id)) return;
                  showAlert({
                    title: 'Decline Commission',
                    message: 'Are you sure you want to decline this commission? This action cannot be undone.',
                    type: 'warning',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Decline',
                        style: 'destructive',
                        onPress: () => {
                          handleUpdateStatus(item.id, 'declined');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
                disabled={updatingStatus.has(item.id)}
              >
                {updatingStatus.has(item.id) ? (
                  <ActivityIndicator size="small" color={colors.status.error} />
                ) : (
                  <Ionicons name="close-circle" size={20} color={colors.status.error} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.compactAcceptButton, updatingStatus.has(item.id) && styles.compactAcceptButtonDisabled]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (updatingStatus.has(item.id)) return;
                  showAlert({
                    title: 'Accept Commission',
                    message: 'Accept this commission request?',
                    type: 'info',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Accept',
                        style: 'default',
                        onPress: () => {
                          handleUpdateStatus(item.id, 'accepted');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
                disabled={updatingStatus.has(item.id)}
              >
                {updatingStatus.has(item.id) ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Clean Compact Header with Safe Area */}
      <View style={[styles.compactHeader, { paddingTop: Math.max(insets.top + spacing.sm, spacing.lg) }]}>
        <View style={styles.compactHeaderTop}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.compactTitle}>
              {isArtist ? 'Commissions' : 'My Commissions'}
            </Text>
            <Text style={styles.headerDescription}>
              {isArtist 
                ? 'Manage your commission requests and track progress' 
                : 'View and manage your commission requests'}
            </Text>
          </View>
        </View>

        {/* Stats Section - Above buttons */}
        <View style={styles.statsSection}>
          <View style={styles.statsCardsContainer}>
            <View style={[styles.statCardItem, styles.statCardPending]}>
              <View style={styles.statCardIconContainer}>
                <Ionicons name="time-outline" size={24} color={colors.status.warning} />
              </View>
              <View style={styles.statCardContent}>
                <Text style={styles.statCardValue}>{commissionStats.pending}</Text>
                <Text style={styles.statCardLabel}>Pending</Text>
              </View>
            </View>
            <View style={[styles.statCardItem, styles.statCardActive]}>
              <View style={styles.statCardIconContainer}>
                <Ionicons name="flash-outline" size={24} color={colors.status.info} />
              </View>
              <View style={styles.statCardContent}>
                <Text style={styles.statCardValue}>{commissionStats.in_progress}</Text>
                <Text style={styles.statCardLabel}>Active</Text>
              </View>
            </View>
            <View style={[styles.statCardItem, styles.statCardCompleted]}>
              <View style={styles.statCardIconContainer}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.status.success} />
              </View>
              <View style={styles.statCardContent}>
                <Text style={styles.statCardValue}>{commissionStats.completed}</Text>
                <Text style={styles.statCardLabel}>Completed</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons Section - Below stats */}
        <View style={styles.actionsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionsScrollContent}
          >
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowStatsModal(true)}
            >
              <Ionicons name="stats-chart" size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Stats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowEngagementModal(true);
                // Load metrics when modal opens (defer to avoid blocking UI)
                setTimeout(async () => {
                  try {
                    if (isArtist) {
                      await loadEngagementMetrics();
                    } else {
                      await loadClientEngagementMetrics();
                    }
                  } catch (error) {
                    console.error('Error loading engagement metrics:', error);
                    Toast.show({
                      type: 'error',
                      text1: 'Error',
                      text2: 'Failed to load engagement metrics',
                      visibilityTime: 2000,
                    });
                  }
                }, 100);
              }}
            >
              <Ionicons name="analytics-outline" size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Engagement</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowTransactionHistoryModal(true);
                setTransactionHistoryCommissionId(null); // Show all transactions
                loadAllTransactions();
              }}
            >
              <Ionicons name="receipt-outline" size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Transactions</Text>
            </TouchableOpacity>
            {isArtist && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowTemplatesModal(true)}
              >
                <Ionicons name="chatbox-ellipses-outline" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>Templates</Text>
              </TouchableOpacity>
            )}
            {isArtist && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/artist-settings')}
              >
                <Ionicons name="settings-outline" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>Settings</Text>
              </TouchableOpacity>
            )}
            {!isArtist && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/commission/create')}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>New Request</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Pinterest-style Filter Tabs */}
        <View style={styles.pinterestFilterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pinterestFilterContent}
          >
            {['all', 'pending', 'active', 'completed'].map((status) => {
              const isSelected = selectedFilter === status;
              const statusLabels = {
                all: 'All',
                pending: 'Pending',
                active: 'Active',
                completed: 'Completed'
              };
              return (
                <TouchableOpacity
                  key={status}
                  style={styles.pinterestFilterItem}
                  onPress={() => setSelectedFilter(status)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.pinterestFilterText,
                    isSelected && styles.pinterestFilterTextActive
                  ]}>
                    {statusLabels[status]}
                  </Text>
                  {isSelected && <View style={styles.pinterestFilterUnderline} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {batchMode && isArtist && (
        <View style={styles.batchActionsBar}>
          <Text style={styles.batchSelectedText}>{selectedCommissions.size} selected</Text>
          <View style={styles.batchActions}>
            <TouchableOpacity
              style={[styles.batchActionButton, styles.acceptBatchButton]}
              onPress={() => handleBatchAction('accepted')}
            >
              <Ionicons name="checkmark" size={18} color={colors.text.primary} />
              <Text style={styles.batchActionText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.batchActionButton, styles.declineBatchButton]}
              onPress={() => handleBatchAction('declined')}
            >
              <Ionicons name="close" size={18} color={colors.text.primary} />
              <Text style={styles.batchActionText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {commissionsLoading && commissions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading commissions...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCommissions}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.listContent,
            filteredCommissions.length === 0 && { flexGrow: 1, justifyContent: 'center' },
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + (batchMode ? 140 : 80) }
          ]}
          renderItem={({ item }) => renderListCard(item)}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptyTitle}>No Commissions</Text>
              <Text style={styles.emptyText}>
                {isArtist
                  ? 'You haven\'t received any requests yet.'
                  : 'You haven\'t sent any requests yet.'}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Statistics Modal */}
      <Modal
        visible={showStatsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Statistics</Text>
              <TouchableOpacity
                onPress={() => setShowStatsModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statsContent} showsVerticalScrollIndicator={false}>
              {/* Overview Stats */}
              <View style={styles.statsSection}>
                <Text style={styles.statsSectionTitle}>Overview</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{commissionStats.total}</Text>
                    <Text style={styles.statBoxLabel}>Total</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{commissionStats.pending}</Text>
                    <Text style={styles.statBoxLabel}>Pending</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{commissionStats.in_progress}</Text>
                    <Text style={styles.statBoxLabel}>Active</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>{commissionStats.completed}</Text>
                    <Text style={styles.statBoxLabel}>Completed</Text>
                  </View>
                </View>
              </View>

              {/* Financial Stats */}
              {isArtist ? (
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Revenue</Text>
                  <View style={styles.statCard}>
                    <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                      <Text style={styles.statCardLabel}>Total Revenue</Text>
                      <Text style={styles.statCardValue}>${commissionStats.totalRevenue.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>Average per Commission</Text>
                      <Text style={styles.statCardValue}>
                        ${commissionStats.completed > 0 
                          ? (commissionStats.totalRevenue / commissionStats.completed).toFixed(2)
                          : '0.00'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Spending</Text>
                  <View style={styles.statCard}>
                    <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                      <Text style={styles.statCardLabel}>Total Spent</Text>
                      <Text style={styles.statCardValue}>${totalSpent.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>Average per Commission</Text>
                      <Text style={styles.statCardValue}>
                        ${commissions.length > 0 
                          ? (totalSpent / commissions.length).toFixed(2)
                          : '0.00'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Performance Metrics */}
              {isArtist && (
                <View style={styles.statsSection}>
                  <Text style={styles.statsSectionTitle}>Performance</Text>
                  <View style={styles.statCard}>
                    <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                      <Text style={styles.statCardLabel}>Completion Rate</Text>
                      <Text style={styles.statCardValue}>
                        {commissionStats.total > 0 
                          ? ((commissionStats.completed / commissionStats.total) * 100).toFixed(1)
                          : '0'}%
                      </Text>
                    </View>
                    <View style={styles.statCardRow}>
                      <Text style={styles.statCardLabel}>Active Rate</Text>
                      <Text style={styles.statCardValue}>
                        {commissionStats.total > 0 
                          ? ((commissionStats.in_progress / commissionStats.total) * 100).toFixed(1)
                          : '0'}%
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Engagement Analytics Modal */}
      <Modal
        visible={showEngagementModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEngagementModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isArtist ? 'Engagement Analytics' : 'My Engagement Activity'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowEngagementModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statsContent} showsVerticalScrollIndicator={false}>
              {loadingEngagement ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading metrics...</Text>
                </View>
              ) : engagementMetrics ? (
                <>
                  {/* Overview Stats */}
                  <View style={styles.statsSection}>
                    <Text style={styles.statsSectionTitle}>Overview</Text>
                    <View style={styles.statsGrid}>
                      {isArtist ? (
                        <>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxValue}>{engagementMetrics.total_artworks || 0}</Text>
                            <Text style={styles.statBoxLabel}>Artworks</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxValue}>
                              {engagementMetrics.average_engagement_score?.toFixed(1) || '0.0'}
                            </Text>
                            <Text style={styles.statBoxLabel}>Avg Score</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxValue}>{engagementMetrics.unique_artworks || 0}</Text>
                            <Text style={styles.statBoxLabel}>Artworks Viewed</Text>
                          </View>
                          <View style={styles.statBox}>
                            <Text style={styles.statBoxValue}>{engagementMetrics.unique_artists || 0}</Text>
                            <Text style={styles.statBoxLabel}>Artists Discovered</Text>
                          </View>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Engagement Metrics */}
                  <View style={styles.statsSection}>
                    <Text style={styles.statsSectionTitle}>
                      {isArtist ? 'Engagement Metrics' : 'My Activity'}
                    </Text>
                    <View style={styles.statCard}>
                      <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                        <Text style={styles.statCardLabel}>Views</Text>
                        <Text style={styles.statCardValue}>{engagementMetrics.total_views || 0}</Text>
                      </View>
                      {isArtist && (
                        <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                          <Text style={styles.statCardLabel}>Clicks</Text>
                          <Text style={styles.statCardValue}>{engagementMetrics.total_clicks || 0}</Text>
                        </View>
                      )}
                      <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                        <Text style={styles.statCardLabel}>Likes</Text>
                        <Text style={styles.statCardValue}>{engagementMetrics.total_likes || 0}</Text>
                      </View>
                      <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                        <Text style={styles.statCardLabel}>Saves</Text>
                        <Text style={styles.statCardValue}>{engagementMetrics.total_saves || 0}</Text>
                      </View>
                      {isArtist && (
                        <View style={[styles.statCardRow, styles.statCardRowWithBorder]}>
                          <Text style={styles.statCardLabel}>Shares</Text>
                          <Text style={styles.statCardValue}>{engagementMetrics.total_shares || 0}</Text>
                        </View>
                      )}
                      <View style={styles.statCardRow}>
                        <Text style={styles.statCardLabel}>
                          {isArtist ? 'Commission Inquiries' : 'Inquiries Sent'}
                        </Text>
                        <Text style={styles.statCardValue}>
                          {engagementMetrics.total_commission_inquiries || 0}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Top Artworks */}
                  {engagementMetrics.top_artworks && engagementMetrics.top_artworks.length > 0 && (
                    <View style={styles.statsSection}>
                      <Text style={styles.statsSectionTitle}>
                        {isArtist ? 'Top Performing Artworks' : 'Most Engaged Artworks'}
                      </Text>
                      {engagementMetrics.top_artworks.map((artwork, index) => (
                        <TouchableOpacity
                          key={artwork.artwork_id}
                          style={styles.topArtworkCard}
                          onPress={() => {
                            setShowEngagementModal(false);
                            router.push(`/artwork/${artwork.artwork_id}`);
                          }}
                        >
                          <Image
                            source={{ uri: artwork.image_url }}
                            style={styles.topArtworkImage}
                            contentFit="cover"
                          />
                          <View style={styles.topArtworkInfo}>
                            <Text style={styles.topArtworkTitle} numberOfLines={1}>
                              {artwork.title || `Artwork #${index + 1}`}
                            </Text>
                            <View style={styles.topArtworkStats}>
                              {isArtist ? (
                                <>
                                  <View style={styles.topArtworkStatItem}>
                                    <Ionicons name="eye-outline" size={14} color={colors.text.secondary} />
                                    <Text style={styles.topArtworkStatText}>{artwork.total_views || 0}</Text>
                                  </View>
                                  <View style={styles.topArtworkStatItem}>
                                    <Ionicons name="bookmark-outline" size={14} color={colors.text.secondary} />
                                    <Text style={styles.topArtworkStatText}>{artwork.total_saves || 0}</Text>
                                  </View>
                                  <View style={styles.topArtworkStatItem}>
                                    <Ionicons name="trending-up-outline" size={14} color={colors.primary} />
                                    <Text style={[styles.topArtworkStatText, { color: colors.primary }]}>
                                      {artwork.engagement_score?.toFixed(1) || '0.0'}
                                    </Text>
                                  </View>
                                </>
                              ) : (
                                <>
                                  <View style={styles.topArtworkStatItem}>
                                    <Ionicons name="heart-outline" size={14} color={colors.text.secondary} />
                                    <Text style={styles.topArtworkStatText}>
                                      {artwork.engagement_count || 0} interactions
                                    </Text>
                                  </View>
                                  {artwork.engagement_types && artwork.engagement_types.length > 0 && (
                                    <View style={styles.topArtworkStatItem}>
                                      <Ionicons name="apps-outline" size={14} color={colors.text.secondary} />
                                      <Text style={styles.topArtworkStatText}>
                                        {artwork.engagement_types.join(', ')}
                                      </Text>
                                    </View>
                                  )}
                                </>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="analytics-outline" size={64} color={colors.text.disabled} />
                  <Text style={styles.emptyTitle}>No Engagement Data</Text>
                  <Text style={styles.emptyText}>
                    {isArtist 
                      ? 'Start sharing your artworks to see engagement metrics here.'
                      : 'Start browsing and engaging with artworks to see your activity here.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Templates Modal */}
      <Modal
        visible={showTemplatesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTemplatesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.templatesModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Responses</Text>
              <TouchableOpacity
                onPress={() => setShowTemplatesModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.templatesContent}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => {
                    // TODO: Use template
                    setShowTemplatesModal(false);
                    Toast.show({
                      type: 'success',
                      text1: 'Template copied',
                      visibilityTime: 1500,
                    });
                  }}
                >
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateTitle}>{template.title}</Text>
                    <Ionicons name="copy-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.templateMessage}>{template.message}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        visible={showTransactionHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTransactionHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction History</Text>
              <TouchableOpacity
                onPress={() => setShowTransactionHistoryModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statsContent} showsVerticalScrollIndicator={false}>
              {loadingTransactions ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.emptyText}>Loading transactions...</Text>
                </View>
              ) : allTransactions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={64} color={colors.text.disabled} />
                  <Text style={styles.emptyTitle}>No Transactions</Text>
                  <Text style={styles.emptyText}>
                    {isArtist 
                      ? "You haven't received any payments yet. Transactions will appear here after clients make payments."
                      : "You haven't made any payments yet. Transactions will appear here after you make a payment."}
                  </Text>
                </View>
              ) : (
                (() => {
                  // Group transactions by commission
                  const groupedByCommission = {};
                  allTransactions.forEach(tx => {
                    const commissionId = tx.commission_id || tx.commission?.id;
                    if (!groupedByCommission[commissionId]) {
                      groupedByCommission[commissionId] = {
                        commission: tx.commission,
                        transactions: []
                      };
                    }
                    groupedByCommission[commissionId].transactions.push(tx);
                  });

                  // Calculate totals
                  const totalAmount = allTransactions
                    .filter(tx => tx.status === 'succeeded' && tx.transaction_type !== 'refund')
                    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
                  
                  const totalProfit = isArtist 
                    ? allTransactions
                        .filter(tx => tx.status === 'succeeded' && tx.transaction_type !== 'refund')
                        .reduce((sum, tx) => sum + (tx.artist_payout || 0), 0)
                    : null;

                  return (
                    <>
                      {/* Summary Card */}
                      <View style={styles.transactionSummaryCard}>
                        <View style={styles.transactionSummaryRow}>
                          <Text style={styles.transactionSummaryLabel}>
                            {isArtist ? 'Total Earnings' : 'Total Spent'}
                          </Text>
                          <Text style={styles.transactionSummaryValue}>
                            ${totalAmount.toFixed(2)}
                          </Text>
                        </View>
                        {isArtist && totalProfit !== null && (
                          <View style={styles.transactionSummaryRow}>
                            <Text style={styles.transactionSummaryLabel}>After Platform Fee</Text>
                            <Text style={[styles.transactionSummaryValue, { color: colors.status.success }]}>
                              ${totalProfit.toFixed(2)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Transactions by Commission */}
                      {Object.values(groupedByCommission).map((group, index) => {
                        const commission = group.commission;
                        const commissionTransactions = group.transactions.sort((a, b) => 
                          new Date(b.created_at) - new Date(a.created_at)
                        );
                        const commissionTotal = commissionTransactions
                          .filter(tx => tx.status === 'succeeded' && tx.transaction_type !== 'refund')
                          .reduce((sum, tx) => sum + (tx.amount || 0), 0);

                        return (
                          <View key={commission?.id || index} style={styles.transactionCommissionCard}>
                            <View style={styles.transactionCommissionHeader}>
                              <View style={styles.transactionCommissionInfo}>
                                <Text style={styles.transactionCommissionTitle}>
                                  {commission?.details || commission?.description || 'Commission'}
                                </Text>
                                <Text style={styles.transactionCommissionDate}>
                                  {commission?.created_at 
                                    ? new Date(commission.created_at).toLocaleDateString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        year: 'numeric' 
                                      })
                                    : 'N/A'}
                                </Text>
                              </View>
                              <View style={styles.transactionCommissionAmount}>
                                <Text style={styles.transactionAmountValue}>
                                  ${commissionTotal.toFixed(2)}
                                </Text>
                              </View>
                            </View>
                            
                            {/* Individual Transactions */}
                            {commissionTransactions.map((tx) => {
                              const typeConfig = {
                                deposit: { label: 'Deposit', icon: 'wallet', color: colors.primary },
                                final: { label: 'Final Payment', icon: 'card', color: colors.primary },
                                full: { label: 'Full Payment', icon: 'cash', color: colors.primary },
                                milestone: { label: 'Milestone', icon: 'layers', color: colors.primary },
                                tip: { label: 'Tip', icon: 'heart', color: colors.status.error },
                                refund: { label: 'Refund', icon: 'arrow-undo', color: colors.status.error },
                              }[tx.transaction_type] || { label: 'Payment', icon: 'card', color: colors.primary };
                              
                              const statusColor = {
                                succeeded: colors.status.success,
                                pending: colors.status.warning,
                                failed: colors.status.error,
                                refunded: colors.status.error,
                              }[tx.status] || colors.text.secondary;

                              return (
                                <View key={tx.id} style={styles.transactionItem}>
                                  <View style={styles.transactionItemLeft}>
                                    <View style={[styles.transactionItemIcon, { backgroundColor: typeConfig.color + '20' }]}>
                                      <Ionicons name={typeConfig.icon} size={18} color={typeConfig.color} />
                                    </View>
                                    <View style={styles.transactionItemInfo}>
                                      <Text style={styles.transactionItemType}>{typeConfig.label}</Text>
                                      <Text style={styles.transactionItemDate}>
                                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit'
                                        })}
                                      </Text>
                                    </View>
                                  </View>
                                  <View style={styles.transactionItemRight}>
                                    <Text style={[
                                      styles.transactionItemAmount,
                                      tx.transaction_type === 'refund' && styles.transactionItemAmountRefund
                                    ]}>
                                      {tx.transaction_type === 'refund' ? '-' : ''}${tx.amount?.toFixed(2) || '0.00'}
                                    </Text>
                                    <View style={[styles.transactionItemStatus, { backgroundColor: statusColor + '20' }]}>
                                      <Text style={[styles.transactionItemStatusText, { color: statusColor }]}>
                                        {tx.status?.charAt(0).toUpperCase() + tx.status?.slice(1) || 'Pending'}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                    </>
                  );
                })()
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Options Modal */}
      {selectedCommission && (
        <PaymentOptions
          visible={showPaymentOptions}
          onClose={() => {
            setShowPaymentOptions(false);
            // Reopen commission modal after payment options closes
            setTimeout(() => {
              setShowCommissionModal(true);
            }, 100);
          }}
          commission={selectedCommission}
          onProceed={(paymentData) => {
            const amount = paymentData.paymentType === 'deposit' 
              ? (selectedCommission.final_price || selectedCommission.price || selectedCommission.budget) * (paymentData.depositPercentage / 100)
              : (selectedCommission.final_price || selectedCommission.price || selectedCommission.budget);
            
            setPaymentData({
              ...paymentData,
              commissionId: selectedCommission.id,
              amount,
            });
            setShowPaymentOptions(false);
            setTimeout(() => {
              setShowPayPalCheckout(true);
            }, 200);
          }}
        />
      )}

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
          onSuccess={async (data) => {
            setShowPayPalCheckout(false);
            setPaymentData(null);
            await loadCommissions();
            // Refresh selected commission if modal is still open
            if (selectedCommission) {
              try {
                const response = await axios.get(`${API_URL}/commissions/${selectedCommission.id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setSelectedCommission(response.data);
              } catch (err) {
                console.error('Error refreshing commission:', err);
              }
            }
          }}
          onError={(error) => {
            console.error('Payment error:', error);
          }}
        />
      )}

      {/* Notes Modal */}
      <Modal
        visible={showNotesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.notesModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Client Note</Text>
              <TouchableOpacity
                onPress={() => setShowNotesModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.notesContent}>
              <TextInput
                style={styles.notesInput}
                placeholder="Add notes about this client..."
                placeholderTextColor={colors.text.disabled}
                value={currentNote}
                onChangeText={setCurrentNote}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.saveNoteButton}
                onPress={saveNote}
              >
                <Ionicons name="save-outline" size={20} color={colors.text.primary} />
                <Text style={styles.saveNoteText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Commission Detail Modal */}
      {selectedCommission && (
        <Modal
          visible={showCommissionModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowCommissionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.commissionDetailModal}>
              <View style={styles.detailModalHeader}>
                <View style={styles.detailModalHeaderLeft}>
                  <Text style={styles.detailModalTitle}>Commission Details</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowCommissionModal(false);
                    setDetailTab('details');
                  }}
                  style={styles.detailModalCloseButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Tab Bar - Only show Progress/Files tabs if commission is accepted/in_progress */}
              <View style={styles.detailTabBar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.detailTabContent}
                >
                  <TouchableOpacity
                    style={styles.detailTab}
                    onPress={() => setDetailTab('details')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.detailTabText, detailTab === 'details' && styles.detailTabTextActive]}>
                      Details
                    </Text>
                    {detailTab === 'details' && <View style={styles.detailTabUnderline} />}
                  </TouchableOpacity>
                  {(selectedCommission.status === 'accepted' || selectedCommission.status === 'in_progress') && (
                    <>
                      <TouchableOpacity
                        style={styles.detailTab}
                        onPress={() => setDetailTab('progress')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.detailTabText, detailTab === 'progress' && styles.detailTabTextActive]}>
                          Progress
                        </Text>
                        {detailTab === 'progress' && <View style={styles.detailTabUnderline} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.detailTab}
                        onPress={() => setDetailTab('files')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.detailTabText, detailTab === 'files' && styles.detailTabTextActive]}>
                          Files
                        </Text>
                        {detailTab === 'files' && <View style={styles.detailTabUnderline} />}
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Tab Content */}
              <View style={{ flex: 1, minHeight: 200 }}>
                {detailTab === 'details' ? (
                  <ScrollView
                    style={styles.commissionDetailContent}
                    contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg, minHeight: 400 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Clean User Header - Pinterest Style */}
                    {selectedCommission ? (
                      <>
                        <TouchableOpacity
                          style={styles.detailUserHeader}
                          onPress={() => {
                            // If artist view, navigate to client profile
                            // If client view, navigate to artist profile
                            if (isArtist) {
                              // Artist view: navigate to client profile
                              const clientId = selectedCommission.client_id;
                              if (clientId) {
                                // Close modal first
                                setShowCommissionModal(false);
                                setSelectedCommission(null);
                                // Navigate to client profile after modal closes
                                setTimeout(() => {
                                  router.push(`/client/${clientId}`);
                                }, 200);
                              }
                            } else {
                              // Client view: navigate to artist profile
                              const artistId = selectedCommission.artist_id;
                              if (artistId) {
                                // Close modal first
                                setShowCommissionModal(false);
                                setSelectedCommission(null);
                                // Navigate to artist profile after modal closes
                                setTimeout(() => {
                                  router.push(`/artist/${artistId}`);
                                }, 200);
                              }
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{
                              uri: isArtist
                                ? (selectedCommission.client?.avatar_url || selectedCommission.client?.profile_picture || DEFAULT_AVATAR)
                                : (selectedCommission.artist?.users?.avatar_url || selectedCommission.artist?.users?.profile_picture || artistCache[selectedCommission.artist_id]?.avatar_url || DEFAULT_AVATAR)
                            }}
                            style={styles.detailAvatar}
                            contentFit="cover"
                          />
                          <View style={styles.detailUserInfo}>
                            <Text style={styles.detailUsername} numberOfLines={1}>
                              {isArtist
                                ? (selectedCommission.client?.username || selectedCommission.client?.full_name || 'Unknown Client')
                                : (selectedCommission.artist?.users?.username || selectedCommission.artist?.users?.full_name || artistCache[selectedCommission.artist_id]?.username || 'Unknown Artist')}
                            </Text>
                            <Text style={styles.detailUserSubtext}>
                              {isArtist ? 'Client' : 'Artist'} • {selectedCommission.created_at ? new Date(selectedCommission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </Text>
                          </View>
                          <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedCommission.status) + '15' }]}>
                            <Ionicons name={getStatusIcon(selectedCommission.status)} size={16} color={getStatusColor(selectedCommission.status)} />
                            <Text style={[styles.detailStatusText, { color: getStatusColor(selectedCommission.status) }]}>
                              {formatStatus(selectedCommission.status)}
                            </Text>
                          </View>
                        </TouchableOpacity>

                  {/* Pricing - Always Show */}
                  <View style={styles.detailPricingCard}>
                    <Text style={styles.detailPricingLabel}>Total</Text>
                    {selectedCommission.final_price || selectedCommission.budget || selectedCommission.price ? (
                      <Text style={styles.detailPriceText}>
                        ${selectedCommission.final_price || selectedCommission.price || selectedCommission.budget}
                        {!selectedCommission.final_price && !selectedCommission.price && <Text style={styles.detailBudgetLabel}> (Budget)</Text>}
                      </Text>
                    ) : (
                      <Text style={styles.detailPriceTextPlaceholder}>No price set</Text>
                    )}
                  </View>

                  {/* Description */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Description</Text>
                    {selectedCommission.details || selectedCommission.description ? (
                      <Text style={styles.detailText}>{selectedCommission.details || selectedCommission.description}</Text>
                    ) : (
                      <Text style={styles.detailTextPlaceholder}>No description provided</Text>
                    )}
                  </View>

                  {/* Client Note */}
                  {selectedCommission.client_note || selectedCommission.note ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Client Note</Text>
                      <Text style={styles.detailText}>{selectedCommission.client_note || selectedCommission.note}</Text>
                    </View>
                  ) : null}

                  {/* Payment Status - Always show payment status */}
                  <View style={[styles.detailSection, styles.paymentStatusSection]}>
                    <Text style={styles.detailSectionTitle}>Payment Status</Text>
                    
                    {/* Determine payment status */}
                    {(() => {
                      const paymentStatus = selectedCommission.payment_status;
                      const hasPayment = paymentStatus && 
                                        paymentStatus !== 'unpaid' && 
                                        paymentStatus !== 'pending';
                      const isUnpaid = !paymentStatus || 
                                       paymentStatus === 'unpaid' || 
                                       paymentStatus === 'pending';
                      
                      // Show EscrowStatus if escrow is being used AND payment has been made
                      if (selectedCommission.escrow_status && hasPayment) {
                        return (
                          <EscrowStatus
                            commission={selectedCommission}
                            isClient={!isArtist}
                            onRelease={async () => {
                              try {
                                await axios.post(
                                  `${API_URL}/payments/release-escrow`,
                                  { commissionId: selectedCommission.id },
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                await loadCommissions();
                                // Refresh selected commission
                                try {
                                  const response = await axios.get(`${API_URL}/commissions/${selectedCommission.id}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  setSelectedCommission(response.data);
                                } catch (err) {
                                  console.error('Error refreshing commission:', err);
                                }
                                Toast.show({
                                  type: 'success',
                                  text1: 'Success',
                                  text2: 'Funds released to artist',
                                  visibilityTime: 2000,
                                });
                              } catch (error) {
                                console.error('Error releasing escrow:', error);
                                Toast.show({
                                  type: 'error',
                                  text1: 'Error',
                                  text2: error.response?.data?.error || 'Failed to release funds',
                                  visibilityTime: 3000,
                                });
                              }
                            }}
                          />
                        );
                      }
                      
                      // Show payment status card
                      return (
                        <View style={styles.paymentStatusCard}>
                          <Ionicons 
                            name={
                              isUnpaid ? 'close-circle-outline' :
                              paymentStatus === 'fully_paid' || paymentStatus === 'paid' ? 'checkmark-circle' :
                              paymentStatus === 'deposit_paid' ? 'wallet' :
                              'card-outline'
                            } 
                            size={20} 
                            color={
                              isUnpaid ? colors.status.error :
                              paymentStatus === 'fully_paid' || paymentStatus === 'paid' ? colors.status.success :
                              paymentStatus === 'deposit_paid' ? colors.status.warning :
                              colors.text.secondary
                            } 
                          />
                          <View style={styles.paymentStatusInfo}>
                            <Text style={styles.paymentStatusLabel}>Payment Status</Text>
                            <Text style={[
                              styles.paymentStatusValue,
                              { 
                                color: isUnpaid ? colors.status.error :
                                       (paymentStatus === 'fully_paid' || paymentStatus === 'paid') ? colors.status.success : 
                                       colors.text.primary 
                              }
                            ]}>
                              {isUnpaid ? 'Not Paid' :
                               paymentStatus === 'fully_paid' || paymentStatus === 'paid' ? 'Paid' :
                               paymentStatus === 'deposit_paid' 
                                 ? (selectedCommission.status === 'completed' 
                                     ? 'Deposit Paid - Final Payment Due' 
                                     : 'Deposit Paid')
                                 : 'Unknown Status'}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}
                  </View>

                  {/* Payment Options - Show button when:
                      1. Status is 'accepted' OR 'in_progress' AND (no payment_status OR payment_status is 'unpaid')
                         Note: Backend changes 'accepted' to 'in_progress' when artist accepts
                      2. Status is 'completed' AND payment_status is 'deposit_paid' (for final payment)
                  */}
                  {(() => {
                    const statusCheck = selectedCommission.status === 'accepted' || selectedCommission.status === 'in_progress';
                    // payment_status can be: null, undefined, 'unpaid', or 'pending' - all mean payment hasn't been made
                    const paymentCheck = !selectedCommission.payment_status || 
                                       selectedCommission.payment_status === 'unpaid' || 
                                       selectedCommission.payment_status === 'pending';
                    const finalPaymentCheck = selectedCommission.status === 'completed' && selectedCommission.payment_status === 'deposit_paid';
                    const shouldShow = !isArtist && ((statusCheck && paymentCheck) || finalPaymentCheck);
                    
                    return shouldShow;
                  })() && (
                    <View style={[styles.detailSection, styles.paymentButtonSection]}>
                      <TouchableOpacity
                        style={styles.paymentButton}
                        onPress={() => {
                          // Close commission modal first to avoid conflicts
                          setShowCommissionModal(false);
                          setTimeout(() => {
                            setShowPaymentOptions(true);
                          }, 300);
                        }}
                      >
                        <Ionicons name="card-outline" size={20} color={colors.text.primary} />
                        <Text style={styles.paymentButtonText}>
                          {(selectedCommission.status === 'accepted' || selectedCommission.status === 'in_progress') ? 'Make Deposit Payment' : 'Make Final Payment'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Milestone Tracker */}
                  {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && selectedCommission.payment_type === 'milestone' && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Payment Milestones</Text>
                      <MilestoneTracker
                        commissionId={selectedCommission.id}
                        isClient={!isArtist}
                        onPayMilestone={async (milestone) => {
                          setPaymentData({
                            commissionId: selectedCommission.id,
                            amount: milestone.amount,
                            paymentType: 'milestone',
                            milestoneId: milestone.id,
                          });
                          setShowCommissionModal(false);
                          setShowPayPalCheckout(true);
                        }}
                      />
                    </View>
                  )}

                    </>
                  ) : (
                    <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading commission details...</Text>
                    </View>
                  )}
                </ScrollView>
                ) : detailTab === 'progress' ? (
                  <View style={{ flex: 1, minHeight: 200 }}>
                    {selectedCommission?.id && (selectedCommission.status === 'accepted' || selectedCommission.status === 'in_progress') ? (
                      <ProgressTracker
                        commissionId={selectedCommission.id}
                        token={token}
                        isArtist={isArtist}
                        onProgressUpdate={loadCommissions}
                      />
                    ) : selectedCommission?.id ? (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                        <Ionicons name="lock-closed-outline" size={48} color={colors.text.disabled} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary, textAlign: 'center' }}>
                          Accept the commission to view progress updates
                        </Text>
                      </View>
                    ) : (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</Text>
                      </View>
                    )}
                  </View>
                ) : detailTab === 'files' ? (
                  <View style={{ flex: 1, minHeight: 200 }}>
                    {selectedCommission?.id && (selectedCommission.status === 'accepted' || selectedCommission.status === 'in_progress') ? (
                      <CommissionFilesTab 
                        commissionId={selectedCommission.id}
                        token={token}
                        isArtist={isArtist}
                      />
                    ) : selectedCommission?.id ? (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                        <Ionicons name="lock-closed-outline" size={48} color={colors.text.disabled} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary, textAlign: 'center' }}>
                          Accept the commission to view files
                        </Text>
                      </View>
                    ) : (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>

              <View style={[styles.detailFooterBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                {selectedCommission.status === 'pending' && isArtist && (
                  <View style={styles.detailFooterButtons}>
                    <TouchableOpacity
                      style={[styles.detailDeclineButton, updatingStatus.has(selectedCommission.id) && styles.detailDeclineButtonDisabled]}
                      onPress={() => {
                        if (updatingStatus.has(selectedCommission.id)) return;
                        const commissionId = selectedCommission.id;
                        
                        // Use React Native Alert instead of StyledAlert to avoid modal conflicts
                        Alert.alert(
                          'Decline Commission',
                          'Are you sure you want to decline this commission? This action cannot be undone.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Decline',
                              style: 'destructive',
                              onPress: () => {
                                // Close modal immediately
                                setShowCommissionModal(false);
                                setSelectedCommission(null);
                                // Handle async operation after UI updates
                                setTimeout(() => {
                                  handleUpdateStatus(commissionId, 'declined', false);
                                }, 50);
                              }
                            }
                          ]
                        );
                      }}
                      disabled={updatingStatus.has(selectedCommission.id)}
                    >
                      {updatingStatus.has(selectedCommission.id) ? (
                        <ActivityIndicator size="small" color={colors.text.primary} />
                      ) : (
                        <>
                          <Ionicons name="close-circle-outline" size={20} color={colors.text.primary} />
                          <Text style={styles.detailDeclineButtonText}>Decline</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.detailAcceptButton, updatingStatus.has(selectedCommission.id) && styles.detailAcceptButtonDisabled]}
                      onPress={() => {
                        if (updatingStatus.has(selectedCommission.id)) return;
                        const commissionId = selectedCommission.id;
                        
                        // Use React Native Alert instead of StyledAlert to avoid modal conflicts
                        Alert.alert(
                          'Accept Commission',
                          'Accept this request?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Accept',
                              style: 'default',
                              onPress: () => {
                                // Close modal immediately
                                setShowCommissionModal(false);
                                setSelectedCommission(null);
                                // Handle async operation after UI updates
                                setTimeout(() => {
                                  handleUpdateStatus(commissionId, 'accepted', false);
                                }, 50);
                              }
                            }
                          ]
                        );
                      }}
                      disabled={updatingStatus.has(selectedCommission.id)}
                    >
                      {updatingStatus.has(selectedCommission.id) ? (
                        <ActivityIndicator size="small" color={colors.text.primary} />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.primary} />
                          <Text style={styles.detailAcceptButtonText}>Accept</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && isArtist && (
                  <TouchableOpacity
                    style={[styles.detailCompleteButton, updatingStatus.has(selectedCommission.id) && styles.detailCompleteButtonDisabled]}
                    onPress={() => {
                      if (updatingStatus.has(selectedCommission.id)) return;
                      const commissionId = selectedCommission.id;
                      
                      // Use React Native Alert instead of StyledAlert to avoid modal conflicts
                      Alert.alert(
                        'Complete Commission',
                        'Mark as completed?',
                        [
                          { text: 'Not Yet', style: 'cancel' },
                          {
                            text: 'Complete',
                            style: 'default',
                            onPress: () => {
                              // Close modal immediately
                              setShowCommissionModal(false);
                              setSelectedCommission(null);
                              // Handle async operation after UI updates
                              setTimeout(() => {
                                handleUpdateStatus(commissionId, 'completed', false);
                              }, 50);
                            }
                          }
                        ]
                      );
                    }}
                    disabled={updatingStatus.has(selectedCommission.id)}
                  >
                    {updatingStatus.has(selectedCommission.id) ? (
                      <ActivityIndicator size="small" color={colors.text.primary} />
                    ) : (
                      <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.primary} />
                    <Text style={styles.detailCompleteButtonText}>Mark Complete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      <ReviewModal
        visible={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setReviewTarget(null);
        }}
        onSubmit={async (rating, comment) => {
          if (!reviewTarget || !token) return;

          try {
            await axios.post(
              `${API_URL}/reviews`,
              {
                commission_id: reviewTarget.commissionId,
                rating,
                comment,
                review_type: reviewTarget.reviewType
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            setShowReviewModal(false);
            setReviewTarget(null);
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Review submitted!',
              visibilityTime: 2000,
            });
          } catch (error) {
            console.error('Error submitting review:', error);
            throw new Error(error.response?.data?.error || 'Failed to submit review');
          }
        }}
        userName={reviewTarget?.userName || ''}
        userAvatar={reviewTarget?.userAvatar}
        reviewType={reviewTarget?.reviewType || 'client_to_artist'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: '800',
    marginBottom: spacing.xs / 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '500',
  },
  cancelBatchButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  cancelBatchText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingRight: spacing.lg,
  },
  statCard: {
    minWidth: 110,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs / 2,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
  },
  viewModeText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  templatesButton: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  statusTabsContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statusTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusTabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  statusTabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  batchActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 0,
  },
  batchSelectedText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
  },
  batchActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  batchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  acceptBatchButton: {
    backgroundColor: colors.status.success,
  },
  declineBatchButton: {
    backgroundColor: colors.status.error,
  },
  batchActionText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
  },
  // Kanban Styles
  kanbanContainer: {
    flex: 1,
  },
  kanbanContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  kanbanColumn: {
    width: width,
    paddingHorizontal: spacing.md,
  },
  kanbanCardMargin: {
    marginHorizontal: 0,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.disabled + '40',
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 24,
  },
  kanbanColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  kanbanColumnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kanbanColumnTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  kanbanColumnBadge: {
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    minWidth: 28,
    alignItems: 'center',
  },
  kanbanColumnCount: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '800',
  },
  kanbanColumnScroll: {
    flex: 1,
  },
  kanbanColumnContent: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  kanbanEmptyColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  kanbanEmptyText: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.md,
    fontSize: 13,
  },
  // List Styles
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  pendingCommissionCard: {
    backgroundColor: colors.surface,
  },
  selectedCommissionCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  commissionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  avatarFrame: {
    padding: spacing.xs / 2,
    borderRadius: borderRadius.full,
    borderWidth: 2,
  },
  commissionAvatar: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.full,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  commissionUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  subMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 0,
  },
  metaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  priceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  budgetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 1,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  budgetText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  commissionDetailModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    ...shadows.large,
  },
  detailTabBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  detailTabContent: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  detailTab: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  detailTabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  detailTabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  detailTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    backgroundColor: colors.background,
  },
  detailModalHeaderLeft: {
    flex: 1,
  },
  detailModalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  detailModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  templatesModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    width: '100%',
  },
  notesModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templatesContent: {
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
  },
  templateCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  templateTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  templateMessage: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  commissionDetailContent: {
    flex: 1,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
  },
  detailUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  detailAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  detailUserInfo: {
    flex: 1,
    minWidth: 0,
  },
  detailUsername: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  detailRoleBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  detailUserRole: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 1,
    borderRadius: borderRadius.full,
  },
  detailStatusText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  detailSection: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  detailSectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
    letterSpacing: 0.2,
  },
  detailContentBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailNoteBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 24,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  detailTextPlaceholder: {
    ...typography.body,
    color: colors.text.disabled,
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  detailPriceText: {
    ...typography.h2,
    color: colors.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  detailFooterBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
    backgroundColor: colors.background,
  },
  commissionDetailContent: {
    flex: 1,
  },
  detailFooterButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailDeclineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.status.error,
  },
  detailDeclineButtonDisabled: {
    opacity: 0.5,
  },
  detailDeclineButtonText: {
    ...typography.bodyBold,
    color: colors.status.error,
    fontSize: 16,
    fontWeight: '700',
  },
  detailAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  detailAcceptButtonDisabled: {
    opacity: 0.5,
  },
  detailAcceptButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  detailCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  detailCompleteButtonDisabled: {
    opacity: 0.5,
  },
  detailCompleteButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  notesContent: {
    padding: spacing.lg,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 15,
    minHeight: 140,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  saveNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.medium,
  },
  saveNoteText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  commissionRequestsButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  quickAcceptText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  quickDeclineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickDeclineText: {
    ...typography.bodyBold,
    color: colors.status.error,
    fontSize: 15,
  },
  // Pinterest-style Header
  pinterestHeader: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  pinterestHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pinterestTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  pinterestActionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pinterest-style Filter Bar
  pinterestFilterBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
  },
  pinterestFilterContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  pinterestFilterItem: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  pinterestFilterText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pinterestFilterTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  pinterestFilterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  // Pinterest-style Card Elements
  pinterestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  pinterestCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  pinterestCardUserInfo: {
    flex: 1,
    minWidth: 0,
  },
  pinterestCardUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  pinterestCardDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  pinterestStatusBadge: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinterestCardDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  pinterestCardPrice: {
    marginTop: spacing.xs,
  },
  pinterestPriceText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  pinterestBudgetText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  pinterestNoPriceText: {
    ...typography.body,
    color: colors.text.disabled,
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Compact Header Styles
  compactHeader: {
    backgroundColor: colors.background,
    paddingBottom: spacing.xs,
  },
  compactHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
    marginTop: spacing.xs / 2,
    lineHeight: IS_SMALL_SCREEN ? 16 : 18,
  },
  statsSection: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingBottom: spacing.sm,
  },
  statsCardsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  statCardItem: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border + '60',
    ...shadows.medium,
    position: 'relative',
    overflow: 'hidden',
  },
  statCardPending: {
    borderColor: colors.status.warning + '40',
    backgroundColor: colors.status.warning + '08',
  },
  statCardActive: {
    borderColor: colors.status.info + '40',
    backgroundColor: colors.status.info + '08',
  },
  statCardCompleted: {
    borderColor: colors.status.success + '40',
    backgroundColor: colors.status.success + '08',
  },
  statCardIconContainer: {
    marginBottom: spacing.sm,
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background + '80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 32 : 36,
    fontWeight: '800',
    marginBottom: spacing.xs,
    letterSpacing: -1,
  },
  statCardLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsSection: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingBottom: spacing.sm,
  },
  actionsScrollContent: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    minWidth: IS_SMALL_SCREEN ? 90 : 110,
    ...shadows.small,
  },
  actionButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '600',
  },
  compactTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 28 : 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  compactHeaderActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
  },
  headerActionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  compactHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Compact Card Styles
  compactCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  compactInfo: {
    flex: 1,
    minWidth: 0,
  },
  compactUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactStatusDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  compactDate: {
    ...typography.caption,
    color: colors.text.secondary || '#CCCCCC',
    fontSize: 11,
  },
  compactPrice: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
    minWidth: 60,
  },
  compactPriceText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '700',
  },
  compactBudgetText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    gap: spacing.xs,
  },
  compactAcceptButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAcceptButtonDisabled: {
    opacity: 0.5,
  },
  compactDeclineButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDeclineButtonDisabled: {
    opacity: 0.5,
  },
  // Stats Modal Styles
  statsModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    width: '100%',
  },
  statsContent: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  statsSection: {
    marginBottom: spacing.lg,
  },
  statsSectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  statBoxValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 26 : 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statBoxLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
    fontWeight: '600',
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statCardRowWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  statCardLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '600',
  },
  statCardValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  topArtworkCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  topArtworkImage: {
    width: IS_SMALL_SCREEN ? 50 : 60,
    height: IS_SMALL_SCREEN ? 50 : 60,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  topArtworkInfo: {
    flex: 1,
  },
  topArtworkTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    marginBottom: spacing.xs / 2,
  },
  topArtworkStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  topArtworkStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  topArtworkStatText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  filesTabContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filesEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  filesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  fileCard: {
    width: (width - spacing.md * 2 - spacing.sm * 2) / 2,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  fileImage: {
    width: '100%',
    height: '100%',
  },
  fileNoteOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
    padding: spacing.sm,
  },
  fileNoteText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 11,
  },
  fileDateBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  fileDateText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  detailPricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  detailPricingLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  detailBudgetLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '400',
  },
  detailPriceTextPlaceholder: {
    ...typography.body,
    color: colors.text.disabled,
    fontSize: 18,
    fontStyle: 'italic',
  },
  paymentStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  paymentStatusInfo: {
    flex: 1,
  },
  paymentStatusLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },
  paymentStatusValue: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  paymentButtonSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  paymentStatusSection: {
    marginBottom: spacing.xs,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: 0,
  },
  paymentButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  transactionCommissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  transactionCommissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  transactionCommissionInfo: {
    flex: 1,
  },
  transactionCommissionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  transactionCommissionDate: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  transactionStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  transactionStatusText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  transactionCommissionAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
    marginBottom: spacing.md,
  },
  transactionAmountLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  transactionAmountValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
  },
  transactionHistoryContainer: {
    marginTop: spacing.sm,
  },
  transactionSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  transactionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  transactionSummaryLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
  },
  transactionSummaryValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
  },
  transactionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  transactionItemIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionItemInfo: {
    flex: 1,
  },
  transactionItemType: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  transactionItemDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  transactionItemRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  transactionItemAmount: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  transactionItemAmountRefund: {
    color: colors.status.error,
  },
  transactionItemStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  transactionItemStatusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  detailTextPlaceholder: {
    ...typography.body,
    color: colors.text.disabled,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  detailUserSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: spacing.xs / 2,
  },
});
