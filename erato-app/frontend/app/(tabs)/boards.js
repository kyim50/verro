import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useBoardStore, useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import ReviewModal from '../../components/ReviewModal';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function BoardsScreen() {
  const { boards, isLoading, fetchBoards, createBoard, deleteBoard } = useBoardStore();
  const { user, token } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState('boards'); // 'boards', 'commissions', 'liked'
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [likedArtists, setLikedArtists] = useState([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedSortOrder, setLikedSortOrder] = useState('newest'); // 'newest' or 'oldest'
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { userId, userName, userAvatar, commissionId, reviewType }

  const isArtistUser = user?.user_type === 'artist' || 
                       (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  useEffect(() => {
    loadBoards();
    if (!isArtistUser) {
      loadLikedArtists();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'liked' && !isArtistUser) {
      loadLikedArtists();
    }
  }, [activeTab, isArtistUser]);

  // Refresh liked artists when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'liked' && !isArtistUser && token) {
        loadLikedArtists();
      }
    }, [activeTab, isArtistUser, token])
  );

  const loadBoards = async () => {
    try {
      await fetchBoards();
    } catch (error) {
      console.error('Error loading boards:', error);
    }
  };

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

  const loadLikedArtists = async () => {
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
  };

  const handleUnlikeArtist = async (artistId) => {
    try {
      await axios.delete(`${API_URL}/swipes/liked/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedArtists(prev => prev.filter(item => item.artist_id !== artistId));
    } catch (error) {
      console.error('Error unliking artist:', error);
      Alert.alert('Error', 'Failed to remove artist from liked list');
    }
  };

  const handleCompleteCommission = async (commissionId) => {
    const commission = commissions.find(c => c.id === commissionId);
    if (!commission) return;

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
              Alert.alert('Error', 'Failed to complete commission. Please try again.');
            }
          }
        }
      ]
    );
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
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Review submitted successfully!',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      throw new Error(error.response?.data?.error || 'Failed to submit review');
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

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      Alert.alert('Error', 'Board name is required');
      return;
    }

    try {
      await createBoard({
        name: newBoardName.trim(),
        description: newBoardDescription.trim(),
        is_public: isPublic,
      });

      setShowCreateModal(false);
      setNewBoardName('');
      setNewBoardDescription('');
      setIsPublic(false);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Board created!',
        visibilityTime: 2000,
      });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create board');
    }
  };

  const handleDeleteBoard = (board) => {
    Alert.alert(
      'Delete Board',
      `Are you sure you want to delete "${board.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBoard(board.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete board');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#4CAF50';
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

  const renderBoard = ({ item }) => {
    const artworkCount = item.artworks?.[0]?.count || 0;
    const firstArtworks = item.board_artworks?.slice(0, 4) || [];
    const isCreatedBoard = item.board_type === 'created';

    return (
      <TouchableOpacity
        style={[styles.boardCard, isCreatedBoard && styles.createdBoardCard]}
        onPress={() => router.push(`/board/${item.id}`)}
        activeOpacity={0.9}
      >
        {/* Cover Grid - show first 4 artworks */}
        <View style={styles.coverGrid}>
          {firstArtworks.length > 0 ? (
            firstArtworks.map((ba, index) => (
              <View key={index} style={styles.gridItem}>
                <Image
                  source={{ uri: ba.artworks?.thumbnail_url || ba.artworks?.image_url }}
                  style={styles.gridImage}
                  contentFit="cover"
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyGrid}>
              <Ionicons name="images-outline" size={40} color={colors.text.disabled} />
            </View>
          )}
        </View>

        {/* Board Info */}
        <View style={styles.boardInfo}>
          <View style={styles.boardHeader}>
            <View style={styles.boardTitleRow}>
              <Text style={styles.boardName} numberOfLines={1}>
                {item.name}
              </Text>
              {isCreatedBoard && (
                <View style={styles.createdBadge}>
                  <Ionicons name="cloud-upload-outline" size={12} color={colors.primary} />
                </View>
              )}
            </View>
            {!isCreatedBoard && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteBoard(item);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {item.description && (
            <Text style={styles.boardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.boardFooter}>
            <Text style={styles.artworkCount}>
              {artworkCount} {artworkCount === 1 ? 'Pin' : 'Pins'}
            </Text>
            {!item.is_public && (
              <Ionicons name="lock-closed" size={14} color={colors.text.secondary} />
            )}
          </View>
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
        <Text style={styles.emptyTitle}>No Collections Yet</Text>
        <Text style={styles.emptyText}>
          Create boards to save and organize artworks you love!
        </Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>Create Your First Board</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'boards') {
      return (
        <FlatList
          key="boards-list"
          data={boards.sort((a, b) => {
            // Pin "Created" board at top
            if (a.board_type === 'created') return -1;
            if (b.board_type === 'created') return 1;
            // Sort rest by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
          })}
          renderItem={renderBoard}
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
          contentContainerStyle={styles.listContent}
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
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.md }]}
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

  // Removed commissions and liked tab content - keeping old code commented for reference
  const renderTabContentOld = () => {
    if (activeTab === 'boards') {
      return (
        <FlatList
          key="boards-list"
          data={boards.sort((a, b) => {
            // Pin "Created" board at top
            if (a.board_type === 'created') return -1;
            if (b.board_type === 'created') return 1;
            // Sort rest by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
          })}
          renderItem={renderBoard}
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
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!isLoading && renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      );
    } else if (activeTab === 'commissions') {
      // Check if user is an artist
      const isArtist = !!user?.artists;
      console.log('Is artist?', isArtist, 'User has artists:', user?.artists);

      // Filter commissions based on user type
      // Artists: only show in_progress and completed commissions (pending requests are in messages)
      // Clients: show all commissions
      const filteredCommissions = isArtist
        ? commissions.filter(c => c.status === 'in_progress' || c.status === 'completed')
        : commissions;

      console.log('Filtered commissions:', filteredCommissions.length, 'out of', commissions.length);
      console.log('Filtered statuses:', filteredCommissions.map(c => c.status));

      return (
        <FlatList
          key="commissions-list"
          data={filteredCommissions}
          renderItem={renderCommission}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.md }]}
          ListEmptyComponent={!commissionsLoading && renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      );
    } else if (activeTab === 'liked') {
      // Sort liked artists by timestamp
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
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.md }]}
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'boards' && styles.tabActive]}
          onPress={() => setActiveTab('boards')}
        >
          <Ionicons
            name="albums"
            size={20}
            color={activeTab === 'boards' ? colors.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'boards' && styles.tabTextActive]}>
            Library
          </Text>
        </TouchableOpacity>
        {!isArtistUser && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
            onPress={() => setActiveTab('liked')}
          >
            <Ionicons
              name="heart"
              size={20}
              color={activeTab === 'liked' ? colors.primary : colors.text.secondary}
            />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.tabTextActive]}>
              Liked
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {renderTabContent()}

      {/* Create Board Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Board</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="My Favorite Art"
                placeholderTextColor={colors.text.disabled}
                value={newBoardName}
                onChangeText={setNewBoardName}
                autoFocus
              />

              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's this board about?"
                placeholderTextColor={colors.text.disabled}
                value={newBoardDescription}
                onChangeText={setNewBoardDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.publicToggle}
                onPress={() => setIsPublic(!isPublic)}
              >
                <View style={styles.toggleLeft}>
                  <Ionicons
                    name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                    size={20}
                    color={colors.text.primary}
                  />
                  <View>
                    <Text style={styles.toggleLabel}>
                      {isPublic ? 'Public' : 'Private'}
                    </Text>
                    <Text style={styles.toggleDescription}>
                      {isPublic ? 'Anyone can see this board' : 'Only you can see this board'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, isPublic && styles.switchActive]}>
                  <View style={[styles.switchThumb, isPublic && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateBoard}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Commission Detail Modal */}
      <Modal
        visible={showCommissionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.commissionDetailModal}>
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
                        Alert.alert(
                          'Cancel Commission',
                          'Are you sure you want to cancel this commission?',
                          [
                            { text: 'No', style: 'cancel' },
                            {
                              text: 'Yes, Cancel',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await axios.patch(
                                    `${API_URL}/commissions/${selectedCommission.id}/status`,
                                    { status: 'cancelled' },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  setShowCommissionModal(false);
                                  await loadCommissions();
                                  Toast.show({
                                    type: 'success',
                                    text1: 'Success',
                                    text2: 'Commission has been cancelled',
                                    visibilityTime: 2000,
                                  });
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
                      <Ionicons name="close-circle-outline" size={20} color="#F44336" />
                      <Text style={styles.detailCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailCompleteButton}
                      onPress={() => handleCompleteCommission(selectedCommission.id)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
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
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 28,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  tabTextActive: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  boardCard: {
    width: '48%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.small,
  },
  createdBoardCard: {
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  coverGrid: {
    width: '100%',
    height: 160,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surfaceLight,
  },
  gridItem: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: colors.background,
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
  },
  boardInfo: {
    padding: spacing.md,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  boardName: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
    fontSize: 16,
  },
  createdBadge: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    padding: 4,
  },
  boardDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  boardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artworkCount: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
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
    backgroundColor: '#4CAF50',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    gap: spacing.xs,
    marginTop: -1,
  },
  completeCommissionText: {
    ...typography.button,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commissionCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
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
    ...typography.h2,
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  publicToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
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
  },
  toggleDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
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
    backgroundColor: colors.text.primary,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
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
    maxHeight: '90%',
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
    backgroundColor: '#4CAF50',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  detailCompleteButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
