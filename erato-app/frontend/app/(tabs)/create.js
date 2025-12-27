import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useAuthStore, useSwipeStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.2; // Lower threshold for easier swiping

export default function CreateScreen() {
  const { user } = useAuthStore();
  const { artists, currentIndex, fetchArtists, swipe, undoLastSwipe, canUndo } = useSwipeStore();
  const isArtist = user?.user_type === 'artist' || 
                   (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  
  const [currentPortfolioImage, setCurrentPortfolioImage] = useState(0);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  
  // TINDER-LIKE APPROACH: Use queue system
  // Maintain a local queue of artists to display
  const [artistQueue, setArtistQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [swipedArtists, setSwipedArtists] = useState([]); // Track swiped artists for undo
  
  const position = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const nextCardScale = useRef(new Animated.Value(0.95)).current;
  const nextCardOpacity = useRef(new Animated.Value(0.5)).current;

  // Initialize queue from artists array
  useEffect(() => {
    if (artists.length > 0 && artistQueue.length === 0) {
      setArtistQueue(artists);
      setQueueIndex(0);
    }
  }, [artists]);

  // Sync queue when artists change (for new data)
  useEffect(() => {
    if (artists.length > 0 && currentIndex === 0) {
      // Reset queue when starting fresh
      setArtistQueue(artists);
      setQueueIndex(0);
      position.setValue({ x: 0, y: 0 });
      position.setOffset({ x: 0, y: 0 });
    }
  }, [artists, currentIndex]);

  // Get current artist from queue
  const currentArtist = artistQueue[queueIndex];
  // Filter out any empty/blank portfolio images
  const portfolioImages = (currentArtist?.portfolio_images || []).filter(img => img && img.trim() !== '');
  
  // Reset portfolio image index when artist changes
  useEffect(() => {
    if (currentArtist) {
      setCurrentPortfolioImage(0);
    }
  }, [queueIndex, currentArtist?.id]);
  
  // Fetch commission packages for current artist
  useEffect(() => {
    const fetchPackages = async () => {
      if (!currentArtist?.id) {
        setPackages([]);
        return;
      }
      
      setLoadingPackages(true);
      try {
        const { token } = useAuthStore.getState();
        const response = await axios.get(`${API_URL}/artists/${currentArtist.id}/packages`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setPackages(response.data.packages || []);
      } catch (error) {
        console.error('Error fetching packages:', error);
        setPackages([]);
      } finally {
        setLoadingPackages(false);
      }
    };
    
    fetchPackages();
  }, [currentArtist?.id]);
  
  const currentImage = portfolioImages[currentPortfolioImage] || portfolioImages[0];
  
  // Get next artist for card stack preview
  const nextArtist = artistQueue[queueIndex + 1];
  const nextPortfolioImages = (nextArtist?.portfolio_images || []).filter(img => img && img.trim() !== '');
  const nextImage = nextPortfolioImages[0];

  // SIMPLE APPROACH: No animations, just instant updates
  const swipeRight = useCallback(() => {
    if (!currentArtist) {
      return;
    }
    
    // Capture artist ID and artist data for undo
    const artistId = currentArtist.id;
    const artistData = { ...currentArtist, queueIndex };
    
    // Track swiped artist for undo
    setSwipedArtists(prev => [...prev, { artist: artistData, direction: 'right' }]);
    
    // Animate card off screen to the right
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      // Reset position FIRST before updating queue to prevent flash
      position.setValue({ x: 0, y: 0 });
      position.setOffset({ x: 0, y: 0 });
      cardOpacity.setValue(1); // Ensure opacity stays at 1
      
      // Use double requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // After animation completes, update to next card
          setQueueIndex(prev => prev + 1);
          
          // Update store index
          const nextStoreIndex = currentIndex + 1;
          useSwipeStore.setState({ currentIndex: nextStoreIndex });
        });
      });
    });
    
    // Record swipe in background
    swipe(artistId, 'right', false).catch(error => {
      console.error('Error recording swipe:', error);
    });
  }, [queueIndex, currentArtist, currentIndex, swipe, position, width, cardOpacity]);

  const swipeLeft = useCallback(() => {
    if (!currentArtist) {
      return;
    }
    
    // Capture artist ID and artist data for undo
    const artistId = currentArtist.id;
    const artistData = { ...currentArtist, queueIndex };
    
    // Track swiped artist for undo
    setSwipedArtists(prev => [...prev, { artist: artistData, direction: 'left' }]);
    
    // Animate card off screen to the left
    Animated.timing(position, {
      toValue: { x: -(width + 100), y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      // Reset position FIRST before updating queue to prevent flash
      position.setValue({ x: 0, y: 0 });
      position.setOffset({ x: 0, y: 0 });
      cardOpacity.setValue(1); // Ensure opacity stays at 1
      
      // Use double requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // After animation completes, update to next card
          setQueueIndex(prev => prev + 1);
          
          // Update store index
          const nextStoreIndex = currentIndex + 1;
          useSwipeStore.setState({ currentIndex: nextStoreIndex });
        });
      });
    });
    
    // Record swipe in background
    swipe(artistId, 'left', false).catch(error => {
      console.error('Error recording swipe:', error);
    });
  }, [queueIndex, currentArtist, currentIndex, swipe, position, width, cardOpacity]);

  const handleUndo = useCallback(async () => {
    if (swipedArtists.length === 0) return;
    
    const lastSwiped = swipedArtists[swipedArtists.length - 1];
    if (!lastSwiped || !lastSwiped.artist) return;
    
    // Call undo on the store
    const result = await undoLastSwipe();
    
    if (result.success) {
      // Restore previous artist in queue
      if (lastSwiped.artist) {
        const newQueue = [...artistQueue];
        const artistId = lastSwiped.artist.id;
        
        // Remove the artist if it already exists in the queue (to avoid duplicates)
        const filteredQueue = newQueue.filter(a => a.id !== artistId);
        
        // Insert the artist back at the previous position
        const insertIndex = Math.max(0, Math.min(lastSwiped.artist.queueIndex, filteredQueue.length));
        
        // Update queue and index first, then animate
        setArtistQueue(filteredQueue);
        setQueueIndex(insertIndex);
        setSwipedArtists(prev => prev.slice(0, -1));
        
        // Also update store index to match
        useSwipeStore.setState({ currentIndex: insertIndex });
        
        // Use double requestAnimationFrame to ensure state updates before animation
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Animate card back in smoothly
            // Start from off-screen based on direction
            const startX = lastSwiped.direction === 'right' ? width + 100 : -(width + 100);
            position.setValue({ x: startX, y: 0 });
            position.setOffset({ x: 0, y: 0 });
            cardOpacity.setValue(1); // Keep opacity at 1 to prevent flash
            
            // Animate card sliding back in (no fade to prevent flash)
            Animated.timing(position, {
              toValue: { x: 0, y: 0 },
              duration: 300,
              useNativeDriver: false,
            }).start();
          });
        });
      }
    }
  }, [undoLastSwipe, queueIndex, position, swipedArtists, artistQueue, cardOpacity, width]);

  // Removed rotation - keeping it simple

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

  // Store latest functions in refs for panResponder access
  const swipeRightRef = useRef(swipeRight);
  const swipeLeftRef = useRef(swipeLeft);
  
  // Update refs when functions change
  useEffect(() => {
    swipeRightRef.current = swipeRight;
    swipeLeftRef.current = swipeLeft;
  }, [swipeRight, swipeLeft]);

  // Create panResponder - recreate when dependencies change
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => {
        // ALWAYS allow gestures - never block them
        // If animation is stuck, we'll reset it in onPanResponderGrant
        return true;
      },
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Allow gesture if horizontal movement is significant
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 10;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        // Stop any running animations and capture current position
        position.stopAnimation((value) => {
          position.setOffset({ x: value.x, y: value.y });
          position.setValue({ x: 0, y: 0 });
        });
      },
      onPanResponderMove: (_, gesture) => {
        // Simple horizontal movement for visual feedback (no animation on release)
        position.setValue({ 
          x: gesture.dx, 
          y: 0
        });
      },
      onPanResponderRelease: (_, gesture) => {
        // Get final position
        position.flattenOffset();
        const currentX = position.x._value;
        
        const swipeVelocity = Math.abs(gesture.vx);
        const swipeDistance = Math.abs(gesture.dx);

        // Determine if should swipe based on distance or velocity
        const shouldSwipe = swipeDistance > SWIPE_THRESHOLD || swipeVelocity > 0.3;

        if (shouldSwipe) {
          // Determine direction
          if (gesture.dx > 5 || currentX > 5) {
            swipeRightRef.current();
          } else if (gesture.dx < -5 || currentX < -5) {
            swipeLeftRef.current();
          } else {
            // Not enough direction - animate back to center smoothly
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              tension: 50,
              friction: 7,
            }).start(() => {
              position.setOffset({ x: 0, y: 0 });
            });
          }
        } else {
          // Small movement - check if it's a tap
          if (swipeDistance < 5 && Math.abs(gesture.dy) < 5) {
            setShowPortfolioModal(true);
          }
          
          // Animate back to center smoothly for small movements
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            position.setOffset({ x: 0, y: 0 });
          });
        }
      },
    }),
    [swipeRight, swipeLeft]
  );

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (!isArtist && artists.length === 0) {
      fetchArtists();
    }
  }, [isArtist, artists.length, fetchArtists]);

  useEffect(() => {
    if (!isArtist) {
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
    }
  }, [isArtist]);

  useFocusEffect(
    useCallback(() => {
      // For artists: navigate to upload screen
      if (isArtist) {
        const timeout = setTimeout(() => {
          router.push('/artwork/upload');
        }, 50);
        return () => clearTimeout(timeout);
      }
    }, [isArtist])
  );

  const handleCloseInstructions = useCallback(async () => {
    setShowInstructions(false);
    try {
      await AsyncStorage.setItem('hasSeenExploreInstructions', 'true');
    } catch (error) {
      console.error('Error saving instructions flag:', error);
    }
  }, []);

  // For artists: show loading and redirect to upload (after all hooks)
  if (isArtist) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: position.x.interpolate({
              inputRange: [-width, -SWIPE_THRESHOLD / 2, 0, SWIPE_THRESHOLD / 2, width],
              outputRange: [0, 0.5, 1, 0.5, 0],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: position.x.interpolate({
                  inputRange: [-width, 0, width],
                  outputRange: [-20, 0, -20],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>
          {currentArtist.users?.username || 'Artist'}
        </Text>
        <TouchableOpacity style={styles.moreButton} onPress={() => setShowInstructions(true)}>
          <Ionicons name="help-circle-outline" size={28} color={colors.text.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Card Container */}
      <View style={styles.cardContainer}>
        {/* Next Card Preview (Behind Current Card) */}
        {nextArtist && nextImage && (
          <Animated.View
            style={[
              styles.card,
              styles.nextCard,
              {
                transform: [
                  { scale: nextCardScale },
                ],
                opacity: nextCardOpacity,
              },
            ]}
            pointerEvents="none"
          >
            <Image
              source={{ uri: nextImage }}
              style={styles.cardImage}
              contentFit="cover"
              cachePolicy="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.gradient}
            >
              <View style={styles.infoContainer}>
                <Text style={styles.nextCardName}>
                  {nextArtist.users?.username || 'Artist'}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
        
        {/* Current Card - SIMPLIFIED: Only horizontal movement, no rotation */}
        {/* CRITICAL: No key prop - key causes remounting which resets animation */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
              ],
              opacity: cardOpacity,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Like/Nope Overlays */}
          <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]} pointerEvents="none">
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeOverlay, { opacity: nopeOpacity }]} pointerEvents="none">
            <Text style={styles.nopeText}>NOPE</Text>
          </Animated.View>

          {/* Portfolio Image */}
          <View style={styles.cardImageContainer}>
            {currentImage ? (
              <>
                <Image
                  key={`artist-${currentArtist?.id}-img-${currentPortfolioImage}`}
                  source={{ uri: currentImage }}
                  style={styles.cardImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                
                {/* Portfolio Navigation Buttons */}
                {portfolioImages.length > 1 && (
                  <>
                    {/* Left Arrow */}
                    {currentPortfolioImage > 0 && (
                      <TouchableOpacity
                        style={[styles.portfolioNavButton, styles.portfolioNavButtonLeft]}
                        onPress={() => setCurrentPortfolioImage(prev => Math.max(0, prev - 1))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
                      </TouchableOpacity>
                    )}
                    
                    {/* Right Arrow */}
                    {currentPortfolioImage < portfolioImages.length - 1 && (
                      <TouchableOpacity
                        style={[styles.portfolioNavButton, styles.portfolioNavButtonRight]}
                        onPress={() => setCurrentPortfolioImage(prev => Math.min(portfolioImages.length - 1, prev + 1))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chevron-forward" size={28} color={colors.text.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </>
            ) : (
              <View style={styles.cardImagePlaceholder}>
                <Text style={styles.placeholderText}>No portfolio images</Text>
              </View>
            )}
          </View>

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
              <Text style={styles.artistName}>
                {currentArtist.users?.username}
              </Text>
            </TouchableOpacity>
            <Text style={styles.bio} numberOfLines={2}>
              {currentArtist.users?.bio || 'Artist on Verro'}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons name="star" size={14} color={colors.status.warning} />
                <Text style={styles.statText}>
                  {currentArtist.rating?.toFixed(1) || 'New'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="briefcase" size={14} color={colors.text.secondary} />
                <Text style={styles.statText}>
                  {currentArtist.total_commissions || 0} commissions
                </Text>
              </View>
            </View>

            {/* Commission Packages Badge */}
            {packages.length > 0 && (
              <TouchableOpacity
                style={styles.packagesBadge}
                onPress={() => router.push(`/artist/${currentArtist.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.packagesBadgeContent}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary} />
                  <Text style={styles.packagesBadgeText}>
                    {packages.length} Package{packages.length !== 1 ? 's' : ''} Available
                  </Text>
                </View>
                <View style={styles.packagesPreview}>
                  {packages.slice(0, 3).map((pkg, idx) => (
                    <Text key={pkg.id || idx} style={styles.packagePrice}>
                      ${pkg.base_price}
                    </Text>
                  ))}
                  {packages.length > 3 && (
                    <Text style={styles.packagePriceMore}>+{packages.length - 3} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Commission Packages Badge */}
            {packages.length > 0 && (
              <TouchableOpacity
                style={styles.packagesBadge}
                onPress={() => router.push(`/artist/${currentArtist.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.packagesBadgeContent}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary} />
                  <Text style={styles.packagesBadgeText}>
                    {packages.length} Package{packages.length !== 1 ? 's' : ''} Available
                  </Text>
                </View>
                <View style={styles.packagesPreview}>
                  {packages.slice(0, 3).map((pkg, idx) => (
                    <Text key={pkg.id || idx} style={styles.packagePrice}>
                      ${pkg.base_price}
                    </Text>
                  ))}
                  {packages.length > 3 && (
                    <Text style={styles.packagePriceMore}>+{packages.length - 3} more</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}

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
              {currentArtist.users?.avatar_url && (
                <Image
                  source={{ uri: currentArtist.users.avatar_url }}
                  style={styles.viewPortfolioAvatar}
                  contentFit="cover"
                />
              )}
              <View style={styles.viewPortfolioTextContainer}>
                <Text style={styles.viewPortfolioText}>View Full Portfolio</Text>
                <Text style={styles.viewPortfolioSubtext}>Tap card to explore artworks</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Undo Button */}
        {swipedArtists.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.undoButton]}
            onPress={handleUndo}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo" size={28} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={swipeLeft}
        >
          <Ionicons name="close" size={32} color={colors.status.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={swipeRight}
        >
          <Ionicons name="heart" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Portfolio Modal */}
      {showPortfolioModal && currentArtist && (
        <PortfolioModal
          visible={showPortfolioModal}
          onClose={() => setShowPortfolioModal(false)}
          artist={currentArtist}
          portfolioImages={portfolioImages}
        />
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <InstructionsModal
          visible={showInstructions}
          onClose={handleCloseInstructions}
        />
      )}
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
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle}>
              {artist?.users?.full_name || artist?.users?.username}'s Portfolio
            </Text>
            <View style={styles.modalCounter}>
              <Ionicons name="images-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.modalSubtitle}>
                {currentIndex + 1} / {portfolioImages.filter(img => img && img.trim() !== '').length}
              </Text>
            </View>
          </View>
          <View style={styles.modalCloseButton} />
        </View>

        {/* Image Scroll View */}
        <View style={styles.modalImageWrapper}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
          >
            {portfolioImages.filter(img => img && img.trim() !== '').map((imageUri, index) => (
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
          {portfolioImages.filter(img => img && img.trim() !== '').length > 1 && (
            <View style={styles.paginationDots}>
              {portfolioImages.filter(img => img && img.trim() !== '').map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === currentIndex && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Footer with Artist Info */}
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.artistInfoCard}
            onPress={() => {
              onClose();
              router.push(`/artist/${artist?.id}`);
            }}
            activeOpacity={0.7}
          >
            {artist?.users?.avatar_url && (
              <Image
                source={{ uri: artist.users.avatar_url }}
                style={styles.artistAvatarModal}
                contentFit="cover"
              />
            )}
            <View style={styles.artistDetailsModal}>
              <Text style={styles.artistNameModal} numberOfLines={1}>
                {artist?.users?.full_name || artist?.users?.username}
              </Text>
              <View style={styles.tapToProfileRow}>
                <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
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
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.instructionsOverlay}>
        <TouchableOpacity 
          style={styles.instructionsBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.instructionsContent}>
          <View style={styles.instructionsHeader}>
            <Text style={styles.instructionsTitle}>How to Use Explore</Text>
            <TouchableOpacity onPress={onClose} style={styles.instructionsCloseButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.instructionsScrollWrapper}>
            <ScrollView 
              style={styles.instructionsScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.instructionsScrollContent}
            >
              <View style={styles.instructionsList}>
                <View style={styles.instructionItem}>
                  <View style={[styles.instructionIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="heart" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.instructionText}>
                    <Text style={styles.instructionTitle}>Swipe Right or Tap Heart</Text>
                    <Text style={styles.instructionDescription}>
                      Like an artist and save them to your Liked list in Library
                    </Text>
                  </View>
                </View>

                <View style={styles.instructionItem}>
                  <View style={[styles.instructionIcon, { backgroundColor: `${colors.error}15` }]}>
                    <Ionicons name="close" size={24} color={colors.error} />
                  </View>
                  <View style={styles.instructionText}>
                    <Text style={styles.instructionTitle}>Swipe Left or Tap X</Text>
                    <Text style={styles.instructionDescription}>Pass on this artist</Text>
                  </View>
                </View>

                <View style={styles.instructionItem}>
                  <View style={[styles.instructionIcon, { backgroundColor: `${colors.text.secondary}15` }]}>
                    <Ionicons name="arrow-undo" size={24} color={colors.text.secondary} />
                  </View>
                  <View style={styles.instructionText}>
                    <Text style={styles.instructionTitle}>Undo</Text>
                    <Text style={styles.instructionDescription}>
                      Tap the undo button to go back to the previous artist
                    </Text>
                  </View>
                </View>

                <View style={styles.instructionItem}>
                  <View style={[styles.instructionIcon, { backgroundColor: `${colors.text.secondary}15` }]}>
                    <Ionicons name="chevron-back" size={24} color={colors.text.secondary} />
                  </View>
                  <View style={styles.instructionText}>
                    <Text style={styles.instructionTitle}>Browse Portfolio</Text>
                    <Text style={styles.instructionDescription}>
                      Use the arrow buttons on the card to browse through portfolio images
                    </Text>
                  </View>
                </View>

                <View style={styles.instructionItem}>
                  <View style={[styles.instructionIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Ionicons name="cube-outline" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.instructionText}>
                    <Text style={styles.instructionTitle}>Commission Packages</Text>
                    <Text style={styles.instructionDescription}>
                      Tap the packages badge to view available commission packages and prices
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
              </View>
            </ScrollView>
          </View>

          <SafeAreaView style={styles.instructionsButtonContainer} edges={['bottom']}>
            <TouchableOpacity style={styles.instructionsButton} onPress={onClose}>
              <Text style={styles.instructionsButtonText}>Got it!</Text>
            </TouchableOpacity>
          </SafeAreaView>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md + spacing.md,
    paddingBottom: spacing.md,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 26,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.4,
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20, // Make it circular
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.md, // Moved card up even more
    paddingBottom: 120, // Reduced space for action buttons (moves buttons up)
  },
  card: {
    width: width - spacing.xl * 2,
    height: height * 0.65,
    borderRadius: 20, // Pinterest-style soft rounding
    overflow: 'hidden',
    backgroundColor: colors.background,
    position: 'absolute',
    top: spacing.md, // Position card higher up
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, // Soft Pinterest-style shadow
    shadowRadius: 16,
    elevation: 4,
  },
  nextCard: {
    zIndex: 0,
    transform: [{ scale: 0.95 }],
    opacity: 0.5,
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  portfolioNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20, // Center vertically (half of button height)
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer Pinterest-style overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  portfolioNavButtonLeft: {
    left: spacing.md,
  },
  portfolioNavButtonRight: {
    right: spacing.md,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 18,
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
    fontWeight: '700', // Pinterest-style
  },
  artworkCounter: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Softer overlay
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    zIndex: 5,
  },
  counterText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500', // Pinterest-style lighter
    fontSize: 12,
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
    padding: spacing.md,
  },
  profileLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  artistAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    flex: 1,
  },
  bio: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400', // Pinterest-style
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs - 1,
  },
  statText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500', // Pinterest-style
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400', // Pinterest-style
  },
  price: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600', // Pinterest-style
  },
  viewPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface + '80',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  viewPortfolioAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  viewPortfolioTextContainer: {
    flex: 1,
  },
  viewPortfolioText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600', // Pinterest-style
    marginBottom: 2,
  },
  viewPortfolioSubtext: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '400', // Pinterest-style
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + spacing.xs,
    position: 'absolute',
    bottom: 15, // Position from bottom
    left: 0,
    right: 0,
    zIndex: 10,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  undoButton: {
    width: 56,
    height: 56,
    backgroundColor: colors.background,
    borderWidth: 0, // Remove border for cleaner look
    opacity: 1,
  },
  nopeButton: {
    width: 64,
    height: 64,
  },
  likeButton: {
    width: 64,
    height: 64,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
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
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  modalCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  modalImageWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    alignItems: 'center',
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
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.primary + '4D', // 0.3 opacity
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  modalFooter: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  artistInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: 16, // Pinterest-style soft rounding
    borderWidth: 0, // Remove border for cleaner look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, // Very soft shadow
    shadowRadius: 8,
    elevation: 2,
  },
  artistAvatarModal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 0, // Remove border for cleaner look
  },
  artistDetailsModal: {
    flex: 1,
  },
  artistNameModal: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '600', // Pinterest-style
    marginBottom: spacing.xs - 2,
  },
  tapToProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapToProfileTextModal: {
    ...typography.small,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  // Instructions Modal
  instructionsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  instructionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  instructionsContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, // Pinterest-style soft rounding
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    width: '100%',
    flex: 1,
  },
  instructionsScrollWrapper: {
    flex: 1,
    minHeight: 0,
  },
  instructionsScroll: {
    flex: 1,
  },
  instructionsScrollContent: {
    paddingBottom: spacing.md,
  },
  instructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  instructionsTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.4,
  },
  instructionsCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsList: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  instructionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
  },
  instructionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  instructionDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  instructionsButtonContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  instructionsButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    maxWidth: 200,
  },
  instructionsButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  packagesBadge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  packagesBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  packagesBadgeText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 13,
  },
  packagesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  packagePrice: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  packagePriceMore: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  nextCardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 18,
  },
});
