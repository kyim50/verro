import { useState, useEffect, useRef, useCallback } from 'react';
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
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useBoardStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;
const SPACING = IS_SMALL_SCREEN ? 3 : 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING - (IS_SMALL_SCREEN ? spacing.sm : spacing.md) * 2) / NUM_COLUMNS;

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [artist, setArtist] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [packages, setPackages] = useState([]);
  const [isPackagesLoading, setIsPackagesLoading] = useState(false);
  const [boards, setBoards] = useState([]);
  const [createdBoard, setCreatedBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPortfolioIndex, setSelectedPortfolioIndex] = useState(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [columns, setColumns] = useState([[], []]);
  const [createdColumns, setCreatedColumns] = useState([[], []]);
  const portfolioFlatListRef = useRef(null);
  const isClosingModal = useRef(false);
  const lastClosedIndex = useRef(null);
  const lastCloseTime = useRef(0);

  useEffect(() => {
    fetchArtistProfile();
  }, [id]);

  const fetchArtistPackages = async (artistId, headers) => {
    setIsPackagesLoading(true);
    try {
      const response = await axios.get(`${API_URL}/artists/${artistId}/packages`, { headers });
      setPackages(response.data || []);
    } catch (err) {
      console.error('Error fetching artist packages:', err);
      setPackages([]);
    } finally {
      setIsPackagesLoading(false);
    }
  };

  const fetchArtistProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch artist profile
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const artistResponse = await axios.get(`${API_URL}/artists/${id}`, { headers });
      
      // Filter out empty/invalid portfolio images before setting state
      const artistData = { ...artistResponse.data };
      if (artistData.portfolio_images) {
        artistData.portfolio_images = artistData.portfolio_images.filter(img => {
          if (!img || typeof img !== 'string') return false;
          const trimmed = img.trim();
          if (!trimmed) return false;
          return trimmed.startsWith('http://') || trimmed.startsWith('https://');
        });
      }
      
      setArtist(artistData);
      await fetchArtistPackages(id, headers);

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

      // Fetch board details with artworks for each board to get thumbnails
      const boardsWithArtworks = await Promise.all(
        allBoards.map(async (board) => {
          try {
            const boardDetailResponse = await axios.get(`${API_URL}/boards/${board.id}`, { headers });
            return {
              ...board,
              artwork_count: board.artwork_count || (boardDetailResponse.data.board_artworks?.length || 0),
              board_artworks: boardDetailResponse.data.board_artworks || [],
            };
          } catch (err) {
            console.error(`Error fetching board ${board.id}:`, err);
            return { ...board, board_artworks: [] };
          }
        })
      );

      // Separate "Created" board from other boards
      const created = boardsWithArtworks.find(b => b.board_type === 'created');
      const others = boardsWithArtworks.filter(b => b.board_type !== 'created');

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
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to message this artist',
        visibilityTime: 2000,
      });
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
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.response?.data?.error || 'Failed to start conversation. Please try again.',
          visibilityTime: 3000,
        });
      }
    }
  };

  const handleCloseModal = () => {
    if (selectedPortfolioIndex === null || isClosingModal.current) {
      return;
    }
    
    // Immediately prevent any portfolio interactions - set both ref and state
    isClosingModal.current = true;
    setIsModalClosing(true);
    const indexToClose = selectedPortfolioIndex;
    lastClosedIndex.current = indexToClose;
    lastCloseTime.current = Date.now();
    
    // Close the modal immediately
    setSelectedPortfolioIndex(null);
    
    // Keep blocking for much longer to ensure no touches from closing propagate through
    // The fade animation is ~300ms, but we need extra time for React to process the state change
    setTimeout(() => {
      isClosingModal.current = false;
      setIsModalClosing(false);
    }, 1000);
  };

  const handleCommission = () => {
    if (!token) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to request a commission',
        visibilityTime: 2000,
      });
      return;
    }

    // Check if current user is an artist
    if (user?.artists) {
      Toast.show({
        type: 'info',
        text1: 'Not Available',
        text2: 'Artists cannot request commissions from other artists. This feature is only available for clients.',
        visibilityTime: 3000,
      });
      return;
    }

    if (artist?.commission_status !== 'open') {
      Toast.show({
        type: 'info',
        text1: 'Commissions Closed',
        text2: 'This artist is not currently accepting commissions',
        visibilityTime: 3000,
      });
      return;
    }

    router.push(`/commission/create?artistId=${id}`);
  };

  // Organize artworks into balanced columns (Pinterest masonry style)
  useEffect(() => {
    if (artworks.length > 0) {
      const newColumns = [[], []];
      const columnHeights = [0, 0];

      artworks.forEach((item) => {
        // Calculate image height based on aspect ratio if available
        let imageHeight;
        const ratio = item.aspect_ratio || item.aspectRatio; // Handle both snake_case and camelCase

        if (ratio && typeof ratio === 'string' && ratio.includes(':')) {
          const parts = ratio.split(':');
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);

          // Ensure valid numbers
          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            imageHeight = ITEM_WIDTH * (h / w);
          } else {
            // Use default 4:5 ratio if invalid
            imageHeight = ITEM_WIDTH * 1.25;
          }
        } else {
          // Use default 4:5 ratio for artworks without aspect ratio
          imageHeight = ITEM_WIDTH * 1.25;
        }

        const textHeight = 60; // Space for title + artist name below image
        const totalHeight = imageHeight + textHeight;

        // Add to the shorter column
        const shortestColumnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;

        newColumns[shortestColumnIndex].push({
          ...item,
          imageHeight,
          totalHeight,
        });

        columnHeights[shortestColumnIndex] += totalHeight + SPACING;
      });

      setColumns(newColumns);
    } else {
      setColumns([[], []]);
    }
  }, [artworks]);

  // Organize created board artworks into balanced columns
  useEffect(() => {
    if (createdBoard && createdBoard.board_artworks && createdBoard.board_artworks.length > 0) {
      const createdArtworks = createdBoard.board_artworks.map(ba => ba.artworks).filter(Boolean);
      const newColumns = [[], []];
      const columnHeights = [0, 0];

      createdArtworks.forEach((item) => {
        let imageHeight;
        const ratio = item.aspect_ratio || item.aspectRatio;

        if (ratio && typeof ratio === 'string' && ratio.includes(':')) {
          const parts = ratio.split(':');
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);

          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            imageHeight = ITEM_WIDTH * (h / w);
          } else {
            imageHeight = ITEM_WIDTH * 1.25;
          }
        } else {
          imageHeight = ITEM_WIDTH * 1.25;
        }

        const textHeight = 60;
        const totalHeight = imageHeight + textHeight;

        const shortestColumnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;

        newColumns[shortestColumnIndex].push({
          ...item,
          imageHeight,
          totalHeight,
        });

        columnHeights[shortestColumnIndex] += totalHeight + SPACING;
      });

      setCreatedColumns(newColumns);
    } else {
      setCreatedColumns([[], []]);
    }
  }, [createdBoard]);

  const renderArtwork = (item) => {
    return (
      <View key={item.id} style={styles.masonryCard}>
        <TouchableOpacity
          style={styles.masonryImageContainer}
          onPress={() => router.push(`/artwork/${item.id}`)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: item.thumbnail_url || item.image_url }}
            style={[styles.masonryImage, { height: item.imageHeight }]}
            contentFit="cover"
            transition={200}
          />
        </TouchableOpacity>
        
        <View style={styles.masonryTextContainer}>
          <Text style={styles.masonryTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.artists?.users && (
            <Text style={styles.masonryArtistName} numberOfLines={1}>
              {item.artists.users.username}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderBoard = ({ item }) => {
    const artworkCount = item.artwork_count || 0;
    const firstArtworks = item.board_artworks?.slice(0, 4) || [];

    return (
      <TouchableOpacity
        style={styles.boardCard}
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
            <Text style={styles.boardName} numberOfLines={1}>
              {item.name}
            </Text>
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
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/120' }}
              style={styles.avatar}
              contentFit="cover"
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameContainer}>
            <Text style={styles.artistName} numberOfLines={1}>
              {artist.users?.full_name || artist.users?.username}
            </Text>
            <Text style={styles.artistUsername} numberOfLines={1}>
              @{artist.users?.username}
            </Text>
          </View>

          {/* Rating (if available) */}
          {artist.average_rating && artist.average_rating > 0 && (
            <View style={styles.ratingContainer}>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(artist.average_rating) ? "star" : "star-outline"}
                    size={16}
                    color={colors.status.warning}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {artist.average_rating.toFixed(1)} ({artist.review_count || 0} {artist.review_count === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}

          {/* Bio */}
          {artist.users?.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {artist.users.bio}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{artist.rating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{artist.total_commissions || 0}</Text>
              <Text style={styles.statLabel}>Commissions</Text>
            </View>
            {artist.min_price && artist.max_price && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="cash-outline" size={18} color={colors.primary} />
                  <Text style={styles.statValue} numberOfLines={1}>
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
              size={14}
              color={artist.commission_status === 'open' ? colors.success : colors.error}
            />
            <Text style={[styles.statusText, artist.commission_status === 'open' ? styles.statusOpenText : styles.statusClosedText]}>
              Commissions {artist.commission_status === 'open' ? 'Open' : 'Closed'}
            </Text>
          </View>

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
                  <Ionicons name="logo-instagram" size={22} color={colors.text.primary} />
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
                  <Ionicons name="logo-twitter" size={22} color={colors.text.primary} />
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
                  <Ionicons name="logo-tiktok" size={22} color={colors.text.primary} />
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
                  <Ionicons name="logo-youtube" size={22} color={colors.text.primary} />
                </TouchableOpacity>
              )}
              {artist.social_links.website && (
                <TouchableOpacity
                  style={styles.socialLink}
                  onPress={async () => {
                    await Linking.openURL(artist.social_links.website);
                  }}
                >
                  <Ionicons name="globe-outline" size={22} color={colors.text.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              {/* Show Message button for artists (they can message each other) */}
              {(user?.user_type === 'artist' || user?.artists) && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.messageButton]}
                  onPress={handleMessage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
              )}
              {/* Show Request Commission button only for clients */}
              {user?.user_type !== 'artist' && !user?.artists && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.commissionButton,
                    artist.commission_status !== 'open' && styles.commissionButtonDisabled,
                  ]}
                  onPress={handleCommission}
                  disabled={artist.commission_status !== 'open'}
                  activeOpacity={0.8}
                >
                  <Ionicons name="brush-outline" size={20} color={artist.commission_status === 'open' ? colors.text.primary : colors.text.secondary} />
                  <Text style={[
                    styles.commissionButtonText,
                    artist.commission_status !== 'open' && styles.commissionButtonTextDisabled
                  ]}>
                    {artist.commission_status === 'open' ? 'Request Commission' : 'Commissions Closed'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Packages */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Commission Packages</Text>
              </View>
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.manageLink}
                  onPress={() => router.push('/commission-packages')}
                >
                  <Text style={styles.manageLinkText}>Manage</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {isPackagesLoading ? (
              <View style={styles.packagesLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : packages.length === 0 ? (
              <View style={styles.packageEmpty}>
                <Ionicons name="cube-outline" size={28} color={colors.text.secondary} />
                <Text style={styles.packageEmptyTitle}>No packages yet</Text>
                {isOwnProfile ? (
                  <Text style={styles.packageEmptySubtitle}>
                    Add packages to showcase pricing and turnaround to clients.
                  </Text>
                ) : (
                  <Text style={styles.packageEmptySubtitle}>
                    This artist hasn’t published packages yet.
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.packagesGrid}>
                {packages.map((pkg) => (
                  <View key={pkg.id} style={styles.packageCard}>
                    {pkg.example_image_urls?.length > 0 && (
                      <Image
                        source={{ uri: pkg.example_image_urls[0] }}
                        style={styles.packageImage}
                        contentFit="cover"
                        transition={150}
                      />
                    )}
                    <View style={styles.packageCardHeader}>
                      <Text style={styles.packageTitle} numberOfLines={1}>{pkg.name}</Text>
                      <View style={styles.packageBadge}>
                        <Text style={styles.packageBadgeText}>PACKAGE</Text>
                      </View>
                    </View>
                    <Text style={styles.packagePrice}>${pkg.base_price}</Text>
                    {pkg.description && (
                      <Text style={styles.packageDescription} numberOfLines={3}>
                        {pkg.description}
                      </Text>
                    )}
                    <View style={styles.packageMetaRow}>
                      {pkg.estimated_delivery_days && (
                        <View style={styles.packageMetaItem}>
                          <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
                          <Text style={styles.packageMetaText}>{pkg.estimated_delivery_days} days</Text>
                        </View>
                      )}
                      <View style={styles.packageMetaItem}>
                        <Ionicons name="refresh-outline" size={14} color={colors.text.secondary} />
                        <Text style={styles.packageMetaText}>{pkg.revision_count || 0} revisions</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

        {/* Portfolio Images */}
        {(() => {
          // Filter out empty/invalid portfolio images with strict validation
          const filteredPortfolio = (artist.portfolio_images || []).filter(img => {
            if (!img || typeof img !== 'string') return false;
            const trimmed = img.trim();
            if (!trimmed) return false;
            return trimmed.startsWith('http://') || trimmed.startsWith('https://');
          });
          
          return filteredPortfolio.length > 0 && (
            <View 
              style={[styles.section, { paddingHorizontal: 0, position: 'relative' }]}
              pointerEvents={isModalClosing ? 'none' : 'auto'}
            >
              {/* Touch blocker when modal is closing */}
              {isModalClosing && (
                <View style={styles.touchBlocker} />
              )}
              <View style={[styles.sectionHeader, { paddingHorizontal: spacing.lg }]}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Portfolio</Text>
                </View>
              </View>

              <FlatList
                data={filteredPortfolio}
                scrollEnabled={selectedPortfolioIndex === null && !isModalClosing}
                renderItem={({ item, index }) => {
                const handlePortfolioPress = (e) => {
                  // Stop any event propagation immediately
                  if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  
                  // Prevent opening if modal is visible
                  if (selectedPortfolioIndex !== null) {
                    return;
                  }
                  
                  // Block if we're in closing state - CRITICAL CHECK (check both ref and state)
                  if (isClosingModal.current || isModalClosing) {
                    return;
                  }
                  
                  // Extended cooldown to prevent reopening of the same image that was just closed
                  const timeSinceClose = Date.now() - lastCloseTime.current;
                  if (lastClosedIndex.current === index && timeSinceClose < 1000) {
                    return;
                  }
                  
                  // Final check before opening - must pass ALL checks
                  if (!isClosingModal.current && !isModalClosing && selectedPortfolioIndex === null) {
                    setSelectedPortfolioIndex(index);
                  }
                };

                const imageUrl = item.trim();
                // Double-check URL validity before rendering
                if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
                  return null;
                }

                return (
                  <TouchableOpacity
                    style={styles.portfolioCard}
                    onPress={handlePortfolioPress}
                    activeOpacity={0.9}
                    disabled={selectedPortfolioIndex !== null || isModalClosing}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.portfolioImage}
                      contentFit="cover"
                      onError={(error) => {
                        console.warn('Portfolio image failed to load:', imageUrl, error);
                      }}
                    />
                  </TouchableOpacity>
                );
              }}
                keyExtractor={(item, index) => `${item.trim()}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.portfolioList}
                snapToAlignment="start"
                decelerationRate="fast"
                snapToInterval={width * 0.85 + spacing.md}
                pointerEvents={isModalClosing ? 'none' : 'auto'}
              />
            </View>
          );
        })()}

        {/* All Artworks Section */}
        {artworks.length > 0 && (
          <View style={[styles.section, { paddingBottom: SPACING }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="grid-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>All Artworks</Text>
              </View>
              <Text style={styles.artworkCountText}>{artworks.length} artworks</Text>
            </View>

            <View style={styles.masonryContainer}>
              {/* Left Column */}
              <View style={styles.masonryColumn}>
                {columns[0].map(item => renderArtwork(item))}
              </View>

              {/* Right Column */}
              <View style={styles.masonryColumn}>
                {columns[1].map(item => renderArtwork(item))}
              </View>
            </View>
          </View>
        )}

        {/* Created Board (Pinned) */}
        {createdBoard && createdBoard.board_artworks && createdBoard.board_artworks.length > 0 ? (
          <View style={[styles.section, { paddingBottom: SPACING }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Created</Text>
              </View>
              <TouchableOpacity onPress={() => router.push(`/board/${createdBoard.id}`)}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.masonryContainer}>
              {/* Left Column */}
              <View style={styles.masonryColumn}>
                {createdColumns[0].map(item => renderArtwork(item))}
              </View>

              {/* Right Column */}
              <View style={styles.masonryColumn}>
                {createdColumns[1].map(item => renderArtwork(item))}
              </View>
            </View>
          </View>
        ) : createdBoard ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Created</Text>
              </View>
            </View>
            <View style={styles.emptyCreated}>
              <Ionicons name="images-outline" size={48} color={colors.text.disabled} />
              <Text style={styles.emptyText}>No artworks yet</Text>
            </View>
          </View>
        ) : null}

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
      {(() => {
        // Filter portfolio images with strict validation for modal
        const filteredPortfolio = (artist?.portfolio_images || []).filter(img => {
          if (!img || typeof img !== 'string') return false;
          const trimmed = img.trim();
          if (!trimmed) return false;
          return trimmed.startsWith('http://') || trimmed.startsWith('https://');
        });
        
        return (
          <Modal
            visible={selectedPortfolioIndex !== null && filteredPortfolio.length > 0}
            transparent={true}
            animationType="fade"
            onRequestClose={handleCloseModal}
          >
            <View style={styles.modalContainer}>
              <StatusBar barStyle="light-content" />

              {/* Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={handleCloseModal}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.modalCounter}>
                  {selectedPortfolioIndex !== null ? `${selectedPortfolioIndex + 1} / ${filteredPortfolio.length}` : ''}
                </Text>
                <View style={styles.modalHeaderSpacer} />
              </View>

              {/* Image Viewer */}
              <FlatList
                ref={portfolioFlatListRef}
                data={filteredPortfolio}
                renderItem={({ item }) => {
                  const imageUrl = item.trim();
                  // Double-check URL validity
                  if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
                    return null;
                  }
                  return (
                    <View style={styles.modalImageContainer}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.modalImage}
                        contentFit="contain"
                        onError={(error) => {
                          console.warn('Portfolio modal image failed to load:', imageUrl, error);
                        }}
                      />
                    </View>
                  );
                }}
                keyExtractor={(item, index) => `${item.trim()}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={selectedPortfolioIndex !== null && selectedPortfolioIndex < filteredPortfolio.length ? selectedPortfolioIndex : 0}
                getItemLayout={(data, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  // Don't update index if modal is closing or already closed
                  if (isClosingModal.current || isModalClosing || selectedPortfolioIndex === null) {
                    return;
                  }
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                  // Only update if we have a valid index and modal is still visible
                  if (newIndex >= 0 && newIndex < filteredPortfolio.length && selectedPortfolioIndex !== null) {
                    setSelectedPortfolioIndex(newIndex);
                  }
                }}
              />
            </View>
          </Modal>
        );
      })()}
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingTop: IS_SMALL_SCREEN ? Constants.statusBarHeight + spacing.sm : Constants.statusBarHeight + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
  },
  content: {
    paddingBottom: IS_SMALL_SCREEN ? spacing.xl : spacing.xxl,
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingTop: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  avatarContainer: {
    marginBottom: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 100 : 110,
    height: IS_SMALL_SCREEN ? 100 : 110,
    borderRadius: IS_SMALL_SCREEN ? 50 : 55,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    width: '100%',
  },
  artistName: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  artistUsername: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    textAlign: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 3,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: IS_SMALL_SCREEN ? 20 : 22,
    paddingHorizontal: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
    gap: spacing.xs,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 0,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border + '40',
    marginHorizontal: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: IS_SMALL_SCREEN ? spacing.xs + 2 : spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statusOpen: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  statusClosed: {
    backgroundColor: colors.error + '15',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusOpenText: {
    color: colors.success,
  },
  statusClosedText: {
    color: colors.error,
  },
  socialLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  socialLink: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  actionButtons: {
    width: '100%',
    marginTop: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    width: '100%',
  },
  messageButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border + '50',
  },
  messageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  commissionButton: {
    backgroundColor: colors.primary,
  },
  commissionButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border + '50',
  },
  commissionButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  commissionButtonTextDisabled: {
    color: colors.text.secondary,
  },
  section: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    marginTop: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
  },
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manageLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
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
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING,
    paddingTop: SPACING,
  },
  masonryColumn: {
    flex: 1,
    paddingHorizontal: SPACING / 2,
  },
  masonryCard: {
    width: '100%',
    marginBottom: SPACING,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  masonryImageContainer: {
    position: 'relative',
  },
  masonryImage: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
  },
  masonryTextContainer: {
    padding: spacing.sm,
    paddingTop: spacing.xs,
  },
  masonryTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    marginBottom: 4,
  },
  masonryArtistName: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
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
  packagesLoading: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  packageCard: {
    flexBasis: '48%',
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '70',
  },
  packageImage: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceLight,
  },
  packageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  packageTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    flex: 1,
    fontSize: 16,
  },
  packageBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  packageBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  packagePrice: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  packageDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  packageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  packageMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageMetaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  packageEmpty: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '60',
    alignItems: 'center',
    gap: spacing.xs,
  },
  packageEmptyTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  packageEmptySubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  boardCard: {
    width: ITEM_WIDTH,
    marginBottom: spacing.md,
  },
  coverGrid: {
    width: '100%',
    height: ITEM_WIDTH,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: colors.background,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
  },
  emptyGrid: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  boardInfo: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  boardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    flex: 1,
  },
  boardDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    marginBottom: spacing.xs,
  },
  boardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  artworkCount: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
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
  touchBlocker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
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
});
