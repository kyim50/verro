import { useState, useEffect } from 'react';
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
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore, useBoardStore, useFeedStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

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
  const feedStore = useFeedStore();

  const [artwork, setArtwork] = useState(null);
  const [similarArtworks, setSimilarArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await fetchArtworkDetails();
      await fetchSimilarArtworks();
      if (token) {
        await fetchBoards();
      }
    };
    loadData();
  }, [id]);

  useEffect(() => {
    if (token && boards.length > 0) {
      checkIfLiked();
    }
  }, [boards, id, token]);

  const fetchArtworkDetails = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artworks/${id}`, { headers });
      // The API returns {artwork: {...}} not just the artwork object
      const artworkData = response.data.artwork || response.data;
      setArtwork(artworkData);
    } catch (error) {
      console.error('Error fetching artwork:', error);
      Alert.alert('Error', 'Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const checkIfLiked = async () => {
    try {
      const likedBoard = boards.find(b => b.name === 'Liked');
      if (likedBoard) {
        const response = await axios.get(`${API_URL}/boards/${likedBoard.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // The API returns board_artworks array, each with artwork_id
        const artworkIds = response.data.board_artworks?.map(ba => String(ba.artwork_id)) || [];
        setIsLiked(artworkIds.includes(String(id)));
      } else {
        setIsLiked(false);
      }
    } catch (error) {
      console.error('Error checking like status:', error);
      setIsLiked(false);
    }
  };

  const handleLike = async () => {
    if (!token) {
      Alert.alert('Login Required', 'Please login to like artworks');
      return;
    }

    // Store previous state for rollback
    const previousLikedState = isLiked;
    const previousLikeCount = artwork?.like_count || 0;

    try {
      // Optimistically update UI
      setIsLiked(!isLiked);
      if (artwork) {
        setArtwork({
          ...artwork,
          like_count: isLiked ? Math.max(0, previousLikeCount - 1) : previousLikeCount + 1
        });
      }

      if (isLiked) {
        // Unlike - call unlike endpoint which handles both board and count
        const response = await axios.post(`${API_URL}/artworks/${id}/unlike`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update like count from response
        if (artwork && response.data.likeCount !== undefined) {
          setArtwork({ ...artwork, like_count: response.data.likeCount });
        }
      } else {
        // Like - call like endpoint which handles both board and count
        const response = await axios.post(`${API_URL}/artworks/${id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update like count from response
        if (artwork && response.data.likeCount !== undefined) {
          setArtwork({ ...artwork, like_count: response.data.likeCount });
        }
      }

      // Refresh boards to ensure state is in sync
      await fetchBoards();
    } catch (error) {
      console.error('Error toggling like:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Rollback optimistic update on error
      setIsLiked(previousLikedState);
      if (artwork) {
        setArtwork({ ...artwork, like_count: previousLikeCount });
      }

      // Show user-friendly error message
      const errorMessage = error.response?.data?.error || 'Failed to update like status';
      Alert.alert('Error', errorMessage);
    }
  };

  const fetchSimilarArtworks = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artworks`, {
        params: { limit: 6 },
        headers
      });
      setSimilarArtworks(response.data.artworks || []);
    } catch (error) {
      console.error('Error fetching similar artworks:', error);
    }
  };

  const handleDeleteArtwork = () => {
    if (!token || !artwork || artwork.artist_id !== user?.id) return;
    Alert.alert(
      'Delete Artwork',
      'Are you sure you want to delete this artwork? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/artworks/${artwork.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });

              // Optimistically remove from local feed
              try {
                feedStore.removeArtwork?.(artwork.id);
              } catch (e) {
                console.warn('Local feed removal failed:', e?.message || e);
              }

              // Force refetch feed to drop the deleted item everywhere
              try {
                feedStore.reset?.();
                await feedStore.fetchArtworks?.(true);
              } catch (e) {
                console.warn('Feed refresh after delete failed:', e?.message || e);
              }

              // Refresh boards (e.g., Created board) to remove it there too
              try {
                await fetchBoards();
              } catch (e) {
                console.warn('Boards refresh after delete failed:', e?.message || e);
              }

              Alert.alert('Deleted', 'Artwork removed');
              router.back();
            } catch (error) {
              console.error('Error deleting artwork:', error?.response?.data || error.message || error);
              const msg = error.response?.data?.error || 'Failed to delete artwork. Please try again.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
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
          {/* Title and Like */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{artwork.title}</Text>
            <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={28}
                color={isLiked ? "#FF6B6B" : colors.text.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="eye-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.statChipText}>{artwork.view_count || 0} views</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="heart-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.statChipText}>{artwork.like_count || 0} likes</Text>
            </View>
          </View>
        </View>

        {/* Artist Card */}
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
              source={{ uri: artwork.artists?.users?.avatar_url || 'https://via.placeholder.com/80' }}
              style={styles.artistAvatar}
              contentFit="cover"
            />
            <View style={styles.artistDetails}>
              <Text style={styles.artistName}>
                {artwork.artists?.users?.full_name || artwork.artists?.users?.username || 'Unknown Artist'}
              </Text>
              <Text style={styles.artistBio} numberOfLines={2}>
                {artwork.artists?.users?.bio || 'Artist on Verro'}
              </Text>
            </View>
            {!isOwnArtwork && (
              <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
            )}
          </TouchableOpacity>

          {!isOwnArtwork && user?.user_type !== 'artist' && !user?.artists && (
            <TouchableOpacity
              style={styles.commissionButton}
              onPress={() => {
                if (!user) {
                  Alert.alert('Login Required', 'Please login to request a commission');
                  return;
                }
                router.push(`/commission/create?artistId=${artwork.artist_id}&artworkId=${artwork.id}`);
              }}
            >
              <Ionicons name="mail-outline" size={18} color={colors.text.primary} />
              <Text style={styles.commissionButtonText}>Request Commission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Similar Artworks */}
        {similarArtworks.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.sectionTitle}>More Like This</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarGrid}
            >
              {similarArtworks.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.similarItem}
                  onPress={() => router.push(`/artwork/${item.id}`)}
                >
                  <Image
                    source={{ uri: item.thumbnail_url || item.image_url }}
                    style={styles.similarImage}
                    contentFit="cover"
                  />
                  <Text style={styles.similarTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
                Alert.alert('Share', 'Share functionality coming soon');
              }}
            >
              <Ionicons name="share-outline" size={22} color={colors.text.primary} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.medium,
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
    paddingTop: spacing.sm,
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
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
    flex: 1,
    lineHeight: IS_VERY_SMALL_SCREEN ? 28 : IS_SMALL_SCREEN ? 32 : 36,
    fontWeight: '700',
  },
  likeButton: {
    padding: spacing.xs,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statChipText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: IS_SMALL_SCREEN ? 22 : 24,
    marginTop: spacing.md,
    marginBottom: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
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
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  deleteButtonText: {
    ...typography.bodyBold,
    color: colors.error,
    fontSize: 15,
  },
  artistCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
  },
  artistCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistAvatar: {
    width: width < 375 ? 44 : 48,
    height: width < 375 ? 44 : 48,
    borderRadius: width < 375 ? 22 : 24,
    backgroundColor: colors.background,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  artistDetails: {
    flex: 1,
    minWidth: 0,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: width < 375 ? 15 : 16,
    marginBottom: 2,
    fontWeight: '600',
  },
  artistBio: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: width < 375 ? 12 : 13,
    lineHeight: 16,
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    ...shadows.small,
  },
  commissionButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  similarSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontSize: width < 375 ? 20 : 22,
    fontWeight: '700',
  },
  similarGrid: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  similarItem: {
    width: width < 375 ? width * 0.38 : width * 0.4,
  },
  similarImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  similarTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
