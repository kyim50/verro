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
} from 'react-native';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import ReviewModal from '../../components/ReviewModal';
import ProgressTracker from '../../components/ProgressTracker';
import MilestoneTracker from '../../components/MilestoneTracker';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
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
  const [detailTab, setDetailTab] = useState('details'); // details, progress, files

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadCommissions();
        if (isArtist) {
          loadTemplates();
        } else {
          calculateTotalSpent();
        }
      }
    }, [token, user?.user_type, user?.artists])
  );

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

  const calculateTotalSpent = () => {
    const total = commissions
      .filter(c => c.final_price && (c.status === 'completed' || c.status === 'in_progress'))
      .reduce((sum, c) => sum + parseFloat(c.final_price || 0), 0);
    setTotalSpent(total);
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
    ? commissions.filter(c => c.status === 'pending' || c.status === 'in_progress' || c.status === 'accepted')
    : commissions.filter(c => c.status === selectedFilter);

  const handleUpdateStatus = async (commissionId, newStatus) => {
    try {
      const response = await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Reload commissions list
      await loadCommissions();
      
      // Update selected commission if it's the one being updated
      if (selectedCommission && selectedCommission.id === commissionId) {
        // Fetch updated commission details
        try {
          const updatedResponse = await axios.get(`${API_URL}/commissions/${commissionId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSelectedCommission(updatedResponse.data);
        } catch (fetchError) {
          console.error('Error fetching updated commission:', fetchError);
          // Update status locally as fallback
          setSelectedCommission({ ...selectedCommission, status: newStatus });
        }
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Commission ${formatStatus(newStatus).toLowerCase()}`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update status';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        visibilityTime: 3000,
      });
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
                style={styles.compactAcceptButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showAlert({
                    title: 'Accept Commission',
                    message: 'Accept this commission request?',
                    type: 'info',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Accept',
                        style: 'default',
                        onPress: async () => {
                          await handleUpdateStatus(item.id, 'accepted');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
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
                style={styles.compactAcceptButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showAlert({
                    title: 'Accept Commission',
                    message: 'Accept this commission request?',
                    type: 'info',
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Accept',
                        style: 'default',
                        onPress: async () => {
                          await handleUpdateStatus(item.id, 'accepted');
                        }
                      }
                    ]
                  });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
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
      <View style={[styles.compactHeader, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        <View style={styles.compactHeaderTop}>
          <Text style={styles.compactTitle}>
            {isArtist ? 'Commissions' : 'My Commissions'}
          </Text>
          <View style={styles.compactHeaderActions}>
            <TouchableOpacity
              style={styles.compactHeaderButton}
              onPress={() => setShowStatsModal(true)}
            >
              <Ionicons name="stats-chart" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            {isArtist && (
              <TouchableOpacity
                style={styles.compactHeaderButton}
                onPress={() => setShowTemplatesModal(true)}
              >
                <Ionicons name="chatbox-ellipses-outline" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            )}
            {isArtist && (
              <TouchableOpacity
                style={styles.compactHeaderButton}
                onPress={() => router.push('/artist-settings')}
              >
                <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            )}
            {!isArtist && (
              <TouchableOpacity
                style={styles.compactHeaderButton}
                onPress={() => router.push('/commission-requests')}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.text.primary} />
              </TouchableOpacity>
            )}
          </View>
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
            { paddingBottom: Math.max(insets.bottom, 20) + (batchMode ? 140 : 80) }
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
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Commission</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCommissionModal(false);
                    setDetailTab('details');
                  }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {/* Pinterest-style Tab Bar */}
              <View style={styles.pinterestFilterBar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pinterestFilterContent}
                >
                  <TouchableOpacity
                    style={styles.pinterestFilterItem}
                    onPress={() => setDetailTab('details')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pinterestFilterText, detailTab === 'details' && styles.pinterestFilterTextActive]}>
                      Details
                    </Text>
                    {detailTab === 'details' && <View style={styles.pinterestFilterUnderline} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pinterestFilterItem}
                    onPress={() => setDetailTab('progress')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pinterestFilterText, detailTab === 'progress' && styles.pinterestFilterTextActive]}>
                      Progress
                    </Text>
                    {detailTab === 'progress' && <View style={styles.pinterestFilterUnderline} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.pinterestFilterItem}
                    onPress={() => setDetailTab('files')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pinterestFilterText, detailTab === 'files' && styles.pinterestFilterTextActive]}>
                      Files
                    </Text>
                    {detailTab === 'files' && <View style={styles.pinterestFilterUnderline} />}
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Tab Content */}
              <View style={{ flex: 1, minHeight: 200 }}>
                {detailTab === 'details' ? (
                  <ScrollView
                    style={styles.commissionDetailContent}
                    contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl, minHeight: 400 }}
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
                              // Check if client has an artist record, otherwise just show user info
                              const clientId = selectedCommission.client_id;
                              if (clientId) {
                                // Try to navigate to artist profile (works if client is also an artist)
                                // If not an artist, the route will handle it gracefully
                                router.push(`/artist/${clientId}`);
                              }
                            } else {
                              // Client view: navigate to artist profile
                              const artistId = selectedCommission.artist_id;
                              if (artistId) {
                                router.push(`/artist/${artistId}`);
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
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Client Note</Text>
                    {selectedCommission.client_note || selectedCommission.note ? (
                      <Text style={styles.detailText}>{selectedCommission.client_note || selectedCommission.note}</Text>
                    ) : (
                      <Text style={styles.detailTextPlaceholder}>No additional notes</Text>
                    )}
                  </View>

                  {/* Milestone Tracker */}
                  {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Payment Milestones</Text>
                      <MilestoneTracker
                        commissionId={selectedCommission.id}
                        isClient={!isArtist}
                        onPayMilestone={(milestone) => {
                          Toast.show({
                            type: 'info',
                            text1: 'Payment',
                            text2: 'Stripe checkout coming soon',
                            visibilityTime: 2000,
                          });
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
                    {selectedCommission?.id ? (
                      <ProgressTracker
                        commissionId={selectedCommission.id}
                        token={token}
                        isArtist={isArtist}
                        onProgressUpdate={loadCommissions}
                      />
                    ) : (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ flex: 1, minHeight: 200 }}>
                    {selectedCommission?.id ? (
                      <CommissionFilesTab 
                        commissionId={selectedCommission.id}
                        token={token}
                        isArtist={isArtist}
                      />
                    ) : (
                      <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>Loading...</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.detailFooterBar}>
                {selectedCommission.status === 'pending' && isArtist && (
                  <View style={styles.detailFooterButtons}>
                    <TouchableOpacity
                      style={styles.detailDeclineButton}
                      onPress={() => {
                        showAlert({
                          title: 'Decline Commission',
                          message: 'Are you sure?',
                          type: 'warning',
                          buttons: [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Decline',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await handleUpdateStatus(selectedCommission.id, 'declined');
                                  setShowCommissionModal(false);
                                } catch (error) {
                                  console.error('Error declining commission:', error);
                                }
                              }
                            }
                          ]
                        });
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color={colors.text.primary} />
                      <Text style={styles.detailDeclineButtonText}>Decline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailAcceptButton}
                      onPress={() => {
                        showAlert({
                          title: 'Accept Commission',
                          message: 'Accept this request?',
                          type: 'info',
                          buttons: [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Accept',
                              style: 'default',
                              onPress: async () => {
                                await handleUpdateStatus(selectedCommission.id, 'accepted');
                                setShowCommissionModal(false);
                              }
                            }
                          ]
                        });
                      }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.primary} />
                      <Text style={styles.detailAcceptButtonText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && isArtist && (
                  <TouchableOpacity
                    style={styles.detailCompleteButton}
                    onPress={() => {
                      showAlert({
                        title: 'Complete Commission',
                        message: 'Mark as completed?',
                        type: 'info',
                        buttons: [
                          { text: 'Not Yet', style: 'cancel' },
                          {
                            text: 'Complete',
                            style: 'default',
                            onPress: async () => {
                              await handleUpdateStatus(selectedCommission.id, 'completed');
                              setShowCommissionModal(false);
                            }
                          }
                        ]
                      });
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.primary} />
                    <Text style={styles.detailCompleteButtonText}>Mark Complete</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
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
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.xs / 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
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
    borderWidth: 2,
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
    marginBottom: 2,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    paddingHorizontal: spacing.sm + 2,
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
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
    padding: 2,
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
    marginBottom: 2,
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
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
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
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templatesContent: {
    padding: spacing.lg,
  },
  templateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: 2,
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
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  detailSectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
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
    marginTop: spacing.xs,
  },
  detailPriceText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  detailFooterBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 15,
    minHeight: 140,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 22,
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
  },
  pinterestFilterContent: {
    paddingHorizontal: spacing.md,
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
    backgroundColor: colors.text.primary,
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
    marginBottom: 2,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  compactTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  compactHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    marginBottom: 2,
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
  },
  compactPriceText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  compactBudgetText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
  },
  compactActions: {
    marginLeft: spacing.xs,
  },
  compactAcceptButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  statsSection: {
    marginBottom: spacing.xl,
  },
  statsSectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
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
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statBoxValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statBoxLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  statCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statCardRowWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  statCardLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  statCardValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  filesTabContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filesEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  detailPricingLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginBottom: spacing.xs / 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginTop: 2,
  },
});
