import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useBoardStore, useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import ReviewModal from '../../components/ReviewModal';
import CreateCanvasModal from '../../components/CreateCanvasModal';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const boardStore = useBoardStore();
  const { boards, isLoading, fetchBoards, createBoard, deleteBoard } = boardStore;
  const { user, token } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const [newCanvasDescription, setNewCanvasDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState('canvases'); // 'canvases', 'commissions', 'liked'
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [likedArtists, setLikedArtists] = useState([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedSortOrder, setLikedSortOrder] = useState('newest'); // 'newest' or 'oldest'
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { userId, userName, userAvatar, commissionId, reviewType }
  const [searchQuery, setSearchQuery] = useState('');

  const isArtistUser = user?.user_type === 'artist' || 
                       (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  useEffect(() => {
    loadBoards(true);
    if (!isArtistUser) {
      loadLikedArtists();
    }
  }, []);

  // Safety: if any stale state sets activeTab to commissions, reset to canvases
  useEffect(() => {
    if (activeTab === 'commissions') {
      setActiveTab('canvases');
    }
  }, [activeTab]);

  // Refresh liked artists when tab changes or screen comes into focus
  useEffect(() => {
    if (activeTab === 'liked' && !isArtistUser && token) {
      loadLikedArtists();
    }
  }, [activeTab, isArtistUser, token]);

  // Refresh boards and liked artists when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Always refresh boards when screen comes into focus (skip cache to avoid stale counts)
      loadBoards(true);
      
      if (activeTab === 'liked' && !isArtistUser && token) {
        loadLikedArtists();
      }
    }, [activeTab, isArtistUser, token])
  );



const loadBoards = useCallback(async (skipCache = true) => {
  try {
    return await fetchBoards(null, { skipCache });
  } catch (error) {
    console.error('Error loading boards:', error);
    throw error;
  }
}, [fetchBoards]);

  const loadCommissions = async () => {
    setCommissionsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/commissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCommissions = response.data.commissions || [];
      console.log('Loaded commissions:', allCommissions.length, 'Total');
      console.log('Commission statuses:', allCommissions.map(c => c.status));
      setCommissions(allCommissions);
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const loadLikedArtists = useCallback(async () => {
    setLikedLoading(true);
    try {
      const response = await axios.get(`${API_URL}/swipes/liked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedArtists(response.data.likedArtists || []);
    } catch (error) {
      console.error('Error loading liked artists:', error);
    } finally {
      setLikedLoading(false);
    }
  }, [token]);

  const handleUnlikeArtist = async (artistId) => {
    try {
      await axios.delete(`${API_URL}/swipes/liked/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedArtists(prev => prev.filter(item => item.artist_id !== artistId));
    } catch (error) {
      console.error('Error unliking artist:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to remove artist from liked list',
        type: 'error',
      });
    }
  };

  const handleCompleteCommission = async (commissionId) => {
    const commission = commissions.find(c => c.id === commissionId);
    if (!commission) return;

    showAlert({
      title: 'Complete Commission',
      message: 'Mark this commission as completed?',
      type: 'success',
      showCancel: true,
      cancelText: 'Not Yet',
      confirmText: 'Complete',
      onConfirm: async () => {
        try {
          await axios.patch(
            `${API_URL}/commissions/${commissionId}/status`,
            { status: 'completed' },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          setShowCommissionModal(false);
          await loadCommissions();

          // Use the existing commission object since we know the IDs
          const updatedCommission = commission;

          // Determine review target based on user type - use updated commission
          if (isArtistUser) {
            // Artist completed - they review the client
            const client = updatedCommission.client || commission.client;
            if (client) {
              setReviewTarget({
                userId: client.id,
                userName: client.username || client.full_name,
                userAvatar: client.avatar_url,
                commissionId: commissionId,
                reviewType: 'artist_to_client'
              });
              setShowReviewModal(true);
            }
          } else {
            // Client completed - they review the artist
            const artist = updatedCommission.artist?.users || commission.artist?.users;
            if (artist) {
              setReviewTarget({
                userId: artist.id,
                userName: artist.username || artist.full_name,
                userAvatar: artist.avatar_url,
                commissionId: commissionId,
                reviewType: 'client_to_artist'
              });
              setShowReviewModal(true);
            }
          }
        } catch (error) {
          console.error('Error completing commission:', error);
          showAlert({
            title: 'Error',
            message: 'Failed to complete commission. Please try again.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleSubmitReview = async (rating, comment) => {
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
      showAlert({
        title: 'Success',
        message: 'Review submitted successfully!',
        type: 'success',
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit review';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        visibilityTime: 3000,
      });
      throw new Error(errorMessage);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBoards();
    if (!isArtistUser && activeTab === 'liked') {
      await loadLikedArtists();
    }
    setRefreshing(false);
  }, [isArtistUser, activeTab]);

  const handleCreateCanvas = async () => {
    if (!newCanvasName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Canvas name is required',
        type: 'error',
      });
      return;
    }

    try {
      const newBoard = await createBoard({
        name: newCanvasName.trim(),
        description: newCanvasDescription.trim() || null,
        is_public: isPublic,
        board_type: 'general',
      });

      // Verify board was created successfully
      if (!newBoard || !newBoard.id) {
        throw new Error('Board creation failed - invalid response');
      }

      console.log('Board created successfully:', newBoard.id, newBoard.name);

      // Force refresh boards list (skip cache) so it appears immediately
      const refreshedBoards = await loadBoards(true);

      // Double-check the board is in the list
      const boardsAfterRefresh = refreshedBoards || boardStore.boards;
      const boardExists = boardsAfterRefresh.some(b => b.id === newBoard.id);
      
      if (!boardExists) {
        console.warn('Board not found after refresh, forcing another fetch');
        // Force another fetch with a small delay
        setTimeout(async () => {
          try {
            await loadBoards();
            const finalBoards = boardStore.boards;
            const stillMissing = !finalBoards.some(b => b.id === newBoard.id);
            if (stillMissing) {
              console.error('Board still missing after second fetch. Board ID:', newBoard.id);
            }
          } catch (error) {
            console.error('Error in delayed board fetch:', error);
          }
        }, 500);
      } else {
        console.log('Board verified in list after refresh');
      }

      setShowCreateModal(false);
      setNewCanvasName('');
      setNewCanvasDescription('');
      setIsPublic(false);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Canvas created!',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Canvas creation error:', error);
      const errorMessage = error.message || error.response?.data?.error || 'Failed to create canvas. Please check your connection and try again.';
      showAlert({
        title: 'Error',
        message: errorMessage,
        type: 'error',
      });
    }
  };

 const handleDeleteCanvas = (canvas) => {
  // Prevent deletion of system canvases (Created, Liked)
  if (canvas.board_type === 'created' || canvas.name === 'Liked') {
    showAlert({
      title: 'Cannot Delete',
      message: 'This is a system canvas and cannot be deleted.',
      type: 'info',
    });
    return;
  }

  showAlert({
    title: 'Delete Canvas',
    message: `Are you sure you want to delete "${canvas.name}"?`,
    type: 'error',
    showCancel: true,
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await deleteBoard(canvas.id);
        await loadBoards(true);
      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete canvas';
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: errorMessage,
          visibilityTime: 4000,
          position: 'bottom',
        });
      }
    },
  });
};

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return colors.status.success;
      case 'declined': return '#F44336';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#9C27B0';
      case 'cancelled': return '#757575';
      default: return colors.text.secondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'accepted': return 'checkmark-circle-outline';
      case 'declined': return 'close-circle-outline';
      case 'in_progress': return 'hourglass-outline';
      case 'completed': return 'trophy-outline';
      case 'cancelled': return 'ban-outline';
      default: return 'help-circle-outline';
    }
  };

  const renderCanvas = ({ item }) => {
    // Calculate artwork count - backend provides total count in artworks[0].count
    // board_artworks only includes a preview slice (up to 4), so use backend count when available
    const countFromArray = item.board_artworks?.length || 0; // preview length (<=4)
    const countFromBackend = item.artworks?.[0]?.count;
    const artworkCount = (typeof countFromBackend === 'number' && countFromBackend > 0)
      ? countFromBackend
      : countFromArray;
    const firstArtworks = item.board_artworks?.slice(0, 4) || [];
    const isSystemCanvas = item.board_type === 'created' || item.name === 'Liked';

    // Format last updated time
    const getTimeAgo = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return '1d';
      if (diffDays < 7) return `${diffDays}d`;
      if (diffWeeks === 1) return '1w';
      if (diffWeeks < 4) return `${diffWeeks}w`;
      if (diffMonths === 1) return '1mo';
      return `${diffMonths}mo`;
    };

    const lastUpdated = getTimeAgo(item.updated_at || item.created_at);

    // Show canvas delete confirmation directly
    const showCanvasOptions = (e) => {
      e.stopPropagation(); // Prevent navigation
      handleDeleteCanvas(item);
    };

    return (
      <TouchableOpacity
        style={styles.canvasCard}
        onPress={() => router.push(`/board/${item.id}`)}
        activeOpacity={0.9}
        delayPressIn={50}
      >
        {/* Pinterest-style Collage - larger image on left, smaller grid on right */}
        <View style={styles.coverGrid}>
          {firstArtworks.length > 0 ? (
            <>
              {/* Large image on left */}
              <View style={styles.gridItemLarge}>
                <Image
                  source={{ uri: firstArtworks[0]?.artworks?.thumbnail_url || firstArtworks[0]?.artworks?.image_url }}
                  style={styles.gridImage}
                  contentFit="cover"
                />
              </View>

              {/* Smaller images on right */}
              <View style={styles.gridItemSmall}>
                {firstArtworks.slice(1, 4).map((ba, index) => (
                  <View key={index} style={styles.smallGridItem}>
                    <Image
                      source={{ uri: ba.artworks?.thumbnail_url || ba.artworks?.image_url }}
                      style={styles.gridImage}
                      contentFit="cover"
                    />
                  </View>
                ))}
                {firstArtworks.length < 4 && (
                  <View style={[styles.smallGridItem, styles.emptySmallGrid]} />
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyGrid}>
              <Ionicons name="images-outline" size={40} color={colors.text.disabled} />
            </View>
          )}
        </View>

        {/* Canvas Info - Pinterest style */}
        <View style={styles.canvasInfo}>
          <View style={styles.canvasTitleRow}>
            <Text style={styles.canvasName} numberOfLines={1}>
              {item.name}
            </Text>

            {/* Options button (three dots) - Show for all except "created" canvas */}
            {!isSystemCanvas && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  showCanvasOptions(e);
                }}
                style={styles.optionsButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            )}

            {!item.is_public && (
              <Ionicons name="lock-closed" size={14} color={colors.text.secondary} style={styles.lockIcon} />
            )}
          </View>
          <Text style={styles.canvasMeta}>
            {artworkCount} {artworkCount === 1 ? 'Pin' : 'Pins'}{lastUpdated ? ` • ${lastUpdated}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLikedArtist = ({ item }) => {
    const artist = item.artists;
    const artistUser = artist?.users;

    return (
      <TouchableOpacity
        style={styles.artistCard}
        onPress={() => router.push(`/artist/${item.artist_id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.artistCardContent}>
          <Image
            source={{ uri: artistUser?.avatar_url || DEFAULT_AVATAR }}
            style={styles.artistCardAvatar}
            contentFit="cover"
          />
          <View style={styles.artistCardInfo}>
            <Text style={styles.artistCardName}>
              {artistUser?.full_name || artistUser?.username || 'Unknown Artist'}
            </Text>
            <Text style={styles.artistCardBio} numberOfLines={2}>
              {artistUser?.bio || 'Artist on Verro'}
            </Text>
            {artist && (
              <View style={styles.artistCardMeta}>
                {artist.min_price && artist.max_price && (
                  <Text style={styles.artistCardPrice}>
                    ${artist.min_price} - ${artist.max_price}
                  </Text>
                )}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.unlikeButton}
            onPress={(e) => {
              e.stopPropagation();
              handleUnlikeArtist(item.artist_id);
            }}
          >
            <Ionicons name="heart" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommission = ({ item }) => {
    const isClient = item.client_id === user?.id;
    const otherUser = isClient ? item.artist?.users : item.client;
    const statusColor = getStatusColor(item.status);
    const artistName = isClient
      ? (item.artist?.users?.full_name || item.artist?.users?.username || 'Unknown')
      : (item.client?.full_name || item.client?.username || 'Unknown Client');

    return (
      <TouchableOpacity
        style={styles.commissionCard}
        onPress={() => {
          setSelectedCommission(item);
          setShowCommissionModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.commissionCardContent}>
          <View style={styles.commissionIconContainer}>
            <Ionicons name="briefcase" size={20} color={colors.primary} />
          </View>
          <Image
            source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
            style={styles.commissionAvatar}
            contentFit="cover"
          />

          <View style={styles.commissionInfo}>
            <View style={styles.commissionTopRow}>
              <Text style={styles.commissionUsername} numberOfLines={1}>{artistName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.commissionDetails} numberOfLines={2}>
              {item.details}
            </Text>

            {item.price && (
              <Text style={styles.commissionPrice}>${item.price}</Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} style={styles.commissionChevron} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="albums-outline" size={64} color={colors.text.disabled} />
        <Text style={styles.emptyTitle}>No Canvases Yet</Text>
        <Text style={styles.emptyText}>
          Create canvases to save and organize artworks you love!
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>Create Your First Canvas</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'canvases') {
      return (
        <FlatList
          key="canvases-list"
          data={boards.sort((a, b) => {
            // Pin "Created" canvas at top
            if (a.board_type === 'created') return -1;
            if (b.board_type === 'created') return 1;
            // Sort rest by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
          })}
          renderItem={renderCanvas}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 80 }
          ]}
          ListEmptyComponent={!isLoading && renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      );
    } else if (activeTab === 'liked') {
      // Sort liked artists by timestamp (from Tinder swipe view)
      const sortedLikedArtists = [...likedArtists].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return likedSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });

      return (
        <FlatList
          key="liked-artists-list"
          data={sortedLikedArtists}
          renderItem={renderLikedArtist}
          keyExtractor={(item) => item.artist_id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: spacing.md, paddingBottom: Math.max(insets.bottom, 20) + 80 }
          ]}
          ListEmptyComponent={!likedLoading && (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptyTitle}>No Liked Artists</Text>
              <Text style={styles.emptyText}>
                Artists you like will appear here. Start exploring!
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      );
    }
    return null;
  };

  // Removed commissions tab entirely; old code deleted

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Profile Picture */}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/profile')}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: user?.avatar_url || DEFAULT_AVATAR }}
                style={styles.profileAvatar}
                contentFit="cover"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={styles.tab}
                onPress={() => setActiveTab('canvases')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === 'canvases' && styles.tabTextActive]}>
                  Library
                </Text>
                {activeTab === 'canvases' && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
              {!isArtistUser && (
                <TouchableOpacity
                  style={styles.tab}
                  onPress={() => setActiveTab('liked')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
                    Liked
                  </Text>
                  {activeTab === 'liked' && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Add Button */}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Content */}
      {renderTabContent()}

      {/* Create Canvas Modal - Shared Component */}
      <CreateCanvasModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewCanvasName('');
          setIsPublic(false);
        }}
        onCreateCanvas={handleCreateCanvas}
        canvasName={newCanvasName}
        setCanvasName={setNewCanvasName}
        isPublic={isPublic}
        setIsPublic={setIsPublic}
      />

      {/* Commission Detail Modal */}
      <Modal
        visible={showCommissionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommissionModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={styles.commissionDetailModal}>
                  <SafeAreaView edges={['bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Commission Details</Text>
              <TouchableOpacity onPress={() => setShowCommissionModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {selectedCommission && (
              <ScrollView style={styles.commissionDetailContent}>
                {/* User Info */}
                <View style={styles.detailSection}>
                  <TouchableOpacity
                    style={styles.detailUserHeader}
                    onPress={() => {
                      const isClient = selectedCommission.client_id === user?.id;
                      if (isClient) {
                        // Navigate to artist profile
                        const artistId = selectedCommission.artist?.id || selectedCommission.artist_id;
                        if (artistId) {
                          setShowCommissionModal(false);
                          router.push(`/artist/${artistId}`);
                        }
                      } else {
                        // Navigate to client profile
                        const clientId = selectedCommission.client?.id || selectedCommission.client_id;
                        if (clientId) {
                          setShowCommissionModal(false);
                          router.push(`/client/${clientId}`);
                        }
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: (selectedCommission.client_id === user?.id
                          ? selectedCommission.artist?.users?.avatar_url
                          : selectedCommission.client?.avatar_url) || DEFAULT_AVATAR
                      }}
                      style={styles.detailAvatar}
                      contentFit="cover"
                    />
                    <View style={styles.detailUserInfo}>
                      <Text style={styles.detailUsername}>
                        {selectedCommission.client_id === user?.id
                          ? (selectedCommission.artist?.users?.full_name || selectedCommission.artist?.users?.username || 'Unknown')
                          : (selectedCommission.client?.full_name || selectedCommission.client?.username || 'Unknown Client')}
                      </Text>
                      <Text style={styles.detailUserRole}>
                        {selectedCommission.client_id === user?.id ? 'Artist' : 'Client'}
                      </Text>
                    </View>
                    <View style={styles.detailUserHeaderRight}>
                      <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedCommission.status) + '20' }]}>
                        <Ionicons name={getStatusIcon(selectedCommission.status)} size={16} color={getStatusColor(selectedCommission.status)} />
                        <Text style={[styles.detailStatusText, { color: getStatusColor(selectedCommission.status) }]}>
                          {selectedCommission.status.replace('_', ' ').charAt(0).toUpperCase() + selectedCommission.status.replace('_', ' ').slice(1)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} style={{ marginLeft: 8 }} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Artwork Reference */}
                {selectedCommission.artwork && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Reference Artwork</Text>
                    <View style={styles.detailArtwork}>
                      <Image
                        source={{ uri: selectedCommission.artwork.thumbnail_url || selectedCommission.artwork.image_url }}
                        style={styles.detailArtworkImage}
                        contentFit="cover"
                      />
                      <Text style={styles.detailArtworkTitle}>{selectedCommission.artwork.title}</Text>
                    </View>
                  </View>
                )}

                {/* Commission Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Description</Text>
                  <Text style={styles.detailText}>{selectedCommission.details}</Text>
                </View>

                {/* Client Note */}
                {selectedCommission.client_note && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Client Note</Text>
                    <Text style={styles.detailText}>{selectedCommission.client_note}</Text>
                  </View>
                )}

                {/* Artist Response */}
                {selectedCommission.artist_response && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Artist Response</Text>
                    <Text style={styles.detailText}>{selectedCommission.artist_response}</Text>
                  </View>
                )}

                {/* Price & Date */}
                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Price</Text>
                      <Text style={styles.detailValue}>
                        {selectedCommission.price ? `$${selectedCommission.price}` : 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Created</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedCommission.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && selectedCommission.artist_id === user?.artists?.id && (
                  <View style={styles.detailActions}>
                    <TouchableOpacity
                      style={styles.detailCancelButton}
                      onPress={() => {
                        showAlert({
                          title: 'Cancel Commission',
                          message: 'Are you sure you want to cancel this commission?',
                          type: 'warning',
                          showCancel: true,
                          cancelText: 'No',
                          confirmText: 'Yes, Cancel',
                          onConfirm: async () => {
                            try {
                              await axios.patch(
                                `${API_URL}/commissions/${selectedCommission.id}/status`,
                                { status: 'cancelled' },
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              setShowCommissionModal(false);
                              await loadCommissions();
                              showAlert({
                                title: 'Success',
                                message: 'Commission has been cancelled',
                                type: 'success',
                              });
                            } catch (error) {
                              console.error('Error cancelling commission:', error);
                              showAlert({
                                title: 'Error',
                                message: 'Failed to cancel commission. Please try again.',
                                type: 'error',
                              });
                            }
                          },
                        });
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#F44336" />
                      <Text style={styles.detailCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailCompleteButton}
                      onPress={() => handleCompleteCommission(selectedCommission.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.primary} />
                      <Text style={styles.detailCompleteButtonText}>Complete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedCommission.conversation_id && (
                  <TouchableOpacity
                    style={styles.detailMessageButton}
                    onPress={() => {
                      setShowCommissionModal(false);
                      router.push(`/messages/${selectedCommission.conversation_id}`);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
                    <Text style={styles.detailMessageButtonText}>View Conversation</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
                  </SafeAreaView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Review Modal */}
      <ReviewModal
        visible={showReviewModal}
        onClose={() => {
          setShowReviewModal(false);
          setReviewTarget(null);
        }}
        onSubmit={handleSubmitReview}
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
  headerContainer: {
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  headerSpacer: {
    flex: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderWidth: 1,
    borderColor: colors.border + '30',
    minHeight: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
  },
  searchClearButton: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sortButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  tabsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  tab: {
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.status.error,
    borderRadius: 1.5,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  canvasCard: {
    width: '48%',
    marginBottom: spacing.md + 4,
  },
  coverGrid: {
    width: '100%',
    height: 180,
    flexDirection: 'row',
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.xs + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gridItemLarge: {
    width: '60%',
    height: '100%',
    position: 'relative',
  },
  gridItemSmall: {
    width: '40%',
    height: '100%',
    flexDirection: 'column',
    borderLeftWidth: 2,
    borderLeftColor: colors.background,
  },
  smallGridItem: {
    flex: 1,
  },
  emptySmallGrid: {
    backgroundColor: colors.surfaceLight,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  emptyGrid: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  canvasInfo: {
    paddingHorizontal: spacing.xs,
  },
  canvasTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: spacing.xs,
  },
  canvasName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
  },
  lockIcon: {
    marginLeft: 2,
  },
  optionsButton: {
    padding: 4,
  },
  canvasMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400',
  },
  commissionCardWrapper: {
    marginBottom: spacing.md,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completeCommissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    gap: spacing.xs,
    marginTop: -1,
  },
  completeCommissionText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  commissionCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  commissionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commissionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  commissionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  commissionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commissionUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  commissionChevron: {
    marginTop: 2,
  },
  commissionArtwork: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  commissionArtworkImage: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
  },
  commissionArtworkTitle: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  noteContainer: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  noteLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginBottom: 2,
  },
  noteText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 13,
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  tapToViewText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
  },
  commissionPrice: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 100,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  modalBody: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.md + 2,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  publicToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md + 2,
    borderRadius: 16,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border + '60',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  modalFooter: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  saveButton: {
    width: '100%',
    padding: spacing.md + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  // Pinterest-style create board preview
  createBoardPreview: {
    alignSelf: 'center',
    marginBottom: spacing.xxl,
  },
  createBoardPreviewGrid: {
    width: 160,
    height: 160,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  previewGridItem: {
    width: '48%',
    height: '48%',
    backgroundColor: colors.border + '40',
    borderRadius: borderRadius.sm,
  },
  createBoardInputSection: {
    marginBottom: spacing.lg,
  },
  createBoardLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  createBoardNameInput: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  createBoardFormContainer: {
    flex: 1,
  },
  createBoardFormContent: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  createBoardFooter: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  createBoardButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  createBoardButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  createBoardButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  artistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  artistCardContent: {
    flexDirection: 'row',
    padding: spacing.md,
    alignItems: 'center',
  },
  artistCardAvatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    marginRight: spacing.md,
  },
  artistCardInfo: {
    flex: 1,
  },
  artistCardName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  artistCardBio: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  artistCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistCardPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  unlikeButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  commissionDetailModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.9,
    width: '100%',
  },
  commissionDetailContent: {
    padding: spacing.lg,
  },
  detailSection: {
    marginBottom: spacing.xl,
  },
  detailUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailUserHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  detailAvatar: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
  },
  detailUserInfo: {
    flex: 1,
  },
  detailUsername: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    marginBottom: 2,
  },
  detailUserRole: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  detailStatusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  detailSectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  detailText: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  detailArtwork: {
    alignItems: 'center',
  },
  detailArtworkImage: {
    width: '100%',
    height: 250,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  detailArtworkTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  detailMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  detailMessageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  detailCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: '#F44336',
  },
  detailCancelButtonText: {
    ...typography.bodyBold,
    color: '#F44336',
    fontSize: 15,
    fontWeight: '600',
  },
  detailCompleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  detailCompleteButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
