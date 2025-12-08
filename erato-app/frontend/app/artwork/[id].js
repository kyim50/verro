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

export default function ArtworkDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuthStore();
  const { saveArtworkToBoard, boards, fetchBoards, createBoard } = useBoardStore();
  const feedStore = useFeedStore();

  const [artwork, setArtwork] = useState(null);
  const [similarArtworks, setSimilarArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

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

    try {
      // Find or create "Liked" board
      let likedBoard = boards.find(b => b.name === 'Liked');

      if (!likedBoard) {
        likedBoard = await createBoard({ name: 'Liked', is_private: true });
        await fetchBoards(); // Refresh boards after creating
        // Get the newly created board from the updated boards list
        const updatedBoards = useBoardStore.getState().boards;
        likedBoard = updatedBoards.find(b => b.name === 'Liked');
      }

      if (isLiked) {
        // Optimistically update UI
        setIsLiked(false);
        // Unlike - remove from board
        await axios.delete(`${API_URL}/boards/${likedBoard.id}/artworks/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Optimistically update UI
        setIsLiked(true);
        // Like - add to board
        await saveArtworkToBoard(likedBoard.id, id);
      }

      // Refresh boards to ensure state is in sync
      await fetchBoards();
    } catch (error) {
      console.error('Error toggling like:', error);
      console.error('Error details:', error.response?.data || error.message);

      // Rollback optimistic update on error
      setIsLiked(previousLikedState);

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
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isOwnArtwork && (
            <TouchableOpacity style={styles.headerButton} onPress={handleDeleteArtwork}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: artwork.image_url }}
            style={styles.mainImage}
            contentFit="cover"
          />
        </View>

        {/* Artwork Info */}
        <View style={styles.infoSection}>
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
          {artwork.description && (
            <Text style={styles.description}>{artwork.description}</Text>
          )}

          {/* Tags */}
          {artwork.tags && artwork.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {artwork.tags.map((tag, index) => (
                <TouchableOpacity key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.statText}>{artwork.view_count || 0} views</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.statText}>{artwork.like_count || 0} likes</Text>
            </View>
          </View>

          {/* Owner actions */}
          {isOwnArtwork && (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerActionButton} onPress={handleDeleteArtwork}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={styles.ownerActionText}>Delete artwork</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Owner actions */}
        {isOwnArtwork && (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.ownerActionButton} onPress={handleDeleteArtwork}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={styles.ownerActionText}>Delete artwork</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Artist Info */}
        <View style={styles.artistSection}>
          <TouchableOpacity
            style={styles.artistInfo}
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
              <Text style={styles.artistBio} numberOfLines={1}>
                {artwork.artists?.users?.bio || 'Artist on Verro'}
              </Text>
              {!isOwnArtwork && (
                <Text style={styles.viewProfileHint}>Tap to view profile</Text>
              )}
            </View>
          </TouchableOpacity>

          {!isOwnArtwork && (
            <TouchableOpacity
              style={styles.commissionButton}
              onPress={() => {
                if (!user) {
                  Alert.alert('Login Required', 'Please login to request a commission');
                  return;
                }
                // Check if current user is an artist
                if (user?.artists) {
                  Alert.alert('Not Available', 'Artists cannot request commissions from other artists. This feature is only available for clients.');
                  return;
                }
                router.push(`/commission/create?artistId=${artwork.artist_id}&artworkId=${artwork.id}`);
              }}
            >
              <Ionicons name="mail-outline" size={20} color={colors.text.primary} />
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
    backgroundColor: colors.overlay,
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ownerActions: {
    marginTop: spacing.sm,
  },
  ownerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ownerActionText: {
    ...typography.bodyBold,
    color: colors.error,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 80,
  },
  imageContainer: {
    width: width,
    height: height * 0.5,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  likeButton: {
    padding: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderBottomWidth: 0,
    alignItems: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  artistSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.md,
    marginTop: -spacing.md,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  artistDetails: {
    flex: 1,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  artistBio: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  viewProfileHint: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.xs - 2,
    fontWeight: '600',
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  commissionButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  similarSection: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  similarGrid: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  similarItem: {
    width: width * 0.4,
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
});
