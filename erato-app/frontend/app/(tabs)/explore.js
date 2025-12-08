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
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.20;
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ExploreScreen() {
  const { artists, currentIndex, fetchArtists, swipe } = useSwipeStore();
  const { token, user } = useAuthStore();
  const { boards, fetchBoards } = useBoardStore();
  const isArtist = user?.user_type === 'artist';
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

  // For artists, show trending artworks feed instead of swipeable artists
  useEffect(() => {
    if (isArtist) {
      fetchTrendingArtworks();
      if (token) {
        fetchBoards();
      }
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
      if (isArtist) {
        fetchTrendingArtworks();
      }
    }, [isArtist])
  );

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
      await fetchTrendingArtworks();
      if (token) {
        await fetchBoards();
        setLikedArtworksLoaded(false); // Trigger reload of liked artworks
      }
    } else {
      await fetchArtists();
    }
    setRefreshing(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
      },
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        position.flattenOffset();

        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 7,
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
      duration: 250,
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
      duration: 250,
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

  // For artists, show trending artworks feed
  if (isArtist) {
    return (
      <View style={styles.container}>
        <View style={styles.trendingHeader}>
          <Text style={styles.trendingTitle}>Trending Artworks</Text>
          <Text style={styles.trendingSubtitle}>Discover what's popular</Text>
        </View>
        {trendingLoading && trendingArtworks.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading trending artworks...</Text>
          </View>
        ) : (
          <FlatList
            data={trendingArtworks}
            renderItem={({ item }) => {
              const isLiked = likedArtworksLoaded ? likedArtworks.has(String(item.id)) : false;
              return (
                <TouchableOpacity
                  style={styles.trendingCard}
                  onPress={() => router.push(`/artwork/${item.id}`)}
                  activeOpacity={0.95}
                >
                  <View style={styles.trendingImageContainer}>
                    <Image
                      source={{ uri: item.image_url || item.thumbnail_url }}
                      style={styles.trendingImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                    {/* Like Button - Top Right */}
                    <TouchableOpacity
                      style={styles.trendingLikeButton}
                      onPress={(e) => handleLikeArtwork(item, e)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isLiked ? "heart" : "heart-outline"}
                        size={20}
                        color={isLiked ? "#FF6B6B" : "#fff"}
                      />
                    </TouchableOpacity>
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
                      style={styles.trendingOverlay}
                    >
                      <View style={styles.trendingStats}>
                        {item.like_count > 0 && (
                          <View style={styles.trendingStat}>
                            <Ionicons name="heart" size={13} color="#FF6B6B" />
                            <Text style={styles.trendingStatText}>
                              {item.like_count || 0}
                            </Text>
                          </View>
                        )}
                        {item.view_count > 0 && (
                          <View style={styles.trendingStat}>
                            <Ionicons name="eye" size={13} color="#fff" />
                            <Text style={styles.trendingStatText}>
                              {item.view_count || 0}
                            </Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                <View style={styles.trendingInfo}>
                  <Text style={styles.trendingTitleText} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.artists?.users && (
                    <TouchableOpacity
                      style={styles.trendingArtistRow}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/artist/${item.artist_id}`);
                      }}
                      activeOpacity={0.7}
                    >
                      {item.artists.users.avatar_url ? (
                        <Image
                          source={{ uri: item.artists.users.avatar_url }}
                          style={styles.trendingArtistAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={[styles.trendingArtistAvatar, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={10} color={colors.text.secondary} />
                        </View>
                      )}
                      <Text style={styles.trendingArtist} numberOfLines={1}>
                        @{item.artists.users.username || item.artists.users.full_name || 'artist'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            contentContainerStyle={styles.trendingList}
            columnWrapperStyle={styles.trendingRow}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
                <Text style={styles.emptyText}>No trending artworks yet</Text>
              </View>
            }
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
          <TouchableOpacity
            style={styles.infoContainer}
            onPress={() => setShowPortfolioModal(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.artistName}>
              {currentArtist.users?.full_name || currentArtist.users?.username}
            </Text>
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

            <TouchableOpacity style={styles.viewPortfolioButton}>
              <Text style={styles.viewPortfolioText}>Tap to view full portfolio</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
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
          <View style={styles.artistInfo}>
            <Image
              source={{ uri: artist?.users?.avatar_url }}
              style={styles.artistAvatar}
              contentFit="cover"
            />
            <View style={styles.artistDetails}>
              <Text style={styles.artistNameModal}>
                {artist?.users?.full_name || artist?.users?.username}
              </Text>
              <Text style={styles.artistBioModal} numberOfLines={1}>
                {artist?.users?.bio || 'Artist on Verro'}
              </Text>
            </View>
          </View>
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