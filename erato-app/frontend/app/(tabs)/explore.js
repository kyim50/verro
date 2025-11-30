import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
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
  const [currentArtwork, setCurrentArtwork] = useState(0);
  
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

  const artworks = currentArtist.artworks || [];
  const currentArtworkData = artworks[currentArtwork] || artworks[0];

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

        {/* Artwork Image */}
        <Image
          source={{ uri: currentArtworkData?.image_url }}
          style={styles.cardImage}
          contentFit="cover"
        />

        {/* Artwork Counter */}
        {artworks.length > 1 && (
          <View style={styles.artworkCounter}>
            <Text style={styles.counterText}>
              {currentArtwork + 1} / {artworks.length}
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
            <Text style={styles.artistName}>
              {currentArtist.users?.full_name || currentArtist.users?.username}
            </Text>
            <Text style={styles.bio} numberOfLines={2}>
              {currentArtist.users?.bio || 'Artist on Erato'}
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
                ${currentArtist.min_price} - ${currentArtist.max_price}
              </Text>
            </View>
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

      {/* Artwork Navigation */}
      {artworks.length > 1 && (
        <View style={styles.artworkNav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentArtwork(Math.max(0, currentArtwork - 1))}
            disabled={currentArtwork === 0}
          >
            <Ionicons 
              name="chevron-back" 
              size={24} 
              color={currentArtwork === 0 ? colors.text.disabled : colors.text.primary} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentArtwork(Math.min(artworks.length - 1, currentArtwork + 1))}
            disabled={currentArtwork === artworks.length - 1}
          >
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={currentArtwork === artworks.length - 1 ? colors.text.disabled : colors.text.primary} 
            />
          </TouchableOpacity>
        </View>
      )}
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
});