import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = (width - spacing.md * 4) / 3;

export default function ProfileScreen() {
  const { user, token, logout } = useAuthStore();
  const { profile, fetchProfile, isLoading } = useProfileStore();

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      await fetchProfile(user.id, token);
    } catch (error) {
      console.error('Error loading profile:', error);
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

              <View style={styles.commissionInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={[
                    styles.statusBadge,
                    profile.artist.commission_status === 'open' && styles.statusOpen
                  ]}>
                    <Text style={styles.statusText}>
                      {profile.artist.commission_status === 'open' ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Pricing</Text>
                  <Text style={styles.infoValue}>
                    ${profile.artist.min_price} - ${profile.artist.max_price}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Turnaround</Text>
                  <Text style={styles.infoValue}>
                    {profile.artist.turnaround_days} days
                  </Text>
                </View>

                {profile.artist.specialties && profile.artist.specialties.length > 0 && (
                  <View style={styles.specialtiesContainer}>
                    <Text style={styles.infoLabel}>Specialties</Text>
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

            {/* Portfolio */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Portfolio</Text>
                <Text style={styles.artworkCount}>{artworks.length}</Text>
              </View>

              <View style={styles.artworkGrid}>
                {artworks.map((artwork) => (
                  <TouchableOpacity
                    key={artwork.id}
                    style={styles.artworkItem}
                    onPress={() => router.push(`/artwork/${artwork.id}`)}
                  >
                    <Image
                      source={{ uri: artwork.thumbnail_url || artwork.image_url }}
                      style={styles.artworkImage}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reviews */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color={colors.warning} />
                  <Text style={styles.ratingText}>
                    {profile.artist.average_rating.toFixed(1)} ({profile.artist.review_count})
                  </Text>
                </View>
              </View>
            </View>
          </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  profileSection: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    ...typography.h2,
    color: colors.text.primary,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  artworkCount: {
    ...typography.body,
    color: colors.text.secondary,
  },
  commissionInfo: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  statusOpen: {
    backgroundColor: colors.success + '20',
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  specialtiesContainer: {
    paddingTop: spacing.sm,
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
});