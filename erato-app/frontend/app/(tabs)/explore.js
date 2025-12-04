import { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

export default function ExploreScreen() {
  const { artists, currentIndex, fetchArtists, swipe } = useSwipeStore();
  const [currentPortfolioImage, setCurrentPortfolioImage] = useState(0);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const swipeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (artists.length === 0) {
      fetchArtists();
    }
  }, []);

  const currentArtist = artists[currentIndex];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
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
        <TouchableOpacity style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentArtist.users?.username || 'Artist'}
        </Text>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={28} color={colors.text.primary} />
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
});