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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useSwipeStore, useAuthStore, useBoardStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25; // Increased threshold for better swipe detection
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ExploreScreen() {
  const { artists, currentIndex, fetchArtists, swipe } = useSwipeStore();
  const { token, user } = useAuthStore();
  const { boards, fetchBoards } = useBoardStore();
  const isArtist = user?.user_type === 'artist' || !!user?.artists;
  const [currentPortfolioImage, setCurrentPortfolioImage] = useState(0);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [likedArtworks, setLikedArtworks] = useState(new Set());
  const [likedArtworksLoaded, setLikedArtworksLoaded] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const swipeAnimation = useRef(new Animated.Value(0)).current;

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

  // For artists, show commissions page instead of trending artworks
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'pending', 'in_progress', 'completed'
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (isArtist && token) {
      loadCommissions();
    } else if (!isArtist && artists.length === 0) {
      fetchArtists();
    }
  }, [isArtist, token]);

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
      if (isArtist && token) {
        loadCommissions();
      }
    }, [isArtist, token])
  );

  const loadCommissions = async () => {
    setCommissionsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/commissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const allCommissions = response.data.commissions || [];
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
      Alert.alert('Login Required', 'Please login to like artworks');
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
      if (isLiked) {
        // Unlike
        const response = await axios.post(`${API_URL}/artworks/${artwork.id}/unlike`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.likeCount !== undefined) {
          setTrendingArtworks(prev => prev.map(item => 
            item.id === artwork.id
              ? { ...item, like_count: response.data.likeCount }
              : item
          ));
        }
      } else {
        // Like
        const response = await axios.post(`${API_URL}/artworks/${artwork.id}/like`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.likeCount !== undefined) {
          setTrendingArtworks(prev => prev.map(item => 
            item.id === artwork.id
              ? { ...item, like_count: response.data.likeCount }
              : item
          ));
        }
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
      
      Alert.alert('Error', 'Failed to update like status');
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
        // Only respond to horizontal swipes, ignore vertical scrolls
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
      },
      onPanResponderMove: (_, gesture) => {
        // Only move horizontally, clamp vertical movement
        position.setValue({ 
          x: gesture.dx, 
          y: gesture.dy * 0.3 // Reduce vertical movement
        });
      },
      onPanResponderRelease: (_, gesture) => {
        position.flattenOffset();

        const swipeVelocity = Math.abs(gesture.vx);
        const swipeDistance = Math.abs(gesture.dx);

        // Check if swipe is significant (either distance or velocity)
        if (swipeDistance > SWIPE_THRESHOLD || swipeVelocity > 0.5) {
          if (gesture.dx > 0) {
            swipeRight();
          } else {
            swipeLeft();
          }
        } else {
          // Spring back to center
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 8,
            tension: 40,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const swipeRight = () => {
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      if (currentArtist) {
        swipe(currentArtist.id, 'right');
        // Artist is now saved to "Liked" - user can view in Library > Liked tab
      }
      position.setValue({ x: 0, y: 0 });
    });
  };

  const swipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      if (currentArtist) {
        swipe(currentArtist.id, 'left');
      }
      position.setValue({ x: 0, y: 0 });
    });
  };

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
      case 'accepted': return '#4CAF50';
      case 'declined': return '#F44336';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#9C27B0';
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

  // For artists, show commissions page
  if (isArtist) {
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
          <Text style={styles.commissionsSubtitle}>Manage your commission requests</Text>
          
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
          <Animated.FlatList
            data={filteredCommissions}
            renderItem={({ item, index }) => {
              const otherUser = item.client;
              const statusColor = getStatusColor(item.status);
              const cardScaleAnim = useRef(new Animated.Value(0)).current;
              const cardOpacityAnim = useRef(new Animated.Value(0)).current;

              React.useEffect(() => {
                Animated.parallel([
                  Animated.spring(cardScaleAnim, {
                    toValue: 1,
                    delay: index * 50,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                  }),
                  Animated.timing(cardOpacityAnim, {
                    toValue: 1,
                    delay: index * 50,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                ]).start();
              }, []);

              return (
                <Animated.View
                  style={{
                    transform: [{ scale: cardScaleAnim }],
                    opacity: cardOpacityAnim,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.commissionCard,
                      item.status === 'pending' && styles.pendingCommissionCard,
                    ]}
                    onPress={() => {
                      setSelectedCommission(item);
                      setShowCommissionModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.commissionCardContent}>
                      {item.status === 'pending' ? (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            if (item.client?.id || item.client_id) {
                              router.push(`/client/${item.client?.id || item.client_id}`);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
                            style={styles.commissionAvatar}
                            contentFit="cover"
                          />
                          <View style={styles.tapIndicatorOverlay}>
                            <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <Image
                          source={{ uri: otherUser?.avatar_url || DEFAULT_AVATAR }}
                          style={styles.commissionAvatar}
                          contentFit="cover"
                        />
                      )}

                      <View style={styles.commissionInfo}>
                        <View style={styles.commissionTopRow}>
                          {item.status === 'pending' ? (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                if (item.client?.id || item.client_id) {
                                  router.push(`/client/${item.client?.id || item.client_id}`);
                                }
                              }}
                              activeOpacity={0.8}
                              style={styles.tappableName}
                            >
                              <Text style={styles.commissionUsername} numberOfLines={1}>
                                {otherUser?.full_name || otherUser?.username || 'Unknown Client'}
                              </Text>
                              <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.commissionUsername} numberOfLines={1}>
                              {otherUser?.full_name || otherUser?.username || 'Unknown Client'}
                            </Text>
                          )}
                          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                              {formatStatus(item.status)}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.commissionDetails} numberOfLines={2}>
                          {item.client_note || item.details}
                        </Text>

                        <View style={styles.commissionFooter}>
                          {item.budget && !item.price && (
                            <View style={styles.budgetChip}>
                              <Ionicons name="cash-outline" size={14} color={colors.primary} />
                              <Text style={styles.budgetText}>Budget: ${item.budget}</Text>
                            </View>
                          )}
                          {item.price && (
                            <Text style={styles.commissionPrice}>${item.price}</Text>
                          )}
                          <Text style={styles.commissionDate}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.commissionsListContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={64} color={colors.text.disabled} />
                <Text style={styles.emptyTitle}>No Commissions</Text>
                <Text style={styles.emptyText}>
                  {selectedStatus === 'all'
                    ? 'You haven\'t received any commission requests yet.'
                    : `No ${selectedStatus} commissions at this time.`}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  if (!currentArtist) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>No more artists to explore</Text>
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={() => fetchArtists()}
        >
          <Text style={styles.reloadText}>Reload</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const portfolioImages = currentArtist.portfolio_images || [];
  const currentImage = portfolioImages[currentPortfolioImage] || portfolioImages[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>
          {currentArtist.users?.username || 'Artist'}
        </Text>
        <TouchableOpacity style={styles.moreButton} onPress={() => setShowInstructions(true)}>
          <Ionicons name="help-circle-outline" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { rotate },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Like/Nope Overlays */}
        <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>
        <Animated.View style={[styles.nopeOverlay, { opacity: nopeOpacity }]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>

        {/* Portfolio Image */}
        <TouchableOpacity
          style={styles.cardImageContainer}
          onPress={() => setShowPortfolioModal(true)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: currentImage }}
            style={styles.cardImage}
            contentFit="cover"
          />
        </TouchableOpacity>

        {/* Portfolio Counter */}
        {portfolioImages.length > 1 && (
          <View style={styles.artworkCounter}>
            <Text style={styles.counterText}>
              {currentPortfolioImage + 1} / {portfolioImages.length}
            </Text>
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        >
          {/* Artist Info */}
          <View style={styles.infoContainer}>
            <TouchableOpacity
              onPress={() => router.push(`/artist/${currentArtist.id}`)}
              activeOpacity={0.7}
              style={styles.profileLinkContainer}
            >
              {currentArtist.users?.avatar_url && (
                <Image
                  source={{ uri: currentArtist.users.avatar_url }}
                  style={styles.artistAvatarSmall}
                  contentFit="cover"
                />
              )}
              <View style={styles.profileLinkText}>
                <Text style={styles.artistName}>
                  {currentArtist.users?.full_name || currentArtist.users?.username}
                </Text>
                <View style={styles.tapToProfileIndicator}>
                  <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
                  <Text style={styles.tapToProfileText}>Tap to view profile</Text>
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.bio} numberOfLines={2}>
              {currentArtist.users?.bio || 'Artist on Verro'}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="star" size={16} color={colors.status.warning} />
                <Text style={styles.statText}>
                  {currentArtist.rating?.toFixed(1) || 'New'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="briefcase" size={16} color={colors.text.secondary} />
                <Text style={styles.statText}>
                  {currentArtist.total_commissions || 0} commissions
                </Text>
              </View>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Commission Range:</Text>
              <Text style={styles.price}>
                ${currentArtist.min_price || 0} - ${currentArtist.max_price || 0}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.viewPortfolioButton}
              onPress={() => setShowPortfolioModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewPortfolioText}>Tap to view full portfolio</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rewindButton]}
          onPress={() => {/* TODO: Implement undo */}}
        >
          <Ionicons name="arrow-undo" size={28} color={colors.status.warning} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={swipeLeft}
        >
          <Ionicons name="close" size={32} color={colors.status.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.superLikeButton]}
          onPress={() => {/* TODO: Implement super like */}}
        >
          <Ionicons name="star" size={28} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={swipeRight}
        >
          <Ionicons name="heart" size={32} color={colors.status.success} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.boostButton]}
          onPress={() => {/* TODO: Navigate to profile */}}
        >
          <Ionicons name="flash" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Portfolio Navigation */}
      {portfolioImages.length > 1 && (
        <View style={styles.artworkNav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentPortfolioImage(Math.max(0, currentPortfolioImage - 1))}
            disabled={currentPortfolioImage === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentPortfolioImage === 0 ? colors.text.disabled : colors.text.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() =>
              setCurrentPortfolioImage(
                Math.min(portfolioImages.length - 1, currentPortfolioImage + 1)
              )
            }
            disabled={currentPortfolioImage === portfolioImages.length - 1}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={
                currentPortfolioImage === portfolioImages.length - 1
                  ? colors.text.disabled
                  : colors.text.primary
              }
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Portfolio Modal */}
      <PortfolioModal
        visible={showPortfolioModal}
        onClose={() => setShowPortfolioModal(false)}
        artist={currentArtist}
        portfolioImages={portfolioImages}
      />

      {/* Instructions Modal */}
      <InstructionsModal
        visible={showInstructions}
        onClose={handleCloseInstructions}
      />
    </View>
  );
}

// Portfolio Modal Component
function PortfolioModal({ visible, onClose, artist, portfolioImages }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
    }
  }, [visible]);

  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  if (!portfolioImages || portfolioImages.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.modalHeaderText}>
            <Text style={styles.modalTitle}>
              {artist?.users?.full_name || artist?.users?.username}'s Portfolio
            </Text>
            <Text style={styles.modalSubtitle}>
              {currentIndex + 1} of {portfolioImages.length}
            </Text>
          </View>
          <View style={styles.closeButton} />
        </View>

        {/* Portfolio Images Scroll */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.modalScrollView}
        >
          {portfolioImages.map((imageUri, index) => (
            <View key={index} style={styles.portfolioImageContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.portfolioImage}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        <View style={styles.paginationDots}>
          {portfolioImages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Artist Info Footer */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.artistInfo}
            onPress={() => {
              onClose();
              router.push(`/artist/${artist?.id}`);
            }}
            activeOpacity={0.7}
          >
            {artist?.users?.avatar_url && (
              <Image
                source={{ uri: artist.users.avatar_url }}
                style={styles.artistAvatar}
                contentFit="cover"
              />
            )}
            <View style={styles.artistDetails}>
              <Text style={styles.artistNameModal}>
                {artist?.users?.full_name || artist?.users?.username}
              </Text>
              <View style={styles.tapToProfileIndicatorModal}>
                <Ionicons name="person-circle-outline" size={12} color={colors.primary} />
                <Text style={styles.tapToProfileTextModal}>Tap to view profile</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Instructions Modal Component
function InstructionsModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.instructionsOverlay}>
        <View style={styles.instructionsContent}>
          <View style={styles.instructionsHeader}>
            <Text style={styles.instructionsTitle}>How to Use Explore</Text>
            <TouchableOpacity onPress={onClose} style={styles.instructionsCloseButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <View style={[styles.instructionIcon, { backgroundColor: `${colors.error}15` }]}>
                <Ionicons name="arrow-back" size={24} color={colors.error} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Swipe Left</Text>
                <Text style={styles.instructionDescription}>Pass on this artist</Text>
              </View>
            </View>

            <View style={styles.instructionItem}>
              <View style={[styles.instructionIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="heart" size={24} color={colors.primary} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Swipe Right or Tap Heart</Text>
                <Text style={styles.instructionDescription}>
                  Save artist to your Liked list in Library
                </Text>
              </View>
            </View>

            <View style={styles.instructionItem}>
              <View style={[styles.instructionIcon, { backgroundColor: `${colors.text.secondary}15` }]}>
                <Ionicons name="person" size={24} color={colors.text.secondary} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>Tap Profile</Text>
                <Text style={styles.instructionDescription}>
                  View full artist profile, portfolio, and request commissions
                </Text>
              </View>
            </View>

            <View style={styles.instructionItem}>
              <View style={[styles.instructionIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="albums" size={24} color={colors.primary} />
              </View>
              <View style={styles.instructionText}>
                <Text style={styles.instructionTitle}>View Liked Artists</Text>
                <Text style={styles.instructionDescription}>
                  Go to Library {">"} Liked tab to see all artists you've liked
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.instructionsButton} onPress={onClose}>
            <Text style={styles.instructionsButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: width - spacing.xl * 2,
    height: height * 0.65,
    alignSelf: 'center',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.large,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 50,
    left: 30,
    zIndex: 10,
    borderWidth: 4,
    borderColor: colors.status.success,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    transform: [{ rotate: '-20deg' }],
  },
  likeText: {
    ...typography.h1,
    color: colors.status.success,
    fontWeight: '800',
  },
  nopeOverlay: {
    position: 'absolute',
    top: 50,
    right: 30,
    zIndex: 10,
    borderWidth: 4,
    borderColor: colors.status.error,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    transform: [{ rotate: '20deg' }],
  },
  nopeText: {
    ...typography.h1,
    color: colors.status.error,
    fontWeight: '800',
  },
  artworkCounter: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    zIndex: 5,
  },
  counterText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
  },
  infoContainer: {
    padding: spacing.lg,
  },
  artistName: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bio: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  price: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    ...shadows.medium,
  },
  rewindButton: {
    width: 48,
    height: 48,
  },
  nopeButton: {
    width: 64,
    height: 64,
  },
  superLikeButton: {
    width: 48,
    height: 48,
  },
  likeButton: {
    width: 64,
    height: 64,
  },
  boostButton: {
    width: 48,
    height: 48,
  },
  artworkNav: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  loadingContainer: {
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
  reloadButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  reloadText: {
    ...typography.button,
    color: colors.text.primary,
  },
      cardImageContainer: {
        width: '100%',
        height: '100%',
      },
      profileLinkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
      },
      artistAvatarSmall: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.primary,
      },
      profileLinkText: {
        flex: 1,
      },
      tapToProfileIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
      },
      tapToProfileText: {
        ...typography.small,
        color: colors.primary,
        fontSize: 11,
        fontWeight: '600',
      },
      tapToProfileIndicatorModal: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
      },
      tapToProfileTextModal: {
        ...typography.small,
        color: colors.primary,
        fontSize: 11,
        fontWeight: '600',
      },
  viewPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  viewPortfolioText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderText: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  modalScrollView: {
    flex: 1,
  },
  portfolioImageContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  portfolioImage: {
    width: width,
    height: '100%',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.disabled,
  },
  activeDot: {
    backgroundColor: colors.primary,
    width: 24,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
  },
  artistDetails: {
    flex: 1,
  },
  artistNameModal: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  artistBioModal: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  // Instructions Modal Styles
  instructionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  instructionsContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  instructionsTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  instructionsCloseButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  instructionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  instructionDescription: {
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  instructionsButton: {
    backgroundColor: colors.primary,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  instructionsButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  // Commissions styles for artists
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  pendingCommissionCard: {
    borderColor: colors.primary + '40',
    borderWidth: 2,
    backgroundColor: colors.primary + '08',
  },
  commissionCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  commissionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    position: 'relative',
    backgroundColor: colors.background,
  },
  tapIndicatorOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 2,
    borderWidth: 2,
    borderColor: colors.primary,
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
  tappableName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  commissionDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  budgetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  budgetText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  commissionPrice: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
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
    paddingVertical: spacing.xxl * 2,
  },
});