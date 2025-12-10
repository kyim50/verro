import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useAuthStore, useSwipeStore } from '../../store';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function CreateScreen() {
  const { user } = useAuthStore();
  const { artists, currentIndex, fetchArtists, swipe } = useSwipeStore();
  const isArtist = user?.user_type === 'artist' || 
                   (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  
  const [currentPortfolioImage, setCurrentPortfolioImage] = useState(0);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    if (!isArtist && artists.length === 0) {
      fetchArtists();
    }
  }, [isArtist]);

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

  const handleCloseInstructions = async () => {
    setShowInstructions(false);
    try {
      await AsyncStorage.setItem('hasSeenExploreInstructions', 'true');
    } catch (error) {
      console.error('Error saving instructions flag:', error);
    }
  };

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

  // For artists: show loading and redirect to upload
  if (isArtist) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // For clients: show Tinder swipe view
  const currentArtist = artists[currentIndex];
  const portfolioImages = currentArtist?.portfolio_images || [];
  const currentImage = portfolioImages[currentPortfolioImage] || portfolioImages[0];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
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
        position.setValue({ 
          x: gesture.dx, 
          y: gesture.dy * 0.3
        });
      },
      onPanResponderRelease: (_, gesture) => {
        position.flattenOffset();
        const swipeVelocity = Math.abs(gesture.vx);
        const swipeDistance = Math.abs(gesture.dx);

        if (swipeDistance > SWIPE_THRESHOLD || swipeVelocity > 0.5) {
          if (gesture.dx > 0) {
            swipeRight();
          } else {
            swipeLeft();
          }
        } else {
          // If it's a tap (small movement), open portfolio
          if (swipeDistance < 5 && Math.abs(gesture.dy) < 5) {
            setShowPortfolioModal(true);
          }
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 50,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const swipeRight = () => {
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (currentArtist) {
        swipe(currentArtist.id, 'right');
      }
      position.setValue({ x: 0, y: 0 });
    });
  };

  const swipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 200,
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
          <View style={styles.cardImageContainer}>
            <Image
              source={{ uri: currentImage }}
              style={styles.cardImage}
              contentFit="cover"
            />
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

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
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
          <Ionicons name="heart" size={32} color={colors.status.success} />
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
                {currentIndex + 1} / {portfolioImages.length}
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
          {portfolioImages.length > 1 && (
            <View style={styles.paginationDots}>
              {portfolioImages.map((_, index) => (
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
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
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
    fontSize: 12,
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
    fontSize: 12,
  },
  price: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
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
    fontSize: 14,
    marginBottom: 2,
  },
  viewPortfolioSubtext: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + spacing.xl,
    marginBottom: spacing.sm,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
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
    backgroundColor: '#000',
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
    backgroundColor: '#000',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  modalFooter: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
  },
  artistInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '15',
  },
  artistAvatarModal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  artistDetailsModal: {
    flex: 1,
  },
  artistNameModal: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  instructionsContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  instructionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  instructionsTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  instructionsCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  instructionsButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  instructionsButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
