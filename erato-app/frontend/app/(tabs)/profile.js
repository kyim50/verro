import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore, useProfileStore, useFeedStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = (width - spacing.md * 4) / 3;
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function ProfileScreen() {
  const { user, token, logout } = useAuthStore();
  const { profile, fetchProfile, isLoading, reset } = useProfileStore();
  const feedStore = useFeedStore();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Auto-refresh when screen comes into focus (but keep existing data)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        // Only refresh if we don't have profile data or user changed
        if (!profile || profile.id !== user.id) {
          loadProfile();
        }
      }
    }, [user?.id, profile])
  );

  useEffect(() => {
    // Only reset if user actually changed (not on every mount)
    const currentUserId = profile?.id;
    if (currentUserId && currentUserId !== user?.id) {
      reset();
    }

    if (user?.id) {
      // If we already have profile data for this user, don't reset
      if (profile && profile.id === user.id) {
        setIsInitialLoad(false);
        return;
      }
      loadProfile();
    }
  }, [user?.id]); // Use user.id to ensure it triggers on user change

  const loadProfile = async () => {
    try {
      if (!user?.id) return;
      await fetchProfile(user.id, token);
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setIsInitialLoad(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const isArtist = profile?.artist !== null && profile?.artist !== undefined;
  const artworks = profile?.artist?.artworks || [];
  const artistId = profile?.artist?.id || profile?.id;
  const isOwnProfile = user?.id === profile?.id;

  const handleDeleteArtwork = async (artworkId) => {
    if (!token || !isOwnProfile) return;
    Alert.alert(
      'Delete Artwork',
      'Hold to confirm deleting this artwork. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const deleteResponse = await axios.delete(`${API_URL}/artworks/${artworkId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              
              // Remove from feed store immediately
              try {
                feedStore.removeArtwork?.(artworkId);
              } catch (e) {
                console.warn('Feed store removal failed:', e?.message || e);
              }
              
              // Optimistically remove from local state immediately
              const { profile: currentProfile } = useProfileStore.getState();
              if (currentProfile?.artist?.artworks) {
                useProfileStore.setState({
                  profile: {
                    ...currentProfile,
                    artist: {
                      ...currentProfile.artist,
                      artworks: currentProfile.artist.artworks.filter(a => String(a.id) !== String(artworkId))
                    }
                  }
                });
              }
              
              // Force refresh profile by resetting and fetching fresh data
              reset();
              await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure state clears
              await fetchProfile(user.id, token);
              
              Alert.alert('Success', 'Artwork deleted successfully');
            } catch (error) {
              console.error('Error deleting artwork:', error);
              const msg = error.response?.data?.error || 'Failed to delete artwork. Please try again.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  const handleDeletePortfolioImage = async (index) => {
    if (!token || !isOwnProfile) return;
    const currentImages = profile?.artist?.portfolio_images || [];
    const updated = currentImages.filter((_, idx) => idx !== index);

    Alert.alert(
      'Remove Portfolio Image',
      'Remove this portfolio image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.put(
                `${API_URL}/users/me/artist`,
                { portfolio_images: updated },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              );
              await fetchProfile(user.id, token);
            } catch (error) {
              console.error('Error removing portfolio image:', error);
              const msg = error.response?.data?.error || 'Failed to remove image. Please try again.';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
  };

  // Show loading only on initial load with no cached data
  if (isInitialLoad && isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // If we have profile data, show it even if loading (optimistic display)
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color={colors.text.disabled} />
              </View>
            )}
          </View>

          <Text style={styles.username}>@{profile?.username}</Text>
          {profile?.full_name && (
            <Text style={styles.fullName}>{profile.full_name}</Text>
          )}

          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/edit')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Artist Section */}
        {isArtist && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Commission Info</Text>
                <TouchableOpacity onPress={() => router.push('/profile/edit-artist')}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.commissionCard}>
                <View style={styles.commissionRow}>
                  <View style={styles.rowLeft}>
                    <Ionicons
                      name={
                        profile.artist.commission_status === 'open'
                          ? 'checkmark-circle'
                          : profile.artist.commission_status === 'limited'
                          ? 'time'
                          : 'close-circle'
                      }
                      size={18}
                      color={
                        profile.artist.commission_status === 'open'
                          ? colors.success
                          : profile.artist.commission_status === 'limited'
                          ? colors.warning
                          : colors.text.secondary
                      }
                    />
                    <Text style={styles.infoLabel}>Status</Text>
                  </View>
                  <Text
                    style={[
                      styles.statusText,
                      profile.artist.commission_status === 'open' && styles.statusOpenText,
                      profile.artist.commission_status === 'limited' && styles.statusLimitedText,
                      profile.artist.commission_status === 'closed' && styles.statusClosedText,
                    ]}
                  >
                    {profile.artist.commission_status === 'open'
                      ? 'Open'
                      : profile.artist.commission_status === 'limited'
                      ? 'Limited'
                      : 'Closed'}
                  </Text>
                </View>

                <View style={styles.commissionRow}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="pricetag" size={18} color={colors.text.secondary} />
                    <Text style={styles.infoLabel}>Pricing</Text>
                  </View>
                  <Text style={styles.infoValue}>
                    ${profile.artist.min_price} - ${profile.artist.max_price}
                  </Text>
                </View>

                <View style={styles.commissionRow}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="time-outline" size={18} color={colors.text.secondary} />
                    <Text style={styles.infoLabel}>Turnaround</Text>
                  </View>
                  <Text style={styles.infoValue}>{profile.artist.turnaround_days} days</Text>
                </View>

                {profile.artist.specialties && profile.artist.specialties.length > 0 && (
                  <View style={styles.specialtiesContainer}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="brush" size={18} color={colors.text.secondary} />
                      <Text style={styles.infoLabel}>Specialties</Text>
                    </View>
                    <View style={styles.tagContainer}>
                      {profile.artist.specialties.map((specialty, index) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{specialty}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Portfolio Images */}
            {isArtist && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Portfolio Highlights</Text>
                  <TouchableOpacity onPress={() => router.push('/profile/edit-portfolio')}>
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {profile.artist.portfolio_images && profile.artist.portfolio_images.length > 0 ? (
                  <View style={styles.portfolioGrid}>
                    {profile.artist.portfolio_images.map((imageUrl, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.portfolioItem}
                        activeOpacity={0.85}
                        onLongPress={() => {
                          if (isOwnProfile) {
                            handleDeletePortfolioImage(index);
                          }
                        }}
                      >
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.portfolioImage}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addPortfolioButton}
                    onPress={() => router.push('/profile/edit-portfolio')}
                  >
                    <Ionicons name="add-circle-outline" size={48} color={colors.primary} />
                    <Text style={styles.addPortfolioText}>Add Portfolio Images</Text>
                    <Text style={styles.addPortfolioSubtext}>Showcase your best work to attract clients</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Artworks */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>All Artworks</Text>
                <View style={styles.artworkActions}>
                  <Text style={styles.artworkCount}>{artworks.length}</Text>
                  <TouchableOpacity onPress={() => router.push('/artwork/upload')}>
                    <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {artworks.length > 0 ? (
                <View style={styles.artworkGrid}>
                  {artworks.map((artwork) => (
                    <TouchableOpacity
                      key={artwork.id}
                      style={styles.artworkItem}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/artwork/${artwork.id}`)}
                      onLongPress={() => {
                        if (isOwnProfile) {
                          handleDeleteArtwork(artwork.id);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: artwork.thumbnail_url || artwork.image_url }}
                        style={styles.artworkImage}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No artworks uploaded yet</Text>
              )}
            </View>

            {/* Reviews */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color={colors.status.warning} />
                  <Text style={styles.ratingText}>
                    {profile.artist.average_rating ? profile.artist.average_rating.toFixed(1) : 'N/A'} ({profile.artist.review_count || 0})
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Client Stats Section (only for non-artists) */}
        {!isArtist && (
          <View style={styles.section}>
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => router.push('/(tabs)/boards')}
              >
                <View style={styles.statIconContainer}>
                  <Ionicons name="heart" size={24} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{profile?.boards?.length || 0}</Text>
                <Text style={styles.statLabel}>Boards</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                onPress={() => router.push('/(tabs)/boards?tab=commissions')}
              >
                <View style={styles.statIconContainer}>
                  <Ionicons name="briefcase" size={24} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>
                  {/* This would need to be fetched from the backend */}
                  0
                </Text>
                <Text style={styles.statLabel}>Commissions</Text>
              </TouchableOpacity>

              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="time" size={24} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'N/A'}
                </Text>
                <Text style={styles.statLabel}>Member Since</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions (for clients) */}
        {!isArtist && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsList}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="compass" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Discover Artists</Text>
                  <Text style={styles.quickActionSubtitle}>
                    Find artists that match your style
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/(tabs)/boards?tab=commissions')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>My Commissions</Text>
                  <Text style={styles.quickActionSubtitle}>View your commission requests</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/(tabs)/messages')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Messages</Text>
                  <Text style={styles.quickActionSubtitle}>Chat with artists</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Boards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Boards</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/boards')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {profile?.boards && profile.boards.length > 0 ? (
            <View style={styles.boardsList}>
              {profile.boards.slice(0, 3).map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={styles.boardItem}
                  onPress={() => router.push(`/board/${board.id}`)}
                >
                  <Ionicons name="albums" size={20} color={colors.text.secondary} />
                  <Text style={styles.boardName}>{board.name}</Text>
                  {!board.is_public && (
                    <Ionicons name="lock-closed" size={14} color={colors.text.disabled} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No boards yet</Text>
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingTop: IS_SMALL_SCREEN ? Constants.statusBarHeight + spacing.sm : Constants.statusBarHeight + spacing.md,
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
  },
  profileSection: {
    alignItems: 'center',
    padding: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 90 : 100,
    height: IS_SMALL_SCREEN ? 90 : 100,
    borderRadius: IS_SMALL_SCREEN ? 45 : 50,
  },
  avatarPlaceholder: {
    width: IS_SMALL_SCREEN ? 90 : 100,
    height: IS_SMALL_SCREEN ? 90 : 100,
    borderRadius: IS_SMALL_SCREEN ? 45 : 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    marginBottom: spacing.xs,
  },
  fullName: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  editButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  section: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingVertical: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
  },
  artworkCount: {
    ...typography.body,
    color: colors.text.secondary,
  },
  artworkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  portfolioItem: {
    width: (width - (IS_SMALL_SCREEN ? spacing.sm : spacing.md) * 4) / 2,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  commissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  statusText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  statusOpenText: {
    color: colors.success,
  },
  statusLimitedText: {
    color: colors.warning,
  },
  statusClosedText: {
    color: colors.text.secondary,
  },
  specialtiesContainer: {
    gap: spacing.xs,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  artworkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  artworkItem: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    ...typography.body,
    color: colors.text.primary,
  },
  boardsList: {
    gap: spacing.sm,
  },
  boardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  boardName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  seeAllText: {
    ...typography.body,
    color: colors.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  addPortfolioButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addPortfolioText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  addPortfolioSubtext: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  quickActionsList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});