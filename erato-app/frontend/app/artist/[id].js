import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Alert,
  Modal,
  StatusBar,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useBoardStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const SPACING = 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING - spacing.md * 2) / NUM_COLUMNS;

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [artist, setArtist] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [boards, setBoards] = useState([]);
  const [createdBoard, setCreatedBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPortfolioIndex, setSelectedPortfolioIndex] = useState(null);
  const portfolioFlatListRef = useRef(null);

  useEffect(() => {
    fetchArtistProfile();
  }, [id]);

  const fetchArtistProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch artist profile
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const artistResponse = await axios.get(`${API_URL}/artists/${id}`, { headers });
      setArtist(artistResponse.data);

      // Fetch artist's artworks (uploaded by this artist)
      try {
        const artworksResponse = await axios.get(`${API_URL}/artworks?artistId=${id}`, { headers });
        setArtworks(artworksResponse.data.artworks || []);
      } catch (artworkError) {
        console.error('Error fetching artworks:', artworkError);
        setArtworks([]);
      }

      // Fetch artist's boards
      const boardsResponse = await axios.get(`${API_URL}/users/${artistResponse.data.user_id}/boards`, { headers });
      const allBoards = boardsResponse.data;

      // Separate "Created" board from other boards
      const created = allBoards.find(b => b.board_type === 'created');
      const others = allBoards.filter(b => b.board_type !== 'created');

      setCreatedBoard(created);
      setBoards(others);
    } catch (err) {
      console.error('Error fetching artist profile:', err);
      setError(err.response?.data?.error || 'Failed to load artist profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!token) {
      Alert.alert('Login Required', 'Please log in to message this artist');
      return;
    }

    try {
      // Create or get existing conversation
      const response = await axios.post(
        `${API_URL}/messages/conversations`,
        { participant_ids: [artist.user_id || id] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Navigate to the conversation
      router.push(`/messages/${response.data.conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      // Check if it's a permission error
      if (error.response?.status === 403) {
        Alert.alert(
          'Commission Required',
          error.response?.data?.error || 'You must have an accepted commission with this artist before you can message them.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Request Commission',
              onPress: () => router.push(`/commission/create?artistId=${id}`)
            }
          ]
        );
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to start conversation. Please try again.');
      }
    }
  };

  const handleCommission = () => {
    if (!token) {
      Alert.alert('Login Required', 'Please log in to request a commission');
      return;
    }

    // Check if current user is an artist
    if (user?.artists) {
      Alert.alert('Not Available', 'Artists cannot request commissions from other artists. This feature is only available for clients.');
      return;
    }

    if (artist?.commission_status !== 'open') {
      Alert.alert('Commissions Closed', 'This artist is not currently accepting commissions');
      return;
    }

    router.push(`/commission/create?artistId=${id}`);
  };

  const renderArtwork = ({ item, index }) => {
    const heightMultipliers = [1.2, 1.5, 1.3, 1.6, 1.4];
    const imageHeight = ITEM_WIDTH * heightMultipliers[index % heightMultipliers.length];

    return (
      <TouchableOpacity
        style={[styles.artworkCard, { height: imageHeight }]}
        onPress={() => router.push(`/artwork/${item.id}`)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.thumbnail_url || item.image_url }}
          style={styles.artworkImage}
          contentFit="cover"
        />
      </TouchableOpacity>
    );
  };

  const renderBoard = ({ item }) => {
    const artworksToShow = item.board_artworks?.slice(0, 3) || [];
    const remainingCount = (item.artwork_count || 0) - artworksToShow.length;

    return (
      <TouchableOpacity
        style={styles.boardCard}
        onPress={() => router.push(`/board/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.boardPreview}>
          {artworksToShow.length > 0 ? (
            <>
              {artworksToShow.map((artwork, idx) => (
                <Image
                  key={artwork.artworks?.id || idx}
                  source={{ uri: artwork.artworks?.thumbnail_url || artwork.artworks?.image_url }}
                  style={[
                    styles.boardPreviewImage,
                    idx === 0 && styles.boardPreviewMain,
                    idx > 0 && styles.boardPreviewSmall,
                  ]}
                  contentFit="cover"
                />
              ))}
            </>
          ) : (
            <View style={styles.emptyBoardPreview}>
              <Ionicons name="images-outline" size={40} color={colors.text.disabled} />
            </View>
          )}
        </View>

        <View style={styles.boardInfo}>
          <Text style={styles.boardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.boardCount}>
            {item.artwork_count || 0} {item.artwork_count === 1 ? 'artwork' : 'artworks'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading artist profile...</Text>
      </View>
    );
  }

  if (error || !artist) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'Artist not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchArtistProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProfile = user?.id === artist.user_id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(tabs)/home');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artist Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Artist Header */}
        <View style={styles.artistHeader}>
          <Image
            source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/120' }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.nameSection}>
            <Text style={styles.artistName}>
              {artist.users?.full_name || artist.users?.username}
            </Text>
            <Text style={styles.artistUsername}>@{artist.users?.username}</Text>
            {artist.average_rating && artist.average_rating > 0 && (
              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= Math.round(artist.average_rating) ? "star" : "star-outline"}
                      size={18}
                      color={colors.status.warning}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {artist.average_rating.toFixed(1)} ({artist.review_count || 0} {artist.review_count === 1 ? 'review' : 'reviews'})
                </Text>
              </View>
            )}
          </View>

          {artist.users?.bio && (
            <Text style={styles.bio}>{artist.users.bio}</Text>
          )}

          {/* Social Links */}
          {artist.social_links && Object.keys(artist.social_links).length > 0 && (
            <View style={styles.socialLinksContainer}>
              {artist.social_links.instagram && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    const url = artist.social_links.instagram.startsWith('http')
                      ? artist.social_links.instagram
                      : `https://instagram.com/${artist.social_links.instagram}`;
                    await Linking.openURL(url);
                  }}
                >
                  <Ionicons name="logo-instagram" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}
              {artist.social_links.twitter && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    const url = artist.social_links.twitter.startsWith('http')
                      ? artist.social_links.twitter
                      : `https://twitter.com/${artist.social_links.twitter}`;
                    await Linking.openURL(url);
                  }}
                >
                  <Ionicons name="logo-twitter" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}
              {artist.social_links.tiktok && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    const url = artist.social_links.tiktok.startsWith('http')
                      ? artist.social_links.tiktok
                      : `https://tiktok.com/@${artist.social_links.tiktok}`;
                    await Linking.openURL(url);
                  }}
                >
                  <Ionicons name="logo-tiktok" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}
              {artist.social_links.youtube && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    const url = artist.social_links.youtube.startsWith('http')
                      ? artist.social_links.youtube
                      : `https://youtube.com/@${artist.social_links.youtube}`;
                    await Linking.openURL(url);
                  }}
                >
                  <Ionicons name="logo-youtube" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}
              {artist.social_links.website && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    await Linking.openURL(artist.social_links.website);
                  }}
                >
                  <Ionicons name="globe-outline" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{artist.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
              <Text style={styles.statValue}>{artist.total_commissions || 0}</Text>
              <Text style={styles.statLabel}>Commissions</Text>
            </View>
            {artist.min_price && artist.max_price && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="cash-outline" size={20} color={colors.primary} />
                  <Text style={styles.statValue}>
                    ${artist.min_price} - ${artist.max_price}
                  </Text>
                  <Text style={styles.statLabel}>Price Range</Text>
                </View>
              </>
            )}
          </View>

          {/* Commission Status */}
          <View style={[styles.statusBadge, artist.commission_status === 'open' ? styles.statusOpen : styles.statusClosed]}>
            <Ionicons
              name={artist.commission_status === 'open' ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={artist.commission_status === 'open' ? colors.success : colors.error}
            />
            <Text style={[styles.statusText, artist.commission_status === 'open' ? styles.statusOpenText : styles.statusClosedText]}>
              Commissions {artist.commission_status === 'open' ? 'Open' : 'Closed'}
            </Text>
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.commissionButton,
                  artist.commission_status !== 'open' && styles.commissionButtonDisabled,
                ]}
                onPress={handleCommission}
                disabled={artist.commission_status !== 'open'}
              >
                <Ionicons name="brush-outline" size={20} color={colors.text.primary} />
                <Text style={styles.commissionButtonText}>
                  {artist.commission_status === 'open' ? 'Request Commission' : 'Commissions Closed'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Portfolio Images */}
        {artist.portfolio_images && artist.portfolio_images.length > 0 && (
          <View style={[styles.section, { paddingHorizontal: 0 }]}>
            <View style={[styles.sectionHeader, { paddingHorizontal: spacing.lg }]}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="images-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Portfolio</Text>
              </View>
            </View>

            <FlatList
              data={artist.portfolio_images}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.portfolioCard}
                  onPress={() => setSelectedPortfolioIndex(index)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: item }}
                    style={styles.portfolioImage}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.portfolioList}
              snapToAlignment="start"
              decelerationRate="fast"
              snapToInterval={width * 0.85 + spacing.md}
            />
          </View>
        )}

        {/* All Artworks Section */}
        {artworks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="grid-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>All Artworks</Text>
              </View>
              <Text style={styles.artworkCountText}>{artworks.length} artworks</Text>
            </View>

            <FlatList
              data={artworks}
              renderItem={renderArtwork}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Created Board (Pinned) */}
        {createdBoard && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Created</Text>
              </View>
              <TouchableOpacity onPress={() => router.push(`/board/${createdBoard.id}`)}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {createdBoard.board_artworks && createdBoard.board_artworks.length > 0 ? (
              <FlatList
                data={createdBoard.board_artworks.map(ba => ba.artworks).slice(0, 6)}
                renderItem={renderArtwork}
                keyExtractor={(item, index) => item?.id || index.toString()}
                numColumns={2}
                columnWrapperStyle={styles.row}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyCreated}>
                <Ionicons name="images-outline" size={48} color={colors.text.disabled} />
                <Text style={styles.emptyText}>No artworks yet</Text>
              </View>
            )}
          </View>
        )}

        {/* Other Boards */}
        {boards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Boards</Text>
            </View>

            <FlatList
              data={boards}
              renderItem={renderBoard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Portfolio Modal Viewer */}
      <Modal
        visible={selectedPortfolioIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPortfolioIndex(null)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" />

          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedPortfolioIndex(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalCounter}>
              {selectedPortfolioIndex !== null ? `${selectedPortfolioIndex + 1} / ${artist?.portfolio_images?.length || 0}` : ''}
            </Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          {/* Image Viewer */}
          <FlatList
            ref={portfolioFlatListRef}
            data={artist?.portfolio_images || []}
            renderItem={({ item }) => (
              <View style={styles.modalImageContainer}>
                <Image
                  source={{ uri: item }}
                  style={styles.modalImage}
                  contentFit="contain"
                />
              </View>
            )}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedPortfolioIndex || 0}
            getItemLayout={(data, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setSelectedPortfolioIndex(newIndex);
            }}
          />
        </View>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.error,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  retryText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  artistHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
  },
  artistName: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  artistUsername: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  statusOpen: {
    backgroundColor: `${colors.success}20`,
  },
  statusClosed: {
    backgroundColor: `${colors.error}20`,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statusOpenText: {
    color: colors.success,
  },
  statusClosedText: {
    color: colors.error,
  },
  actionButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  messageButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  commissionButton: {
    backgroundColor: colors.primary,
  },
  commissionButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commissionButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  artworkCountText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  artworkCard: {
    width: ITEM_WIDTH,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  emptyCreated: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.sm,
  },
  boardCard: {
    width: ITEM_WIDTH,
    marginBottom: spacing.md,
  },
  boardPreview: {
    width: '100%',
    height: ITEM_WIDTH * 1.3,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  boardPreviewImage: {
    backgroundColor: colors.surface,
  },
  boardPreviewMain: {
    width: '100%',
    height: '70%',
  },
  boardPreviewSmall: {
    width: '50%',
    height: '30%',
  },
  emptyBoardPreview: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  boardInfo: {
    marginTop: spacing.sm,
  },
  boardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  boardCount: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  portfolioList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  portfolioCard: {
    width: width * 0.85,
    height: width * 1.1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCounter: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalImageContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  socialLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  socialLink: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
