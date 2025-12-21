import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore, useBoardStore, useFeedStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import { useEngagementTracking } from '../../hooks/useEngagementTracking';
import SaveToBoardModal from '../../components/SaveToBoardModal';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 44;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;
const HEADER_HEIGHT = STATUS_BAR_HEIGHT + (IS_SMALL_SCREEN ? spacing.xs : spacing.sm) + (IS_SMALL_SCREEN ? 36 : 40) + spacing.xs;
const SCROLL_PADDING_TOP = HEADER_HEIGHT;
const IMAGE_HEIGHT = IS_SMALL_SCREEN ? Math.min(height * 0.55, width * 1.2) : Math.min(height * 0.6, width * 1.3);

export default function ArtworkDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuthStore();
  const { saveArtworkToBoard, boards, fetchBoards, createBoard } = useBoardStore();
  const { likedArtworks, setLikedArtwork, loadLikedArtworks, removeArtwork, reset, fetchArtworks } = useFeedStore();

  const [artwork, setArtwork] = useState(null);
  const [similarArtworks, setSimilarArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const isLikingRef = useRef(false); // Prevent useEffect from interfering during like operation

  // Get liked state from shared store
  const isLiked = likedArtworks.has(String(id));

  // Track engagement
  const { trackLike, trackSave, trackCommissionInquiry } = useEngagementTracking(id, {
    trackView: true,
    source: 'artwork_detail',
  });

  useEffect(() => {
    const loadData = async () => {
      await fetchArtworkDetails();
      if (token) {
        const fetchedBoards = await fetchBoards();
        // Load liked artworks from shared store using fetched boards
        if (fetchedBoards && fetchedBoards.length > 0) {
          await loadLikedArtworks(fetchedBoards, token, false);
        }
      }
    };
    loadData();
  }, [id]);

  // Fetch similar artworks after artwork data is loaded
  useEffect(() => {
    if (artwork) {
      fetchSimilarArtworks();
    }
  }, [artwork?.id, artwork?.tags, artwork?.style_id]);

  useEffect(() => {
    // Load liked artworks when boards are loaded, but don't reload during like operation
    // Only load if not already loaded to avoid overwriting current state
    if (token && boards.length > 0 && !isLikingRef.current) {
      // Use a longer timeout to ensure any like operation has completed
      // This prevents reloading from overwriting our optimistic updates
      const timer = setTimeout(() => {
        if (!isLikingRef.current) {
          const { likedArtworksLoaded } = useFeedStore.getState();
          // Only load if not already loaded to avoid overwriting
          if (!likedArtworksLoaded) {
            console.log('Loading liked artworks from useEffect');
            loadLikedArtworks(boards, token, false).catch(() => {});
          } else {
            console.log('Skipping load - already loaded');
          }
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [boards, token]);

  const fetchArtworkDetails = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artworks/${id}`, { headers });
      // The API returns {artwork: {...}} not just the artwork object
      const artworkData = response.data.artwork || response.data;
      setArtwork(artworkData);
    } catch (error) {
      console.error('Error fetching artwork:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load artwork',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };


  const handleLike = async () => {
    if (!token) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please login to like artworks',
        visibilityTime: 2000,
      });
      return;
    }

    // Prevent multiple simultaneous like operations
    if (isLikingRef.current) return;
    isLikingRef.current = true;

    // Store previous state for rollback
    const previousLikedState = isLiked;
    const previousLikeCount = artwork?.like_count || 0;

    try {
      // Optimistically update UI - update shared store immediately
      const newLikedState = !isLiked;
      setLikedArtwork(id, newLikedState);
      
      if (artwork) {
        setArtwork({
          ...artwork,
          like_count: newLikedState ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1)
        });
      }

      // Always call /like endpoint - it toggles automatically
      const response = await axios.post(`${API_URL}/artworks/${id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Like API Response:', response.data);
      
      // The backend returns: { message: 'Artwork liked' or 'Artwork unliked', likeCount: number }
      const message = response.data.message || '';
      const newLikeCount = response.data.likeCount ?? previousLikeCount;
      
      // Determine final state from message (most reliable)
      // Message is either "Artwork liked" or "Artwork unliked"
      const isNowLiked = message === 'Artwork liked';
      
      console.log('Setting liked state:', { id, isNowLiked, message, newLikeCount });
      
      // Update shared store with authoritative backend response
      setLikedArtwork(id, isNowLiked);
      
      // Verify the update worked
      setTimeout(() => {
        const currentState = useFeedStore.getState().likedArtworks;
        console.log('Current liked artworks after update:', Array.from(currentState));
        console.log('Is artwork liked?', currentState.has(String(id)));
      }, 100);

      // Update like count from response
      if (artwork) {
        setArtwork({ ...artwork, like_count: newLikeCount });
      }

      // Track engagement if liked (not unliked)
      if (isNowLiked) {
        trackLike({ like_count: newLikeCount });
      }

      // DON'T refresh boards immediately - it causes reloading which resets state
      // The backend has already updated the board, so we trust our local state
      // We manually add to the store, so we don't need to reload from server
      // Reset the flag immediately so user can like/unlike again
      isLikingRef.current = false;
    } catch (error) {
      console.error('Error toggling like:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Rollback optimistic update on error - restore shared store state
      setLikedArtwork(id, previousLikedState);
      if (artwork) {
        setArtwork({ ...artwork, like_count: previousLikeCount });
      }

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error || 'Failed to update like status';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        visibilityTime: 3000,
      });
      
      // Reset the ref on error
      isLikingRef.current = false;
    }
  };

  const fetchSimilarArtworks = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let filteredArtworks = [];

      // Strategy 1: Try to fetch from the same artist first
      if (artwork?.artist_id) {
        try {
          console.log('Fetching artworks from same artist:', artwork.artist_id);
          const artistResponse = await axios.get(`${API_URL}/artists/${artwork.artist_id}/artworks`, {
            params: { limit: 20 },
            headers
          });
          const artistArtworks = artistResponse.data.artworks || artistResponse.data || [];
          filteredArtworks = artistArtworks.filter(item => item.id !== artwork?.id);
          console.log('Found artworks from same artist:', filteredArtworks.length);
        } catch (artistError) {
          console.log('Could not fetch from artist, trying general fetch');
        }
      }

      // Strategy 2: If we don't have enough artworks, try filtered search
      if (filteredArtworks.length < 10) {
        const params = { limit: 20 };

        // If artwork has tags, use them to find similar content
        if (artwork?.tags && artwork.tags.length > 0) {
          params.tags = artwork.tags.join(',');
        }

        // If artwork has a style, prioritize that style
        if (artwork?.style_id) {
          params.style = artwork.style_id;
        }

        console.log('Fetching similar artworks with params:', params);

        const response = await axios.get(`${API_URL}/artworks`, {
          params,
          headers
        });

        console.log('Similar artworks response:', response.data);

        const allArtworks = response.data.artworks || response.data.data || [];
        const moreArtworks = allArtworks.filter(
          item => item.id !== artwork?.id && !filteredArtworks.find(a => a.id === item.id)
        );

        filteredArtworks = [...filteredArtworks, ...moreArtworks];
      }

      // Strategy 3: If still not enough, fetch general artworks
      if (filteredArtworks.length < 10) {
        console.log('Not enough similar artworks, fetching general artworks');
        const response = await axios.get(`${API_URL}/artworks`, {
          params: { limit: 20 },
          headers
        });
        const allArtworks = response.data.artworks || response.data.data || [];
        const moreArtworks = allArtworks.filter(
          item => item.id !== artwork?.id && !filteredArtworks.find(a => a.id === item.id)
        );
        filteredArtworks = [...filteredArtworks, ...moreArtworks];
      }

      console.log('Final filtered artworks count:', filteredArtworks.length);
      setSimilarArtworks(filteredArtworks.slice(0, 20)); // Limit to 20 total
    } catch (error) {
      console.error('Error fetching similar artworks:', error);
      console.error('Error details:', error.response?.data || error.message);
    }
  };

  const handleSaveToBoard = async (boardId, artworkId) => {
    try {
      await saveArtworkToBoard(boardId, artworkId);
      trackSave({ board_id: boardId });
    } catch (error) {
      console.error('Error saving to board:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleDeleteArtwork = () => {
    if (!token || !artwork || artwork.artist_id !== user?.id) return;
    showAlert({
      title: 'Delete Artwork',
      message: 'Are you sure you want to delete this artwork? This cannot be undone.',
      type: 'error',
      showCancel: true,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/artworks/${artwork.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Optimistically remove from local feed
          try {
            removeArtwork?.(artwork.id);
          } catch (e) {
            console.warn('Local feed removal failed:', e?.message || e);
          }

          // Force refetch feed to drop the deleted item everywhere
          try {
            reset?.();
            await fetchArtworks?.(true);
          } catch (e) {
            console.warn('Feed refresh after delete failed:', e?.message || e);
          }

          // Refresh boards (e.g., Created board) to remove it there too
          try {
            await fetchBoards();
          } catch (e) {
            console.warn('Boards refresh after delete failed:', e?.message || e);
          }

          Toast.show({
            type: 'success',
            text1: 'Deleted',
            text2: 'Artwork removed',
            visibilityTime: 2000,
          });
          router.back();
        } catch (error) {
          console.error('Error deleting artwork:', error?.response?.data || error.message || error);
          const msg = error.response?.data?.error || 'Failed to delete artwork. Please try again.';
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: msg,
            visibilityTime: 3000,
          });
        }
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!artwork) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Artwork not found</Text>
      </View>
    );
  }

  const isOwnArtwork = user?.id === artwork.artist_id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Image - Card container with rounded edges */}
        <View style={styles.imageCardContainer}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: artwork.image_url }}
              style={styles.mainImage}
              contentFit="cover"
            />
          </View>
        </View>

        {/* Content Section - Below image, no overlap */}
        <View style={styles.contentSection}>
          {/* Action Row - Pinterest-style Save and Like */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
                if (!token) {
                  Toast.show({
                    type: 'info',
                    text1: 'Login Required',
                    text2: 'Please login to save artworks',
                    visibilityTime: 2000,
                  });
                  return;
                }
                setShowSaveModal(true);
              }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLike} style={styles.likeButtonRound}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? colors.primary : colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>{artwork.title}</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="eye-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.statChipText}>{artwork.view_count || 0} views</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="heart-outline" size={16} color={colors.text.secondary} />
              <Text style={styles.statChipText}>{artwork.like_count || 0} likes</Text>
            </View>
          </View>
        </View>

        {/* Artist Card - Pinterest-style clean profile card */}
        <View style={styles.artistCard}>
          <TouchableOpacity
            style={styles.artistCardContent}
            onPress={() => {
              if (!isOwnArtwork && artwork.artist_id) {
                router.push(`/artist/${artwork.artist_id}`);
              }
            }}
            activeOpacity={isOwnArtwork ? 1 : 0.7}
          >
            <Image
              source={{ uri: artwork.artists?.users?.avatar_url || DEFAULT_AVATAR }}
              style={styles.artistAvatar}
              contentFit="cover"
            />
            <View style={styles.artistDetails}>
              <Text style={styles.artistName}>
                {artwork.artists?.users?.full_name || artwork.artists?.users?.username || 'Unknown Artist'}
              </Text>
              <Text style={styles.artistBio} numberOfLines={2}>
                {artwork.artists?.users?.bio || 'Artist'}
              </Text>
            </View>
            {!isOwnArtwork && (
              <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
            )}
          </TouchableOpacity>

          {!isOwnArtwork && user?.user_type !== 'artist' && !user?.artists && (
            <TouchableOpacity
              style={styles.commissionButton}
              onPress={() => {
                if (!user) {
                  Toast.show({
                    type: 'info',
                    text1: 'Login Required',
                    text2: 'Please login to request a commission',
                    visibilityTime: 2000,
                  });
                  return;
                }
                // Track commission inquiry engagement
                trackCommissionInquiry({ artist_id: artwork.artist_id });
                router.push(`/commission/create?artistId=${artwork.artist_id}&artworkId=${artwork.id}`);
              }}
            >
              <Ionicons name="mail" size={20} color="#000" />
              <Text style={styles.commissionButtonText}>Request Commission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* More Like This - Pinterest-style Masonry Grid */}
        {similarArtworks.length > 0 && (
          <View style={styles.moreSection}>
            <Text style={styles.moreSectionTitle}>More like this</Text>
            <View style={styles.masonryGrid}>
              {/* Left Column */}
              <View style={styles.masonryColumn}>
                {similarArtworks.filter((_, idx) => idx % 2 === 0).map((item, index) => (
                  <View key={item.id} style={styles.masonryItemWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.masonryItem,
                        { height: index % 3 === 0 ? 220 : index % 3 === 1 ? 180 : 200 }
                      ]}
                      onPress={() => {
                        router.push(`/artwork/${item.id}`);
                      }}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: item.thumbnail_url || item.image_url }}
                        style={styles.masonryImage}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                    {/* Title and Menu below image - like home screen */}
                    <View style={styles.masonryItemFooter}>
                      <Text style={styles.masonryItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.masonryMenuButton}
                        onPress={() => {
                          // Could add save/share options here
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Right Column */}
              <View style={styles.masonryColumn}>
                {similarArtworks.filter((_, idx) => idx % 2 === 1).map((item, index) => (
                  <View key={item.id} style={styles.masonryItemWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.masonryItem,
                        { height: index % 3 === 0 ? 200 : index % 3 === 1 ? 220 : 180 }
                      ]}
                      onPress={() => {
                        router.push(`/artwork/${item.id}`);
                      }}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: item.thumbnail_url || item.image_url }}
                        style={styles.masonryImage}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                    {/* Title and Menu below image - like home screen */}
                    <View style={styles.masonryItemFooter}>
                      <Text style={styles.masonryItemTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <TouchableOpacity
                        style={styles.masonryMenuButton}
                        onPress={() => {
                          // Could add save/share options here
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {isOwnArtwork && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleDeleteArtwork();
                }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.status.error} />
                <Text style={[styles.menuItemText, { color: colors.status.error }]}>
                  Delete Artwork
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                // TODO: Implement share functionality
                Toast.show({
                  type: 'info',
                  text1: 'Share',
                  text2: 'Share functionality coming soon',
                  visibilityTime: 2000,
                });
              }}
            >
              <Ionicons name="share-outline" size={22} color={colors.text.primary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Save to Board Modal */}
      <SaveToBoardModal
        visible={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        boards={boards}
        onSaveToBoard={handleSaveToBoard}
        artworkId={id}
      />
    </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingTop: STATUS_BAR_HEIGHT + spacing.xs,
    paddingBottom: spacing.xs,
    zIndex: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    height: HEADER_HEIGHT,
  },
  headerButton: {
    width: IS_SMALL_SCREEN ? 36 : 40,
    height: IS_SMALL_SCREEN ? 36 : 40,
    borderRadius: IS_SMALL_SCREEN ? 18 : 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer Pinterest overlay
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0, // Remove border for cleaner look
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: SCROLL_PADDING_TOP,
    paddingBottom: spacing.xxl,
  },
  imageCardContainer: {
    marginHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    marginTop: spacing.sm,
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    borderRadius: 20, // Pinterest-style soft rounding
    backgroundColor: colors.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, // Soft Pinterest shadow
    shadowRadius: 16,
    elevation: 4,
  },
  imageCardContainer: {
    marginHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    marginTop: spacing.sm,
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    borderRadius: 20, // Pinterest-style soft rounding
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: colors.surface,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    backgroundColor: colors.background,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  likeButtonRound: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_VERY_SMALL_SCREEN ? 22 : IS_SMALL_SCREEN ? 24 : 28,
    lineHeight: IS_VERY_SMALL_SCREEN ? 28 : IS_SMALL_SCREEN ? 32 : 36,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  likeButton: {
    padding: spacing.sm,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface + '80',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: IS_SMALL_SCREEN ? 22 : 24,
    marginTop: spacing.md,
    marginBottom: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '400', // Pinterest-style
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  ownerActions: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '10',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full, // Pill shape
    borderWidth: 0, // Remove border
  },
  deleteButtonText: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 15,
  },
  artistCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: 20, // Pinterest-style soft rounding
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, // Soft Pinterest shadow
    shadowRadius: 12,
    elevation: 2,
  },
  artistCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistAvatar: {
    width: width < 375 ? 56 : 64,
    height: width < 375 ? 56 : 64,
    borderRadius: width < 375 ? 28 : 32,
    backgroundColor: colors.background,
    marginRight: spacing.md,
    borderWidth: 0,
  },
  artistDetails: {
    flex: 1,
    minWidth: 0,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    fontSize: width < 375 ? 16 : 17,
    marginBottom: 3,
    fontWeight: '600', // Pinterest-style
  },
  artistBio: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: width < 375 ? 13 : 14,
    fontWeight: '400', // Pinterest-style
    lineHeight: 18,
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
    width: '100%',
  },
  commissionButtonText: {
    ...typography.button,
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Pinterest-style "More like this" Section
  moreSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  moreSectionTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  masonryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  masonryColumn: {
    flex: 1,
    gap: spacing.lg,
  },
  masonryItemWrapper: {
    marginBottom: spacing.xs,
  },
  masonryItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  masonryImage: {
    width: '100%',
    height: '100%',
  },
  masonryItemFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  masonryItemTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  masonryMenuButton: {
    padding: spacing.xs - 2,
    marginTop: -2,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  menuItemText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
  },
});
