import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  Alert,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useSwipeStore, useAuthStore, useBoardStore } from '../../store';
import ReviewModal from '../../components/ReviewModal';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25; // Increased threshold for better swipe detection
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ExploreScreen() {
  const { artists, currentIndex, fetchArtists, swipe } = useSwipeStore();
  const { token, user } = useAuthStore();
  const { boards, fetchBoards } = useBoardStore();
  const insets = useSafeAreaInsets();
  const isArtist = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  const [currentPortfolioImage, setCurrentPortfolioImage] = useState(0);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [likedArtworks, setLikedArtworks] = useState(new Set());
  const [likedArtworksLoaded, setLikedArtworksLoaded] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false); // Track if animation is in progress

  useEffect(() => {
    if (artists.length === 0) {
      fetchArtists();
    }
  }, []);

  useEffect(() => {
    // Show instructions on first visit
    const checkFirstVisit = async () => {
      try {
        const hasSeenInstructions = await AsyncStorage.getItem('hasSeenExploreInstructions');
        if (!hasSeenInstructions) {
          setTimeout(() => setShowInstructions(true), 500);
        }
      } catch (error) {
        console.error('Error checking first visit:', error);
      }
    };
    checkFirstVisit();
  }, []);

  const handleCloseInstructions = async () => {
    setShowInstructions(false);
    try {
      await AsyncStorage.setItem('hasSeenExploreInstructions', 'true');
    } catch (error) {
      console.error('Error saving instructions flag:', error);
    }
  };

  const currentArtist = artists[currentIndex];
  const [trendingArtworks, setTrendingArtworks] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // For artists and clients, show commissions page
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'pending', 'in_progress', 'completed'
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [artistCache, setArtistCache] = useState({}); // Cache for artist user data when backend doesn't provide it
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { userId, userName, userAvatar, commissionId, reviewType }
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Only fetch user data if we don't have artists info yet, to avoid unnecessary API calls
    const checkIsArtist = user?.user_type === 'artist' || 
                         (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
    
    // Always load commissions if we have a token (for both artists and clients)
    if (token) {
      loadCommissions();
    }
    // Only fetch artists for the Tinder view (which is now in explore-artists.js)
    if (!checkIsArtist && artists.length === 0 && token) {
      // Don't fetch artists here - that's handled in explore-artists.js
    } else if (token && user?.id && !user?.artists && user?.user_type !== 'artist') {
      // Only fetch if we're missing artist info
      useAuthStore.getState().fetchUser().then(() => {
        const updatedUser = useAuthStore.getState().user;
        const updatedCheckIsArtist = updatedUser?.user_type === 'artist' || 
                                    (updatedUser?.artists && (Array.isArray(updatedUser.artists) ? updatedUser.artists.length > 0 : !!updatedUser.artists));
        
        if (updatedCheckIsArtist && token) {
          loadCommissions();
        } else if (!updatedCheckIsArtist && artists.length === 0 && token) {
          fetchArtists();
        }
      }).catch(() => {
        // If fetch fails, proceed with current user data
        if (artists.length === 0 && token) {
          fetchArtists();
        }
      });
    }
  }, [token, user?.id]);

  // Load liked artworks
  useEffect(() => {
    if (isArtist && token && boards.length > 0 && !likedArtworksLoaded) {
      loadLikedArtworks();
    }
  }, [isArtist, token, boards, likedArtworksLoaded]);

  const loadLikedArtworks = async () => {
    try {
      const likedBoard = boards.find(b => b.name === 'Liked');
      if (likedBoard) {
        const response = await axios.get(`${API_URL}/boards/${likedBoard.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const artworkIds = response.data.board_artworks?.map(ba => String(ba.artwork_id)) || [];
        setLikedArtworks(new Set(artworkIds));
      }
      setLikedArtworksLoaded(true);
    } catch (error) {
      console.error('Error loading liked artworks:', error);
      setLikedArtworksLoaded(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Load commissions for both artists and clients
      if (token) {
        loadCommissions();
      }
    }, [token, user?.user_type, user?.artists])
  );

  const loadCommissions = async () => {
    if (!token) return;
    setCommissionsLoading(true);
    try {
      // Check if user is artist
      const checkIsArtist = user?.user_type === 'artist' || 
                           (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
      // For artists: get received commissions, for clients: get sent commissions
      const type = checkIsArtist ? 'received' : 'sent';
      const response = await axios.get(`${API_URL}/commissions?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCommissions = response.data.commissions || [];
      
      // Fetch missing artist data for commissions where artist.users is null
      const missingArtistIds = allCommissions
        .filter(c => !checkIsArtist && c.artist_id && !c.artist?.users)
        .map(c => c.artist_id);
      
      if (missingArtistIds.length > 0 && !checkIsArtist) {
        // Fetch artist user data for missing artists
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
      
      // Sort: pending first, then by date (newest first)
      const sorted = [...allCommissions].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setCommissions(sorted);
      
      // Animate in
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

  const fetchTrendingArtworks = async () => {
    setTrendingLoading(true);
    try {
      const response = await axios.get(`${API_URL}/artworks`, {
        params: { page: 1, limit: 30 },
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setTrendingArtworks(response.data.artworks || []);
    } catch (error) {
      console.error('Error fetching trending artworks:', error);
    } finally {
      setTrendingLoading(false);
    }
  };

  const handleLikeArtwork = async (artwork, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (!token) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please login to like artworks',
        visibilityTime: 2000,
      });
      return;
    }

    const artworkId = String(artwork.id);
    const isLiked = likedArtworksLoaded ? likedArtworks.has(artworkId) : false;
    const previousLikedState = isLiked;
    const previousLikeCount = artwork.like_count || 0;

    // Optimistic update
    setLikedArtworks(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(artworkId);
      } else {
        newSet.add(artworkId);
      }
      return newSet;
    });

    // Update local state optimistically
    setTrendingArtworks(prev => prev.map(item => 
      item.id === artwork.id
        ? { ...item, like_count: isLiked ? Math.max(0, previousLikeCount - 1) : previousLikeCount + 1 }
        : item
    ));

    try {
      // Always call /like endpoint - it toggles automatically
      const response = await axios.post(`${API_URL}/artworks/${artwork.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // The backend returns: { message: 'Artwork liked' or 'Artwork unliked', likeCount: number }
      const message = response.data.message || '';
      const newLikeCount = response.data.likeCount ?? previousLikeCount;
      // Message is either "Artwork liked" or "Artwork unliked"
      const isNowLiked = message === 'Artwork liked';
      
      if (response.data.likeCount !== undefined) {
        setTrendingArtworks(prev => prev.map(item => 
          item.id === artwork.id
            ? { ...item, like_count: response.data.likeCount }
            : item
        ));
      }
      
      // Update liked state based on message (most reliable)
      if (isNowLiked) {
        setLikedArtworks(prev => new Set([...prev, artworkId]));
      } else {
        setLikedArtworks(prev => {
          const newSet = new Set(prev);
          newSet.delete(artworkId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Rollback optimistic update
      setLikedArtworks(prev => {
        const newSet = new Set(prev);
        if (previousLikedState) {
          newSet.add(artworkId);
        } else {
          newSet.delete(artworkId);
        }
        return newSet;
      });
      
      setTrendingArtworks(prev => prev.map(item => 
        item.id === artwork.id
          ? { ...item, like_count: previousLikeCount }
          : item
      ));
      
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update like status',
        visibilityTime: 2000,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isArtist) {
      await loadCommissions();
    } else {
      await fetchArtists();
    }
    setRefreshing(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Don't process if already animating
        if (isAnimating.current) return false;
        // Only respond to horizontal swipes, ignore vertical scrolls
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        if (isAnimating.current) return;
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
      },
      onPanResponderMove: (_, gesture) => {
        // Don't process if already animating
        if (isAnimating.current) return;
        // Only move horizontally, clamp vertical movement
        position.setValue({ 
          x: gesture.dx, 
          y: 0 // No vertical movement to keep it simple
        });
      },
      onPanResponderRelease: (_, gesture) => {
        // Don't process if already animating
        if (isAnimating.current) return;
        
        position.flattenOffset();

        const swipeVelocity = Math.abs(gesture.vx);
        const swipeDistance = Math.abs(gesture.dx);
        const currentX = position.x._value;

        // Check if swipe is significant (either distance or velocity)
        if (swipeDistance > SWIPE_THRESHOLD || swipeVelocity > 0.5) {
          if (currentX > 0 || gesture.dx > 0) {
            swipeRight();
          } else if (currentX < 0 || gesture.dx < 0) {
            swipeLeft();
          }
        } else {
          // Spring back to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 50,
            useNativeDriver: false,
          }).start(() => {
            // Ensure offset is reset after spring
            position.setOffset({ x: 0, y: 0 });
            position.setValue({ x: 0, y: 0 });
          });
        }
      },
    })
  ).current;

  const swipeRight = useCallback(() => {
    if (currentArtist && !isAnimating.current) {
      isAnimating.current = true;
      const artistId = currentArtist.id;
      
      // Update index IMMEDIATELY (optimistic update)
      swipe(artistId, 'right');
      
      // Simple horizontal animation from current position to off-screen right
      Animated.timing(position, {
        toValue: { x: width + 100, y: 0 },
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        // Reset immediately after animation completes
        position.setValue({ x: 0, y: 0 });
        position.setOffset({ x: 0, y: 0 });
        isAnimating.current = false;
      });
    }
  }, [currentArtist, swipe, position]);

  const swipeLeft = useCallback(() => {
    if (currentArtist && !isAnimating.current) {
      isAnimating.current = true;
      const artistId = currentArtist.id;
      
      // Update index IMMEDIATELY (optimistic update)
      swipe(artistId, 'left');
      
      // Simple horizontal animation from current position to off-screen left
      Animated.timing(position, {
        toValue: { x: -width - 100, y: 0 },
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        // Reset immediately after animation completes
        position.setValue({ x: 0, y: 0 });
        position.setOffset({ x: 0, y: 0 });
        isAnimating.current = false;
      });
    }
  }, [currentArtist, swipe, position]);

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Helper functions for commissions
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#2BB3A3';
      case 'declined': return '#F44336';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#1EAD5B';
      case 'cancelled': return '#757575';
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

  // Get commission stats
  const commissionStats = {
    pending: commissions.filter(c => c.status === 'pending').length,
    in_progress: commissions.filter(c => c.status === 'in_progress' || c.status === 'accepted').length,
    completed: commissions.filter(c => c.status === 'completed').length,
    total: commissions.length,
  };

  // Filter commissions by selected status
  const filteredCommissions = selectedStatus === 'all'
    ? commissions
    : commissions.filter(c => {
        if (selectedStatus === 'active') {
          return c.status === 'pending' || c.status === 'in_progress' || c.status === 'accepted';
        }
        return c.status === selectedStatus;
      });

  // Show commissions page for both artists and clients
  // Re-check artist status to ensure it's current
  const currentIsArtist = user?.user_type === 'artist' || 
                          (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  
  // Always show commissions view (for both artists and clients)
  // Clients see their sent commissions, artists see their received commissions
  return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.commissionsHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.commissionsTitle}>Commissions</Text>
          <Text style={styles.commissionsSubtitle}>
            {currentIsArtist ? 'Manage your commission requests' : 'Track your commission requests'}
          </Text>
          
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{commissionStats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{commissionStats.in_progress}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{commissionStats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Status Filter Tabs */}
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
                  selectedStatus === status && styles.statusTabActive,
                ]}
                onPress={() => {
                  setSelectedStatus(status);
                  Animated.sequence([
                    Animated.timing(fadeAnim, {
                      toValue: 0.5,
                      duration: 150,
                      useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                      toValue: 1,
                      duration: 150,
                      useNativeDriver: true,
                    }),
                  ]).start();
                }}
              >
                <Text
                  style={[
                    styles.statusTabText,
                    selectedStatus === status && styles.statusTabTextActive,
                  ]}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  {status !== 'all' && (
                    <Text style={styles.statusTabCount}>
                      {' '}({status === 'active' 
                        ? commissionStats.in_progress 
                        : status === 'pending'
                        ? commissionStats.pending
                        : commissionStats.completed})
                    </Text>
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
        {commissionsLoading && commissions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading commissions...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCommissions}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.commissionsListContent,
              filteredCommissions.length === 0 && { flexGrow: 1, justifyContent: 'center' },
              { paddingBottom: Math.max(insets.bottom, 20) + 80 }
            ]}
            renderItem={({ item }) => {
              // For artists: show client info, for clients: show artist info
              // API returns: item.client (user object) and item.artist.users (user object)
              // Fallback: If artist object is null but artist_id exists, the backend lookup failed
              // but we can still display the ID or fetch it separately
              
              let otherUser = null;
              if (currentIsArtist) {
                otherUser = item.client;
              } else {
                // For clients viewing artist commissions
                otherUser = item.artist?.users;
                // Fallback: If backend didn't populate artist.users, try cache
                if (!otherUser && item.artist_id && artistCache[item.artist_id]) {
                  otherUser = artistCache[item.artist_id];
                }
              }
              
              const statusColor = getStatusColor(item.status);

              return (
                <TouchableOpacity
                  style={[
                    styles.commissionCard,
                    item.status === 'pending' && styles.pendingCommissionCard,
                    { borderColor: statusColor + '35', shadowColor: statusColor },
                  ]}
                  onPress={() => {
                    setSelectedCommission(item);
                    setShowCommissionModal(true);
                  }}
                  activeOpacity={0.9}
                >
                  {/* top row */}
                  <View style={styles.commissionHeaderRow}>
                    <View style={styles.headerLeft}>
                      <View style={[styles.avatarFrame, { borderColor: statusColor + '60', shadowColor: statusColor }]}>
                        <Image
                          source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
                          style={styles.commissionAvatar}
                          contentFit="cover"
                        />
                      </View>
                      <View style={styles.headerTextBlock}>
                        <Text style={styles.commissionUsername} numberOfLines={1}>
                          {otherUser?.username || otherUser?.full_name || (currentIsArtist ? 'Unknown Client' : 'Unknown Artist')}
                        </Text>
                        <Text style={styles.subMeta} numberOfLines={1}>
                          {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '55' }]}>
                      <Ionicons name={getStatusIcon(item.status)} size={13} color={statusColor} />
                      <Text style={[styles.statusPillText, { color: statusColor }]}>{formatStatus(item.status)}</Text>
                    </View>
                  </View>

                  {/* detail row */}
                  {(item.client_note || item.details) && (
                    <Text style={styles.commissionDetails} numberOfLines={2}>
                      {item.client_note || item.details}
                    </Text>
                  )}

                  {/* footer */}
                  <View style={styles.commissionFooter}>
                    <View style={styles.metaChips}>
                      {item.price ? (
                        <View style={styles.priceChip}>
                          <Ionicons name="cash" size={12} color={colors.primary} />
                          <Text style={styles.priceText}>${item.price}</Text>
                        </View>
                      ) : item.budget ? (
                        <View style={styles.budgetChip}>
                          <Ionicons name="cash-outline" size={11} color={colors.text.secondary} />
                          <Text style={styles.budgetText}>${item.budget}</Text>
                        </View>
                      ) : (
                        <View style={styles.budgetChip}>
                          <Ionicons name="information-circle-outline" size={11} color={colors.text.secondary} />
                          <Text style={styles.budgetText}>No price set</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.tapToViewIndicator}>
                      <Text style={styles.tapToViewText}>Tap to view more</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
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
                <Text style={styles.commissionsEmptyText}>
                  {selectedStatus === 'all'
                    ? (currentIsArtist 
                        ? 'You haven\'t received any commission requests yet.'
                        : 'You haven\'t sent any commission requests yet.')
                    : `No ${selectedStatus} commissions at this time.`}
                </Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}

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
                <TouchableOpacity 
                  onPress={() => setShowCommissionModal(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>

              {selectedCommission && (
                <ScrollView 
                  style={styles.commissionDetailContent}
                  contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
                >
                  {/* User Info */}
                  <TouchableOpacity
                    style={styles.detailUserHeader}
                    onPress={() => {
                      if (currentIsArtist) {
                        const clientId = selectedCommission.client?.id || selectedCommission.client_id;
                        if (clientId) {
                          setShowCommissionModal(false);
                          router.push(`/client/${clientId}`);
                        }
                      } else {
                        const artistId = selectedCommission.artist?.id || selectedCommission.artist_id;
                        if (artistId) {
                          setShowCommissionModal(false);
                          router.push(`/artist/${artistId}`);
                        }
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: currentIsArtist
                          ? (selectedCommission.client?.avatar_url || DEFAULT_AVATAR)
                          : (selectedCommission.artist?.users?.avatar_url || artistCache[selectedCommission.artist_id]?.avatar_url || DEFAULT_AVATAR)
                      }}
                      style={styles.detailAvatar}
                      contentFit="cover"
                    />
                    <View style={styles.detailUserInfo}>
                      <Text style={styles.detailUsername} numberOfLines={1} ellipsizeMode="tail">
                        {currentIsArtist
                          ? (selectedCommission.client?.username || selectedCommission.client?.full_name || 'Unknown Client')
                          : (selectedCommission.artist?.users?.username || selectedCommission.artist?.users?.full_name || 'Unknown Artist')}
                      </Text>
                      <View style={styles.detailRoleBadge}>
                        <Text style={styles.detailUserRole}>{currentIsArtist ? 'Client' : 'Artist'}</Text>
                      </View>
                    </View>
                    <View style={styles.detailUserHeaderRight}>
                      <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedCommission.status) + '15' }]}>
                        <Ionicons name={getStatusIcon(selectedCommission.status)} size={14} color={getStatusColor(selectedCommission.status)} />
                        <Text style={[styles.detailStatusText, { color: getStatusColor(selectedCommission.status) }]}>
                          {formatStatus(selectedCommission.status)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.text.disabled + '50'} style={{ flexShrink: 0 }} />
                    </View>
                  </TouchableOpacity>

                  {/* Quick meta summary */}
                  <View style={styles.detailMetaChips}>
                    <View style={[styles.detailMetaPill, { borderColor: getStatusColor(selectedCommission.status) + '55', backgroundColor: getStatusColor(selectedCommission.status) + '12' }]}>
                      <Ionicons name={getStatusIcon(selectedCommission.status)} size={12} color={getStatusColor(selectedCommission.status)} />
                      <Text style={[styles.detailMetaText, { color: getStatusColor(selectedCommission.status) }]} numberOfLines={1} ellipsizeMode="tail">
                        {formatStatus(selectedCommission.status)}
                      </Text>
                    </View>

                    <View style={styles.detailMetaPill}>
                      <Ionicons name="cash-outline" size={12} color={colors.text.secondary} />
                      <Text style={styles.detailMetaText} numberOfLines={1} ellipsizeMode="tail">
                        {selectedCommission.price
                          ? `$${selectedCommission.price}`
                          : selectedCommission.budget
                          ? `$${selectedCommission.budget}`
                          : 'No price set'}
                      </Text>
                    </View>

                    <View style={styles.detailMetaPill}>
                      <Ionicons name="calendar-outline" size={12} color={colors.text.secondary} />
                      <Text style={styles.detailMetaText} numberOfLines={1} ellipsizeMode="tail">
                        {new Date(selectedCommission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    {selectedCommission.deadline_text && (
                      <View style={[styles.detailMetaPill, { borderColor: '#FFA50055', backgroundColor: '#FFA50012' }]}>
                        <Ionicons name="time-outline" size={12} color="#FFA500" />
                        <Text style={[styles.detailMetaText, { color: '#FFA500' }]} numberOfLines={1} ellipsizeMode="tail">
                          {selectedCommission.deadline_text}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Artwork Reference */}
                  {selectedCommission.artwork ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Reference Artwork</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setShowCommissionModal(false);
                          router.push(`/artwork/${selectedCommission.artwork.id}`);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.detailArtwork}>
                          <Image
                            source={{ uri: selectedCommission.artwork.thumbnail_url || selectedCommission.artwork.image_url }}
                            style={styles.detailArtworkImage}
                            contentFit="cover"
                          />
                          <Text style={styles.detailArtworkTitle}>{selectedCommission.artwork.title}</Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.referenceStrip}>
                        {(Array.isArray(selectedCommission.artwork?.images) && selectedCommission.artwork.images.length > 0
                          ? selectedCommission.artwork.images.slice(0, 3)
                          : [selectedCommission.artwork.thumbnail_url || selectedCommission.artwork.image_url].filter(Boolean)
                        ).map((img, idx) => (
                          <Image
                            key={`${img}-${idx}`}
                            source={{ uri: img }}
                            style={styles.referenceThumb}
                            contentFit="cover"
                          />
                        ))}
                        {(!selectedCommission.artwork?.thumbnail_url && !selectedCommission.artwork?.image_url && !selectedCommission.artwork?.images?.length) && (
                          <View style={styles.referencePlaceholder}>
                            <Ionicons name="image-outline" size={14} color={colors.text.secondary} />
                            <Text style={styles.referencePlaceholderText}>No reference attached</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Reference Artwork</Text>
                      <View style={styles.referencePlaceholder}>
                        <Ionicons name="image-outline" size={14} color={colors.text.secondary} />
                        <Text style={styles.referencePlaceholderText}>No reference attached</Text>
                      </View>
                    </View>
                  )}

                  {/* Commission Details */}
                  {selectedCommission.details && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Description</Text>
                      <Text style={styles.detailText}>{selectedCommission.details}</Text>
                    </View>
                  )}

                  {/* Client Note */}
                  {selectedCommission.client_note && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Client Note</Text>
                      <View style={styles.detailNoteBox}>
                        <Text style={styles.detailText}>{selectedCommission.client_note}</Text>
                      </View>
                    </View>
                  )}

                  {/* Artist Response */}
                  {selectedCommission.artist_response && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Artist Response</Text>
                      <View style={styles.detailNoteBox}>
                        <Text style={styles.detailText}>{selectedCommission.artist_response}</Text>
                      </View>
                    </View>
                  )}

                  {/* Budget/Price */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>
                          {selectedCommission.price ? 'Price' : 'Budget'}
                        </Text>
                        <View style={styles.priceValueContainer}>
                          <Ionicons name="cash" size={18} color={colors.primary} />
                          <Text style={[styles.detailValue, { color: colors.primary }]}>
                            {selectedCommission.price
                              ? `$${selectedCommission.price}`
                              : selectedCommission.budget
                              ? `$${selectedCommission.budget}`
                              : 'Not specified'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Dates */}
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <View style={styles.dateLabelContainer}>
                          <Ionicons name="calendar-outline" size={14} color={colors.text.secondary} />
                          <Text style={styles.detailLabel}>Created</Text>
                        </View>
                        <Text style={styles.detailValue}>
                          {new Date(selectedCommission.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      {selectedCommission.deadline_text && (
                        <View style={styles.detailItem}>
                          <View style={styles.dateLabelContainer}>
                            <Ionicons name="time-outline" size={14} color="#FF9800" />
                            <Text style={[styles.detailLabel, { color: '#FF9800' }]}>Deadline</Text>
                          </View>
                          <Text style={[styles.detailValue, { color: '#FF9800' }]}>
                            {selectedCommission.deadline_text}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </ScrollView>
              )}
              {selectedCommission && (
                <View style={styles.detailFooterBar}>
                  {selectedCommission.conversation_id && (selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted' || selectedCommission.status === 'completed') && (
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

                  {selectedCommission.status === 'pending' && user?.artists && (selectedCommission.artist_id === user?.artists?.id || selectedCommission.artist_id === user?.id) && (
                    <View style={styles.detailFooterButtons}>
                      <TouchableOpacity
                        style={styles.detailDeclineButton}
                        onPress={() => {
                          Alert.alert(
                            'Decline Commission',
                            'Are you sure you want to decline this commission request? This action cannot be undone.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Decline',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await axios.patch(
                                      `${API_URL}/commissions/${selectedCommission.id}/status`,
                                      { status: 'declined' },
                                      { headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    setShowCommissionModal(false);
                                    await loadCommissions();
                                    Toast.show({
                                      type: 'success',
                                      text1: 'Declined',
                                      text2: 'Commission request has been declined',
                                      visibilityTime: 2000,
                                    });
                                  } catch (error) {
                                    console.error('Error declining commission:', error);
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to decline commission. Please try again.',
                                      visibilityTime: 3000,
                                    });
                                  }
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#F44336" />
                        <Text style={styles.detailDeclineButtonText}>Decline</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailAcceptButton}
                        onPress={() => {
                          Alert.alert(
                            'Accept Commission',
                            'Accept this commission request? You can start working on it right away.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Accept',
                                onPress: async () => {
                                  try {
                                    await axios.patch(
                                      `${API_URL}/commissions/${selectedCommission.id}/status`,
                                      { status: 'accepted' },
                                      { headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    setShowCommissionModal(false);
                                    await loadCommissions();
                                    Toast.show({
                                      type: 'success',
                                      text1: 'Accepted!',
                                      text2: 'Commission request has been accepted. You can now message the client.',
                                      visibilityTime: 3000,
                                    });
                                  } catch (error) {
                                    console.error('Error accepting commission:', error);
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to accept commission. Please try again.',
                                      visibilityTime: 3000,
                                    });
                                  }
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.detailAcceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {(selectedCommission.status === 'in_progress' || selectedCommission.status === 'accepted') && user?.artists && (selectedCommission.artist_id === user?.artists?.id || selectedCommission.artist_id === user?.id) && (
                    <View style={styles.detailFooterButtons}>
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
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to cancel commission. Please try again.',
                                      visibilityTime: 3000,
                                    });
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
                        onPress={() => {
                          Alert.alert(
                            'Complete Commission',
                            'Mark this commission as completed?',
                            [
                              { text: 'Not Yet', style: 'cancel' },
                              {
                                text: 'Complete',
                                onPress: async () => {
                                  try {
                                    const response = await axios.patch(
                                      `${API_URL}/commissions/${selectedCommission.id}/status`,
                                      { status: 'completed', skip_message: true },
                                      { headers: { Authorization: `Bearer ${token}` } }
                                    );
                                    
                                    const updatedCommission = response.data.commission || selectedCommission;
                                    
                                    setShowCommissionModal(false);
                                    await loadCommissions();
                                    
                                    const currentIsArtist = user?.user_type === 'artist' || 
                                                           (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
                                    if (currentIsArtist) {
                                      const client = updatedCommission.client || selectedCommission.client;
                                      if (client) {
                                        setReviewTarget({
                                          userId: client.id,
                                          userName: client.username || client.full_name,
                                          userAvatar: client.avatar_url,
                                          commissionId: selectedCommission.id,
                                          reviewType: 'artist_to_client'
                                        });
                                        setShowReviewModal(true);
                                      }
                                    } else {
                                      const artist = updatedCommission.artist?.users || selectedCommission.artist?.users || artistCache[selectedCommission.artist_id];
                                      if (artist) {
                                        setReviewTarget({
                                          userId: artist.id,
                                          userName: artist.username || artist.full_name,
                                          userAvatar: artist.avatar_url,
                                          commissionId: selectedCommission.id,
                                          reviewType: 'client_to_artist'
                                        });
                                        setShowReviewModal(true);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('Error completing commission:', error);
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to complete commission. Please try again.',
                                      visibilityTime: 3000,
                                    });
                                  }
                                }
                              }
                            ]
                          );
                        }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.detailCompleteButtonText}>Complete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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
              text2: 'Review submitted successfully!',
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height * 0.6,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  // Commissions styles
  commissionsHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  commissionsTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  commissionsSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '20',
    ...shadows.small,
  },
  statValue: {
    ...typography.h1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
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
    borderColor: colors.border + '20',
  },
  statusTabActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary + '40',
  },
  statusTabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  statusTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  statusTabCount: {
    fontSize: 12,
    opacity: 0.7,
  },
  commissionsListContent: {
    padding: spacing.md + spacing.xs,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border + '25',
    ...shadows.small,
    overflow: 'hidden',
    position: 'relative',
  },
  pendingCommissionCard: {
    backgroundColor: colors.surfaceLight,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
  },
  commissionCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  commissionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  avatarFrame: {
    padding: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: colors.border + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  commissionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 20,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: colors.border + '40',
    flexShrink: 0,
  },
  tapIndicatorOverlay: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  commissionInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
    gap: spacing.xs / 2,
  },
  commissionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs - 2,
    gap: spacing.xs,
    minHeight: 20,
  },
  commissionUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  subMeta: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
  },
  tappableName: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
    maxWidth: '62%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.xs / 2,
    marginBottom: spacing.xs / 2,
  },
  commissionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs / 2,
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs / 2,
    paddingTop: spacing.xs / 2,
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
    gap: 4,
    backgroundColor: colors.primary + '18',
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  priceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  commissionFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  budgetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  budgetText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 11,
  },
  commissionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10.5,
  },
  detailMetaChips: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
    paddingBottom: spacing.xs,
  },
  detailMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '35',
    flexShrink: 1,
  },
  detailMetaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tapToViewIndicator: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginTop: 0,
  },
  tapToViewText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 10.5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Trending styles for artists
  trendingHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  trendingTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  trendingSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  trendingList: {
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  trendingRow: {
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trendingCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  trendingImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: colors.background,
  },
  trendingLikeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  trendingImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
  },
  trendingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingTop: spacing.lg,
    justifyContent: 'flex-end',
  },
  trendingStats: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  trendingStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backdropFilter: 'blur(10px)',
  },
  trendingStatText: {
    ...typography.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  trendingInfo: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  trendingTitleText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    marginBottom: spacing.xs + 2,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trendingArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  trendingArtistAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  trendingArtist: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    minHeight: height * 0.6,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  commissionsEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  // Commission Detail Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  commissionDetailModal: {
    backgroundColor: colors.surfaceLight,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commissionDetailContent: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  detailSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottomWidth: 0,
  },
  detailUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceLight,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border + '25',
  },
  detailUserHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.xs,
  },
  detailAvatar: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    flexShrink: 0,
  },
  detailUserInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.xs,
  },
  detailUsername: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  detailRoleBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  detailUserRole: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    flexShrink: 0,
  },
  detailStatusText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailSectionTitle: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  detailSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
    gap: spacing.xs,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 22,
  },
  detailArtwork: {
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    padding: spacing.sm + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  detailArtworkImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  detailArtworkTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  referenceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  referenceThumb: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border + '25',
  },
  referencePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  referencePlaceholderText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  detailFooterBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: colors.border + '30',
    gap: spacing.sm,
  },
  detailFooterButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '30',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.xs,
    fontWeight: '600',
    opacity: 0.8,
  },
  detailValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  detailMessageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  detailMessageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.md - spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  detailDeclineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    borderWidth: 1.5,
    borderColor: '#F44336',
  },
  detailDeclineButtonText: {
    ...typography.bodyBold,
    color: '#F44336',
    fontSize: 15,
    fontWeight: '600',
  },
  detailAcceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  detailAcceptButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  detailCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLight,
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
    backgroundColor: colors.primary,
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
  detailNoteBox: {
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + '35',
  },
  priceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  dateLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
});