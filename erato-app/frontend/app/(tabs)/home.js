import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { useFeedStore, useBoardStore, useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import SearchModal from '../../components/SearchModal';
import StylePreferenceQuiz from '../../components/StylePreferenceQuiz';
import ArtistFilters from '../../components/ArtistFilters';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const SPACING = width < 400 ? 3 : 4; // Tighter spacing on smaller screens
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING) / NUM_COLUMNS;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    artworks,
    fetchArtworks,
    reset,
    hasMore,
    isLoading,
    updateArtworkLikeCount,
    likedArtworks,
    setLikedArtwork,
    loadLikedArtworks: loadLikedArtworksFromStore,
    likedArtworksLoaded,
  } = useFeedStore();
  const { boards, fetchBoards, saveArtworkToBoard, createBoard } = useBoardStore();
  const { token, user: currentUser } = useAuthStore();
  const { profile: userProfile } = useProfileStore();
  const isArtist = currentUser?.user_type === 'artist';
  const [refreshing, setRefreshing] = useState(false);
  const [columns, setColumns] = useState([[], []]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDiscoverArtists, setShowDiscoverArtists] = useState(false);
  const [discoverArtists, setDiscoverArtists] = useState([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [artistFilters, setArtistFilters] = useState({});
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' or 'foryou'
  const [forYouArtworks, setForYouArtworks] = useState([]);
  const [forYouPage, setForYouPage] = useState(1);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const scrollViewRef = useRef(null);
  const loadingRef = useRef(false);
  const lastFocusTimeRef = useRef(0);
  const lastTapRef = useRef({});
  const heartAnimationRef = useRef({});
  const heartScaleAnims = useRef({});
  const heartOpacityAnims = useRef({});
  const [heartAnimations, setHeartAnimations] = useState({});
  const [avatarKey, setAvatarKey] = useState(0);

  // Load liked artworks from shared store
  const loadLikedArtworks = useCallback(async (forceReload = false) => {
    if ((likedArtworksLoaded && !forceReload) || !token || loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      await loadLikedArtworksFromStore(boards, token, forceReload);
    } catch (error) {
      if (error.response?.status !== 429) {
        console.error('Error loading liked artworks:', error);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [boards, token, likedArtworksLoaded, loadLikedArtworksFromStore]);

  // Load liked artworks when boards are available
  useEffect(() => {
    if (token && boards.length > 0) {
      loadLikedArtworks(false);
    }
  }, [token, boards.length]);

  // Load filtered artists
  const loadFilteredArtists = useCallback(async (filters = null) => {
    const currentFilters = filters || artistFilters;
    if (Object.keys(currentFilters).length === 0) {
      setDiscoverArtists([]);
      setShowDiscoverArtists(false);
      return;
    }

    setLoadingArtists(true);
    setShowDiscoverArtists(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      
      if (currentFilters.styles?.length > 0) {
        params.append('styles', currentFilters.styles.join(','));
      }
      if (currentFilters.price_min !== undefined) {
        params.append('price_min', currentFilters.price_min);
      }
      if (currentFilters.price_max !== undefined) {
        params.append('price_max', currentFilters.price_max);
      }
      if (currentFilters.turnaround_max !== undefined) {
        params.append('turnaround_max', currentFilters.turnaround_max);
      }
      if (currentFilters.language) {
        params.append('language', currentFilters.language);
      }

      const response = await axios.get(`${API_URL}/artists?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setDiscoverArtists(response.data.artists || []);
    } catch (error) {
      console.error('Error loading filtered artists:', error);
      setDiscoverArtists([]);
    } finally {
      setLoadingArtists(false);
    }
  }, [artistFilters, token]);

  const handleApplyFilters = (newFilters) => {
    setArtistFilters(newFilters);
    loadFilteredArtists(newFilters);
  };

  // Load For You artworks
  const loadForYouArtworks = useCallback(async (reset = false) => {
    if (loadingRef.current || forYouLoading || (!reset && !forYouHasMore)) return;
    
    loadingRef.current = true;
    setForYouLoading(true);
    const page = reset ? 1 : forYouPage;

    try {
      const response = await axios.get(`${API_URL}/artworks`, {
        params: { page, limit: 20 },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      const newArtworks = response.data.artworks || [];
      const hasMore = response.data.pagination?.page < response.data.pagination?.totalPages;

      setForYouArtworks(prev => reset ? newArtworks : [...prev, ...newArtworks]);
      setForYouPage(page + 1);
      setForYouHasMore(hasMore);
    } catch (error) {
      if (error.response?.status !== 429) {
        console.error('Error loading for you artworks:', error);
      }
    } finally {
      setForYouLoading(false);
      loadingRef.current = false;
    }
  }, [forYouLoading, forYouHasMore, forYouPage, token]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusTimeRef.current < 2000) {
        return;
      }
      lastFocusTimeRef.current = now;

      const refreshData = async () => {
        if (loadingRef.current) return;
        
        try {
          if (activeTab === 'explore') {
            if (artworks.length === 0) {
              await fetchArtworks(true);
            }
          } else {
            if (forYouArtworks.length === 0) {
              await loadForYouArtworks(true);
            }
          }
          if (boards.length === 0) {
            await fetchBoards();
          }
          
          // Reload liked artworks when screen comes into focus to sync with artwork view page
          // Use merge strategy to avoid losing recently liked artworks
          if (token && boards.length > 0) {
            setTimeout(() => {
              loadLikedArtworksFromStore(boards, token, true).catch(() => {}); // Force reload to sync (but will merge)
            }, 2000); // Longer delay to ensure backend has committed
          }
        } catch (error) {
          if (error.response?.status !== 429) {
            console.error('Error refreshing data:', error);
          }
        }
      };
      refreshData();
    }, [activeTab, loadForYouArtworks, artworks.length, forYouArtworks.length, boards.length, token])
  );

  useEffect(() => {
    fetchArtworks(true);
    fetchBoards();
  }, []);

  // Load liked artworks when boards are loaded
  useEffect(() => {
    if (token && boards.length > 0 && !likedArtworksLoaded) {
      loadLikedArtworks();
    }
  }, [boards, token, likedArtworksLoaded, loadLikedArtworks]);

  // Handle tab change
  useEffect(() => {
    if (activeTab === 'foryou' && forYouArtworks.length === 0 && !loadingRef.current) {
      loadForYouArtworks(true);
    }
  }, [activeTab, forYouArtworks.length, loadForYouArtworks]);

  // Load current user profile for header avatar
  useEffect(() => {
    if (currentUser?.id && token) {
      const prevAvatarUrl = userProfile?.avatar_url || currentUser?.avatar_url;
      useProfileStore.getState().fetchProfile(currentUser.id, token).then(() => {
        // Check if avatar changed
        const newProfile = useProfileStore.getState().profile;
        const newAvatarUrl = newProfile?.avatar_url || currentUser?.avatar_url;
        if (prevAvatarUrl !== newAvatarUrl) {
          setAvatarKey(prev => prev + 1);
        }
      });
    }
  }, [currentUser?.id, token, currentUser?.avatar_url]); // Refresh when avatar changes
  
  // Watch for avatar URL changes to update key
  useEffect(() => {
    if (userProfile?.avatar_url || currentUser?.avatar_url) {
      setAvatarKey(prev => prev + 1);
    }
  }, [userProfile?.avatar_url, currentUser?.avatar_url]);
  
  // Also refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (currentUser?.id && token) {
        useProfileStore.getState().fetchProfile(currentUser.id, token);
      }
    }, [currentUser?.id, token])
  );

  // Organize artworks into balanced columns (Pinterest masonry style)
  useEffect(() => {
    if (artworks.length > 0) {
      const newColumns = [[], []];
      const columnHeights = [0, 0];

      artworks.forEach((item, index) => {
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
    }
  }, [artworks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reset();
    await fetchArtworks(true);
    setRefreshing(false);
  }, []);

  const handleOpenSaveMenu = (artwork, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedArtwork(artwork);
    setShowSaveModal(true);
  };

  const handleBoardSelect = async (board) => {
    try {
      // saveArtworkToBoard already updates the local state
      await saveArtworkToBoard(board.id, selectedArtwork.id);

      // Close modal first
      setShowSaveModal(false);
      setShowCreateBoard(false);
      setNewBoardName('');

      // Small delay to ensure modal is closed before showing alert
      setTimeout(() => {
        showAlert({
          title: 'Saved!',
          message: `Added to ${board.name}`,
          type: 'success',
        });
      }, 100);
    } catch (error) {
      console.error('Error saving artwork to board:', error);
      
      // Close modal immediately
      setShowSaveModal(false);
      setShowCreateBoard(false);
      setNewBoardName('');
      
      // Extract error message from various possible locations
      let errorMessage = 'Failed to save artwork';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Small delay to ensure modal is closed before showing alert
      setTimeout(() => {
        showAlert({
          title: 'Error',
          message: errorMessage,
          type: 'error',
          duration: 3000,
        });
      }, 150);
    }
  };

  const handleCreateAndSave = async () => {
    if (!newBoardName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Board name is required',
        type: 'error',
      });
      return;
    }

    try {
      // createBoard adds the board to local state
      const newBoard = await createBoard({ name: newBoardName.trim() });
      // saveArtworkToBoard updates the board count in local state
      await saveArtworkToBoard(newBoard.id, selectedArtwork.id);

      setShowCreateBoard(false);
      setShowSaveModal(false);
      setNewBoardName('');
      showAlert({
        title: 'Success!',
        message: `Created "${newBoardName}" and saved artwork`,
        type: 'success',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to create board',
        visibilityTime: 3000,
      });
    }
  };

  // Handle like artwork (optimistic update)
  const handleLikeArtwork = async (artwork) => {
    if (!token) {
      showAlert({
        title: 'Login Required',
        message: 'Please login to like artworks',
        type: 'info',
      });
      return;
    }

    const artworkId = String(artwork.id);
    const currentLikedState = likedArtworksLoaded ? likedArtworks.has(artworkId) : false;
    const previousLikedState = currentLikedState;
    const previousLikeCount = artwork.like_count || 0;
    const newLikedState = !currentLikedState;

    // Optimistic update - use shared store immediately
    setLikedArtwork(artwork.id, newLikedState);

    // Update local artwork like count optimistically
    if (updateArtworkLikeCount) {
      updateArtworkLikeCount(artwork.id, newLikedState ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1));
    }

    // Force UI update by updating local state
    if (!likedArtworksLoaded) {
      // If liked artworks haven't loaded yet, ensure they're loaded
      loadLikedArtworks(true);
    }

    try {
      // Always call /like endpoint - it toggles automatically
      const response = await axios.post(`${API_URL}/artworks/${artwork.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Home Like API Response:', response.data);
      
      // The backend returns: { message: 'Artwork liked' or 'Artwork unliked', likeCount: number }
      const message = response.data.message || '';
      const newLikeCount = response.data.likeCount ?? previousLikeCount;
      // Message is either "Artwork liked" or "Artwork unliked"
      const isNowLiked = message === 'Artwork liked';
      
      console.log('Home Setting liked state:', { artworkId: artwork.id, isNowLiked, message, newLikeCount });
      
      // Update like count from response
      if (response.data.likeCount !== undefined && updateArtworkLikeCount) {
        updateArtworkLikeCount(artwork.id, response.data.likeCount);
      }
      
      // Update shared store with authoritative backend response
      setLikedArtwork(artwork.id, isNowLiked);
      
      // Refresh liked artworks list to ensure UI updates
      if (isNowLiked) {
        loadLikedArtworks(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Rollback optimistic update in shared store
      setLikedArtwork(artwork.id, previousLikedState);
      
      // Rollback like count
      if (updateArtworkLikeCount) {
        updateArtworkLikeCount(artwork.id, previousLikeCount);
      }
    }
  };

  const renderArtwork = (item, showLikeButton = false) => {
    // Always check current state from store for immediate updates
    const currentLikedState = useFeedStore.getState().likedArtworks;
    const isLiked = currentLikedState.has(String(item.id));
    
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.imageContainer}>
          <Link href={`/artwork/${item.id}`} asChild>
            <TouchableOpacity activeOpacity={0.9}>
              <Image
                source={{ uri: item.thumbnail_url || item.image_url }}
                style={[styles.image, { height: item.imageHeight }]}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          </Link>
          {showLikeButton && token && (
            <TouchableOpacity
              style={styles.likeButtonOverlay}
              onPress={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeArtwork(item);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? "#FF6B6B" : "rgba(255, 255, 255, 0.9)"}
                style={styles.likeIcon}
              />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => handleOpenSaveMenu(item, e)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {item.artists?.users && (
            <Text style={styles.artistName} numberOfLines={1}>
              {item.artists.users.username}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // TikTok-style full screen artwork renderer
  const renderTikTokArtwork = (item, index) => {
    // Always check current state from store for immediate updates
    const currentLikedState = useFeedStore.getState().likedArtworks;
    const isLiked = currentLikedState.has(String(item.id));
    const artworkId = String(item.id);
    const showHeartAnimation = heartAnimations[artworkId] || false;
    
    // Initialize animations for this artwork if not exists
    if (!heartScaleAnims.current[artworkId]) {
      heartScaleAnims.current[artworkId] = new Animated.Value(0);
      heartOpacityAnims.current[artworkId] = new Animated.Value(0);
    }
    
    const handleDoubleTap = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 200; // Reduced from 300ms for more sensitive double tap
      
      // Check current liked state directly from store
      const currentLikedState = useFeedStore.getState().likedArtworks;
      const currentlyLiked = currentLikedState.has(artworkId);
      
      if (lastTapRef.current[artworkId] && (now - lastTapRef.current[artworkId]) < DOUBLE_PRESS_DELAY) {
        if (!currentlyLiked && token) {
          handleLikeArtwork(item);
          
          heartScaleAnims.current[artworkId].setValue(0);
          heartOpacityAnims.current[artworkId].setValue(1);
          
          Animated.parallel([
            Animated.spring(heartScaleAnims.current[artworkId], {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(400),
              Animated.timing(heartOpacityAnims.current[artworkId], {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
          ]).start(() => {
            heartScaleAnims.current[artworkId].setValue(0);
            heartOpacityAnims.current[artworkId].setValue(0);
          });
          
          setHeartAnimations(prev => ({ ...prev, [artworkId]: true }));
          if (heartAnimationRef.current[artworkId]) {
            clearTimeout(heartAnimationRef.current[artworkId]);
          }
          heartAnimationRef.current[artworkId] = setTimeout(() => {
            setHeartAnimations(prev => {
              const newState = { ...prev };
              delete newState[artworkId];
              return newState;
            });
            delete heartAnimationRef.current[artworkId];
          }, 1000);
        }
        delete lastTapRef.current[artworkId];
      } else {
        lastTapRef.current[artworkId] = now;
      }
    };
    
    const primaryArtist =
      (Array.isArray(item.artists) ? item.artists[0] : item.artists) ||
      (Array.isArray(item.artist) ? item.artist[0] : item.artist) ||
      (Array.isArray(item.artist_user) ? item.artist_user[0] : item.artist_user);

    const artistUser =
      primaryArtist?.users ||
      primaryArtist?.user ||
      primaryArtist ||
      item.user ||
      item.owner_user ||
      item.creator ||
      item.created_by ||
      item.owner ||
      item.uploader ||
      (item.artist_username && {
        username: item.artist_username,
        full_name: item.artist_full_name,
        avatar_url: item.artist_avatar,
      }) ||
      (typeof item.artist === 'string' && { username: item.artist });

    const artistUsername =
      item.artist_username ||
      artistUser?.username ||
      artistUser?.full_name ||
      artistUser?.name ||
      item.artist_name ||
      item.artist_username ||
      item.username ||
      item.user_name ||
      item.created_by_username ||
      item.uploader_username ||
      (artistUser ? 'artist' : null) ||
      'artist';

    const artistAvatar =
      item.artist_avatar ||
      artistUser?.avatar_url ||
      artistUser?.avatar ||
      item.uploader_avatar ||
      item.created_by_avatar ||
      item.avatar_url;
    
    return (
      <View style={styles.tikTokCard}>
        <TouchableOpacity
          style={styles.tikTokImageContainer}
          activeOpacity={1}
          onPress={handleDoubleTap}
        >
          <Image
            source={{ uri: item.image_url || item.thumbnail_url }}
            style={styles.tikTokImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
          />
          {showHeartAnimation && (
            <Animated.View 
              style={[
                styles.heartAnimation,
                {
                  transform: [{ scale: heartScaleAnims.current[artworkId] }],
                  opacity: heartOpacityAnims.current[artworkId],
                }
              ]}
            >
              <Ionicons name="heart" size={100} color="#FF6B6B" />
            </Animated.View>
          )}
          
          {item.view_count > 0 && (
            <View style={styles.viewCountBadge}>
              <Ionicons name="eye" size={14} color="#fff" />
              <Text style={styles.viewCountText}>{item.view_count}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.95)']}
          style={styles.tikTokInfoGradient}
        >
          <View style={styles.tikTokInfo}>
            <TouchableOpacity
              onPress={() => router.push(`/artist/${item.artist_id}`)}
              style={styles.tikTokArtistInfo}
              activeOpacity={0.8}
            >
              {artistAvatar ? (
                <Image
                  source={{ uri: artistAvatar }}
                  style={styles.tikTokAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.tikTokAvatarPlaceholder}>
                  <Ionicons name="person" size={24} color={colors.text.secondary} />
                </View>
              )}
              <View style={styles.tikTokArtistText}>
                <Text style={styles.tikTokArtistName}>
                  @{artistUsername}
                </Text>
                <Text style={styles.tikTokTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.tikTokActions}>
          {token && (
            <TouchableOpacity
              style={styles.tikTokActionButton}
              onPress={() => handleLikeArtwork(item)}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={32}
                color={isLiked ? "#FF6B6B" : "#fff"}
              />
              <Text style={styles.tikTokActionLabel}>
                {isLiked ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.tikTokActionButton}
            onPress={() => router.push(`/artwork/${item.id}`)}
          >
            <Ionicons name="information-circle-outline" size={32} color="#fff" />
            <Text style={styles.tikTokActionLabel}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tikTokActionButton}
            onPress={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenSaveMenu(item, e);
            }}
          >
            <Ionicons name="bookmark-outline" size={32} color="#fff" />
            <Text style={styles.tikTokActionLabel}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading artworks...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
        <Text style={styles.emptyTitle}>No Artworks Yet</Text>
        <Text style={styles.emptyText}>
          Be the first to share your art or explore other artists!
        </Text>
        {!isArtist && (
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.exploreButtonText}>Explore Artists</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
            onPress={() => setActiveTab('explore')}
          >
            <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'foryou' && styles.tabActive]}
            onPress={() => setActiveTab('foryou')}
          >
            <Text style={[styles.tabText, activeTab === 'foryou' && styles.tabTextActive]}>For you</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerRight}>
          {!isArtist && token && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="filter" size={22} color={colors.text.primary} />
              {Object.keys(artistFilters).length > 0 && (
                <View style={styles.filterBadge} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {(userProfile?.avatar_url || currentUser?.avatar_url) ? (
              <Image
                source={{ 
                  uri: (() => {
                    const url = userProfile?.avatar_url || currentUser?.avatar_url;
                    // Add cache-busting parameter that changes when avatar updates
                    const separator = url?.includes('?') ? '&' : '?';
                    return `${url}${separator}_v=${avatarKey}`;
                  })()
                }}
                style={styles.profileAvatar}
                contentFit="cover"
                cachePolicy="none"
                key={`${userProfile?.avatar_url || currentUser?.avatar_url}-${avatarKey}`}
              />
            ) : (
              <Ionicons name="person-circle" size={22} color={colors.text.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Filters Bar */}
      {!isArtist && token && Object.keys(artistFilters).length > 0 && (
        <View style={styles.activeFiltersBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            {artistFilters.styles?.length > 0 && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>
                  {artistFilters.styles.length} style{artistFilters.styles.length > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...artistFilters };
                    delete newFilters.styles;
                    setArtistFilters(newFilters);
                    loadFilteredArtists(newFilters);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {artistFilters.price_min !== undefined && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Min: ${artistFilters.price_min}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...artistFilters };
                    delete newFilters.price_min;
                    setArtistFilters(newFilters);
                    loadFilteredArtists(newFilters);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {artistFilters.price_max !== undefined && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Max: ${artistFilters.price_max}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...artistFilters };
                    delete newFilters.price_max;
                    setArtistFilters(newFilters);
                    loadFilteredArtists(newFilters);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {artistFilters.turnaround_max !== undefined && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>Max {artistFilters.turnaround_max} days</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...artistFilters };
                    delete newFilters.turnaround_max;
                    setArtistFilters(newFilters);
                    loadFilteredArtists(newFilters);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {artistFilters.language && (
              <View style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>{artistFilters.language}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const newFilters = { ...artistFilters };
                    delete newFilters.language;
                    setArtistFilters(newFilters);
                    loadFilteredArtists(newFilters);
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearAllFilters}
              onPress={() => {
                setArtistFilters({});
                setShowDiscoverArtists(false);
                setDiscoverArtists([]);
              }}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Discover Artists Section */}
      {!isArtist && token && showDiscoverArtists && discoverArtists.length > 0 && (
        <View style={styles.discoverSection}>
          <View style={styles.discoverHeader}>
            <Text style={styles.discoverTitle}>Discover Artists</Text>
            <TouchableOpacity onPress={() => setShowDiscoverArtists(false)}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {loadingArtists ? (
            <View style={styles.discoverLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverScroll}>
              {discoverArtists.map((artist) => (
                <TouchableOpacity
                  key={artist.id}
                  style={styles.discoverArtistCard}
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/100' }}
                    style={styles.discoverArtistAvatar}
                    contentFit="cover"
                  />
                  <Text style={styles.discoverArtistName} numberOfLines={1}>
                    {artist.users?.full_name || artist.users?.username}
                  </Text>
                  <View style={styles.discoverArtistStats}>
                    <Ionicons name="star" size={12} color={colors.primary} />
                    <Text style={styles.discoverArtistRating}>
                      {artist.rating?.toFixed(1) || '0.0'}
                    </Text>
                  </View>
                  {artist.min_price && artist.max_price && (
                    <Text style={styles.discoverArtistPrice}>
                      ${artist.min_price}-${artist.max_price}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Content based on active tab */}
      {activeTab === 'explore' ? (
        // Explore tab - existing masonry layout
        artworks.length === 0 ? (
          renderEmpty()
        ) : (
          <ScrollView
            ref={scrollViewRef}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 80 }
            ]}
          >
            <View style={styles.masonryContainer}>
              {/* Left Column */}
              <View style={styles.column}>
                {columns[0].map(item => renderArtwork(item, true))}
              </View>

              {/* Right Column */}
              <View style={styles.column}>
                {columns[1].map(item => renderArtwork(item, true))}
              </View>
            </View>
          </ScrollView>
        )
      ) : (
        // For You tab - TikTok-style full screen vertical feed
        forYouArtworks.length === 0 && forYouLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading artworks...</Text>
          </View>
        ) : forYouArtworks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Artworks Yet</Text>
            <Text style={styles.emptyText}>
              Check back later for personalized recommendations!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={scrollViewRef}
            data={forYouArtworks}
            renderItem={({ item, index }) => renderTikTokArtwork(item, index)}
            keyExtractor={(item) => String(item.id)}
            pagingEnabled
            snapToInterval={height - 180}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(data, index) => ({
              length: height - 180,
              offset: (height - 180) * index,
              index,
            })}
            onEndReached={() => {
              if (!forYouLoading && forYouHasMore) {
                loadForYouArtworks();
              }
            }}
            onEndReachedThreshold={0.5}
            removeClippedSubviews={false}
            maxToRenderPerBatch={2}
            windowSize={3}
            initialNumToRender={1}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadForYouArtworks(true);
                  setRefreshing(false);
                }}
                tintColor={colors.primary}
              />
            }
            ListFooterComponent={
              forYouLoading ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />
        )
      )}

      {/* Save to Board Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowSaveModal(false);
          setShowCreateBoard(false);
          setNewBoardName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.modalContent}>
                <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Save to Board</Text>
                <TouchableOpacity onPress={() => {
                  setShowSaveModal(false);
                  setShowCreateBoard(false);
                  setNewBoardName('');
                }}>
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {!showCreateBoard ? (
                <>
                  <ScrollView style={styles.boardList}>
                    {boards.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.boardOption}
                        onPress={() => handleBoardSelect(item)}
                      >
                        <Ionicons name="albums" size={24} color={colors.text.secondary} />
                        <Text style={styles.boardOptionText}>{item.name}</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  <TouchableOpacity
                    style={styles.createBoardButton}
                    onPress={() => setShowCreateBoard(true)}
                  >
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                    <Text style={styles.createBoardText}>Create New Board</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.createBoardForm}>
                  <TextInput
                    style={styles.input}
                    placeholder="Board name"
                    placeholderTextColor={colors.text.disabled}
                    value={newBoardName}
                    onChangeText={setNewBoardName}
                    autoFocus
                  />
                  <View style={styles.createBoardActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowCreateBoard(false);
                        setNewBoardName('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.createButton}
                      onPress={handleCreateAndSave}
                    >
                      <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
                </SafeAreaView>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Search Modal */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
      
      {!isArtist && (
        <>
          <StylePreferenceQuiz
            visible={showStyleQuiz}
            onClose={() => setShowStyleQuiz(false)}
            token={token}
            onComplete={() => {
              // Optionally refresh or navigate
            }}
          />
          <ArtistFilters
            visible={showFilters}
            onClose={() => setShowFilters(false)}
            filters={artistFilters}
            onApplyFilters={handleApplyFilters}
            token={token}
          />
        </>
      )}
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingTop: IS_SMALL_SCREEN ? Constants.statusBarHeight + spacing.sm : Constants.statusBarHeight + spacing.md,
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    backgroundColor: colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 3,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: IS_SMALL_SCREEN ? 16 : 20,
    paddingVertical: IS_SMALL_SCREEN ? 6 : 8,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceLight,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: IS_SMALL_SCREEN ? spacing.xs : spacing.sm,
  },
  iconButton: {
    width: IS_SMALL_SCREEN ? 36 : 38,
    height: IS_SMALL_SCREEN ? 36 : 38,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100, // Base padding, will be overridden by inline style with safe area
  },
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING,
    paddingTop: SPACING,
  },
  column: {
    flex: 1,
    paddingHorizontal: SPACING / 2,
  },
  card: {
    width: '100%',
    marginBottom: SPACING,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
  },
  likeButtonOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  likeIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadMoreContainer: {
    width: '100%',
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  profileButton: {
    width: IS_SMALL_SCREEN ? 36 : 38,
    height: IS_SMALL_SCREEN ? 36 : 38,
    borderRadius: IS_SMALL_SCREEN ? 18 : 19,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: IS_SMALL_SCREEN ? 36 : 38,
    height: IS_SMALL_SCREEN ? 36 : 38,
    borderRadius: IS_SMALL_SCREEN ? 18 : 19,
  },
  // TikTok-style styles
  tikTokCard: {
    width: width,
    height: height - 180,
    position: 'relative',
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  tikTokImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 1,
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  tikTokImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  tikTokInfoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  tikTokInfo: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.lg,
    minHeight: 120,
    justifyContent: 'flex-start',
  },
  tikTokArtistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.xs,
  },
  tikTokAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  tikTokAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface + '90',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tikTokArtistText: {
    flex: 1,
  },
  tikTokArtistName: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 17,
    marginBottom: 4,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
  tikTokTitle: {
    ...typography.h3,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    lineHeight: 20,
  },
  tikTokActions: {
    position: 'absolute',
    right: spacing.md,
    bottom: 40,
    alignItems: 'center',
    gap: spacing.xl,
    zIndex: 3,
  },
  tikTokActionButton: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  tikTokActionLabel: {
    ...typography.caption,
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.2,
  },
  viewCountBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    zIndex: 5,
  },
  viewCountText: {
    ...typography.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  textContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  artistName: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  menuButton: {
    padding: 3,
    borderRadius: borderRadius.sm,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingTop: IS_SMALL_SCREEN ? 60 : 80,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    textAlign: 'center',
    marginBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  exploreButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingVertical: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    borderRadius: borderRadius.full,
  },
  exploreButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.75,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md + 4 : spacing.lg,
    paddingTop: IS_SMALL_SCREEN ? spacing.md + 4 : spacing.lg,
    paddingBottom: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    fontWeight: '700',
  },
  boardList: {
    maxHeight: 400,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    gap: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  boardOptionText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 17,
    fontWeight: '600',
    flex: 1,
  },
  createBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: IS_SMALL_SCREEN ? spacing.md + 4 : spacing.lg,
    marginHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  createBoardText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  createBoardForm: {
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md + 4 : spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    color: colors.text.primary,
    ...typography.body,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md + 4,
  },
  createBoardActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  createButton: {
    flex: 1,
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    ...shadows.medium,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  // Filter styles
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeFiltersBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  filtersScroll: {
    paddingHorizontal: spacing.md,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  activeFilterText: {
    ...typography.small,
    color: colors.primary,
    fontSize: 12,
  },
  clearAllFilters: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  clearAllText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
  },
  // Discover Artists Section
  discoverSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  discoverTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
  },
  discoverLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  discoverEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  discoverEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  discoverEmptySubtext: {
    ...typography.small,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  discoverScroll: {
    paddingLeft: spacing.md,
  },
  discoverArtistCard: {
    width: 120,
    marginRight: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discoverArtistAvatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  discoverArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  discoverArtistStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  discoverArtistRating: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
  },
  discoverArtistPrice: {
    ...typography.small,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
});