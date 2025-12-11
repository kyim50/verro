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
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

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
  const [viewMode, setViewMode] = useState(isArtist ? 'kanban' : 'list');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  const [noteCommissionId, setNoteCommissionId] = useState(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedCommissions, setSelectedCommissions] = useState(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [totalSpent, setTotalSpent] = useState(0);
  const [currentKanbanPage, setCurrentKanbanPage] = useState(0);
  const kanbanFlatListRef = useRef(null);

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

  const kanbanColumns = {
    pending: commissions.filter(c => c.status === 'pending'),
    in_progress: commissions.filter(c => c.status === 'in_progress' || c.status === 'accepted'),
    review: commissions.filter(c => c.status === 'review'),
    completed: commissions.filter(c => c.status === 'completed'),
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
      await axios.patch(
        `${API_URL}/commissions/${commissionId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadCommissions();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Commission ${formatStatus(newStatus).toLowerCase()}`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update status',
        visibilityTime: 2000,
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
        style={[styles.kanbanCard, { borderColor: statusColor }]}
        onPress={() => {
          setSelectedCommission(item);
          setShowCommissionModal(true);
        }}
        activeOpacity={0.95}
      >
        {/* Status indicator at top */}
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />

        <View style={styles.kanbanCardHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
              style={styles.kanbanAvatar}
              contentFit="cover"
            />
          </View>
          <View style={styles.kanbanUserInfo}>
            <Text style={styles.kanbanUsername} numberOfLines={1}>
              {otherUser?.username || otherUser?.full_name || 'Unknown'}
            </Text>
            <Text style={styles.kanbanDate}>
              {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          {isArtist && (
            <TouchableOpacity
              onPress={async (e) => {
                e.stopPropagation();
                setNoteCommissionId(item.id);
                await loadNote(item.id);
                setShowNotesModal(true);
              }}
              style={styles.noteIconButton}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {(item.client_note || item.details) && (
          <Text style={styles.kanbanDetails} numberOfLines={3}>
            {item.client_note || item.details}
          </Text>
        )}

        <View style={styles.kanbanFooter}>
          {item.final_price ? (
            <View style={styles.kanbanPriceBadge}>
              <Ionicons name="cash" size={14} color={colors.primary} />
              <Text style={styles.kanbanPriceText}>${item.final_price}</Text>
            </View>
          ) : (
            <View style={styles.kanbanNoPriceBadge}>
              <Text style={styles.kanbanNoPriceText}>No price set</Text>
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
          item.status === 'pending' && styles.pendingCommissionCard,
          isSelected && styles.selectedCommissionCard,
        ]}
        onPress={() => {
          if (batchMode) {
            toggleCommissionSelection(item.id);
          } else {
            setSelectedCommission(item);
            setShowCommissionModal(true);
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

        <View style={styles.commissionHeaderRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarFrame, { borderColor: statusColor + '40' }]}>
              <Image
                source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
                style={styles.commissionAvatar}
                contentFit="cover"
              />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.commissionUsername} numberOfLines={1}>
                {otherUser?.username || otherUser?.full_name || (isArtist ? 'Unknown Client' : 'Unknown Artist')}
              </Text>
              <Text style={styles.subMeta} numberOfLines={1}>
                {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '15', borderColor: statusColor + '40' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color={statusColor} />
            <Text style={[styles.statusPillText, { color: statusColor }]}>{formatStatus(item.status)}</Text>
          </View>
        </View>

        {(item.client_note || item.details) && (
          <Text style={styles.commissionDetails} numberOfLines={2}>
            {item.client_note || item.details}
          </Text>
        )}

        <View style={styles.commissionFooter}>
          <View style={styles.metaChips}>
            {item.final_price || item.price ? (
              <View style={styles.priceChip}>
                <Ionicons name="cash" size={12} color={colors.primary} />
                <Text style={styles.priceText}>${item.final_price || item.price}</Text>
              </View>
            ) : item.budget ? (
              <View style={styles.budgetChip}>
                <Ionicons name="wallet-outline" size={11} color={colors.text.secondary} />
                <Text style={styles.budgetText}>Budget: ${item.budget}</Text>
              </View>
            ) : (
              <View style={styles.budgetChip}>
                <Ionicons name="help-circle-outline" size={11} color={colors.text.disabled} />
                <Text style={styles.budgetText}>No price</Text>
              </View>
            )}
          </View>
          {!batchMode && (
            <Ionicons name="chevron-forward" size={16} color={colors.text.disabled} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {isArtist ? 'Dashboard' : 'My Commissions'}
            </Text>
            <Text style={styles.subtitle}>
              {isArtist ? 'Manage your pipeline' : 'Track your requests'}
            </Text>
          </View>
          {!isArtist && (
            <TouchableOpacity
              style={styles.commissionRequestsButton}
              onPress={() => router.push('/commission-requests')}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          {isArtist && batchMode && (
            <TouchableOpacity
              style={styles.cancelBatchButton}
              onPress={() => {
                setBatchMode(false);
                setSelectedCommissions(new Set());
              }}
            >
              <Text style={styles.cancelBatchText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          <View style={[styles.statCard, { borderColor: colors.primary }]}>
            <View style={[styles.statIconBg, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{commissionStats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.status.info }]}>
            <View style={[styles.statIconBg, { backgroundColor: colors.status.info + '20' }]}>
              <Ionicons name="hourglass-outline" size={22} color={colors.status.info} />
            </View>
            <Text style={styles.statValue}>{commissionStats.in_progress}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.status.success }]}>
            <View style={[styles.statIconBg, { backgroundColor: colors.status.success + '20' }]}>
              <Ionicons name="checkmark-done-outline" size={22} color={colors.status.success} />
            </View>
            <Text style={styles.statValue}>{commissionStats.completed}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          {isArtist ? (
            <View style={[styles.statCard, { borderColor: '#FFD700' }]}>
              <View style={[styles.statIconBg, { backgroundColor: '#FFD700' + '20' }]}>
                <Ionicons name="trending-up-outline" size={22} color="#FFD700" />
              </View>
              <Text style={styles.statValue}>${commissionStats.totalRevenue.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          ) : (
            <View style={[styles.statCard, { borderColor: colors.primary }]}>
              <View style={[styles.statIconBg, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="wallet-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Spent</Text>
            </View>
          )}
        </ScrollView>

        {isArtist && (
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'kanban' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('kanban')}
            >
              <Ionicons name="grid-outline" size={18} color={viewMode === 'kanban' ? colors.text.primary : colors.text.secondary} />
              <Text style={[styles.viewModeText, viewMode === 'kanban' && styles.viewModeTextActive]}>Board</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? colors.text.primary : colors.text.secondary} />
              <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.templatesButton}
              onPress={() => setShowTemplatesModal(true)}
            >
              <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {viewMode === 'list' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusTabsContainer}
          >
            {['all', 'pending', 'active', 'completed'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusTab,
                  selectedFilter === status && styles.statusTabActive,
                ]}
                onPress={() => setSelectedFilter(status)}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    selectedFilter === status && styles.statusTabTextActive,
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </Animated.View>

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
      ) : viewMode === 'kanban' && isArtist ? (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={kanbanFlatListRef}
            data={[
              { key: 'pending', title: 'Pending', items: kanbanColumns.pending, icon: 'time-outline', color: colors.primary },
              { key: 'in_progress', title: 'In Progress', items: kanbanColumns.in_progress, icon: 'hourglass-outline', color: colors.status.info },
              { key: 'review', title: 'Review', items: kanbanColumns.review, icon: 'eye-outline', color: colors.status.warning },
              { key: 'completed', title: 'Completed', items: kanbanColumns.completed, icon: 'checkmark-done-outline', color: colors.status.success }
            ]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEnabled={true}
            directionalLockEnabled={true}
            alwaysBounceHorizontal={false}
            alwaysBounceVertical={false}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={width}
            scrollEventThrottle={16}
            disableIntervalMomentum={true}
            onMomentumScrollEnd={(event) => {
              const pageIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentKanbanPage(pageIndex);
            }}
            getItemLayout={(data, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item }) => renderKanbanColumn(item.title, item.key, item.items, item.icon, item.color)}
            keyExtractor={(item) => item.key}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
          />
          {/* Pagination Dots */}
          <View style={styles.paginationDots}>
            {[0, 1, 2, 3].map((index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  kanbanFlatListRef.current?.scrollToIndex({ index, animated: true });
                  setCurrentKanbanPage(index);
                }}
                style={[
                  styles.dot,
                  currentKanbanPage === index && styles.activeDot
                ]}
              />
            ))}
          </View>
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
                <Text style={styles.modalTitle}>Details</Text>
                <TouchableOpacity
                  onPress={() => setShowCommissionModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.commissionDetailContent}
                contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.detailUserHeader}>
                  <Image
                    source={{
                      uri: isArtist
                        ? (selectedCommission.client?.avatar_url || DEFAULT_AVATAR)
                        : (selectedCommission.artist?.users?.avatar_url || artistCache[selectedCommission.artist_id]?.avatar_url || DEFAULT_AVATAR)
                    }}
                    style={styles.detailAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.detailUserInfo}>
                    <Text style={styles.detailUsername} numberOfLines={1}>
                      {isArtist
                        ? (selectedCommission.client?.username || selectedCommission.client?.full_name || 'Unknown')
                        : (selectedCommission.artist?.users?.username || selectedCommission.artist?.users?.full_name || 'Unknown')}
                    </Text>
                    <View style={styles.detailRoleBadge}>
                      <Text style={styles.detailUserRole}>{isArtist ? 'CLIENT' : 'ARTIST'}</Text>
                    </View>
                  </View>
                  <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedCommission.status) + '15' }]}>
                    <Ionicons name={getStatusIcon(selectedCommission.status)} size={14} color={getStatusColor(selectedCommission.status)} />
                    <Text style={[styles.detailStatusText, { color: getStatusColor(selectedCommission.status) }]}>
                      {formatStatus(selectedCommission.status)}
                    </Text>
                  </View>
                </View>

                {selectedCommission.details && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>DESCRIPTION</Text>
                    <View style={styles.detailContentBox}>
                      <Text style={styles.detailText}>{selectedCommission.details}</Text>
                    </View>
                  </View>
                )}

                {selectedCommission.client_note && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>CLIENT NOTE</Text>
                    <View style={styles.detailNoteBox}>
                      <Text style={styles.detailText}>{selectedCommission.client_note}</Text>
                    </View>
                  </View>
                )}

                {(selectedCommission.final_price || selectedCommission.budget) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>PRICING</Text>
                    <View style={styles.detailContentBox}>
                      <Text style={styles.detailPriceText}>
                        ${selectedCommission.final_price || selectedCommission.budget}
                        {!selectedCommission.final_price && ' (Budget)'}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

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
                                await handleUpdateStatus(selectedCommission.id, 'declined');
                                setShowCommissionModal(false);
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
    paddingHorizontal: spacing.lg,
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
    fontSize: 17,
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
    gap: spacing.md,
  },
  kanbanCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.small,
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  kanbanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  kanbanAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  kanbanUserInfo: {
    flex: 1,
  },
  kanbanUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  kanbanDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  noteIconButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  kanbanDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  kanbanFooter: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
  },
  kanbanPriceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  kanbanPriceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  kanbanNoPriceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceLight,
  },
  kanbanNoPriceText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  pendingCommissionCard: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '05',
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
    padding: spacing.lg,
  },
  detailUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailAvatar: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  detailUserInfo: {
    flex: 1,
    minWidth: 0,
  },
  detailUsername: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xs,
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
  },
  detailSectionTitle: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: spacing.sm,
    letterSpacing: 1,
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
    lineHeight: 22,
  },
  detailPriceText: {
    ...typography.h2,
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
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
});
