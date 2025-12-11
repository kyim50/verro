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
import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useFeedStore, useBoardStore, useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import SearchModal from '../../components/SearchModal';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const SPACING = width < 400 ? 3 : 4; // Tighter spacing on smaller screens
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING) / NUM_COLUMNS;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function HomeScreen() {
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
      await saveArtworkToBoard(board.id, selectedArtwork.id);
      setShowSaveModal(false);
      Alert.alert('Saved!', `Added to ${board.name}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save artwork');
    }
  };

  const handleCreateAndSave = async () => {
    if (!newBoardName.trim()) {
      Alert.alert('Error', 'Board name is required');
      return;
    }

    try {
      const newBoard = await createBoard({ name: newBoardName.trim() });
      await saveArtworkToBoard(newBoard.id, selectedArtwork.id);
      setShowCreateBoard(false);
      setShowSaveModal(false);
      setNewBoardName('');
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: `Created "${newBoardName}" and saved artwork`,
        visibilityTime: 2000,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to create board');
    }
  };

  // Handle like artwork (optimistic update)
  const handleLikeArtwork = async (artwork) => {
    if (!token) {
      Alert.alert('Login Required', 'Please login to like artworks');
      return;
    }

    const artworkId = String(artwork.id);
    const currentLikedState = likedArtworksLoaded ? likedArtworks.has(artworkId) : false;
    const previousLikedState = currentLikedState;
    const previousLikeCount = artwork.like_count || 0;

    // Optimistic update - use shared store
    setLikedArtwork(artwork.id, !currentLikedState);

    // Update local artwork like count optimistically
    if (updateArtworkLikeCount) {
      updateArtworkLikeCount(artwork.id, currentLikedState ? Math.max(0, previousLikeCount - 1) : previousLikeCount + 1);
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
      
      // Verify the update worked
      setTimeout(() => {
        const currentState = useFeedStore.getState().likedArtworks;
        console.log('Home Current liked artworks after update:', Array.from(currentState));
        console.log('Home Is artwork liked?', currentState.has(String(artwork.id)));
      }, 100);
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
    const isLiked = likedArtworksLoaded ? likedArtworks.has(String(item.id)) : false;
    
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
    const isLiked = likedArtworksLoaded ? likedArtworks.has(String(item.id)) : false;
    const artworkId = String(item.id);
    const showHeartAnimation = heartAnimations[artworkId] || false;
    
    // Initialize animations for this artwork if not exists
    if (!heartScaleAnims.current[artworkId]) {
      heartScaleAnims.current[artworkId] = new Animated.Value(0);
      heartOpacityAnims.current[artworkId] = new Animated.Value(0);
    }
    
    const handleDoubleTap = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 300;
      
      if (lastTapRef.current[artworkId] && (now - lastTapRef.current[artworkId]) < DOUBLE_PRESS_DELAY) {
        if (!isLiked && token) {
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
            contentContainerStyle={styles.scrollContent}
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
    paddingBottom: 100,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: Dimensions.get('window').height * 0.85,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  boardList: {
    maxHeight: 300,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    gap: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  boardOptionText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    flex: 1,
  },
  createBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    gap: spacing.sm,
  },
  createBoardText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  createBoardForm: {
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  createBoardActions: {
    flexDirection: 'row',
    gap: spacing.md,
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
  createButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});