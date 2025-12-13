import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  StatusBar,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore, useProfileStore, useFeedStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import StylePreferenceQuiz from '../../components/StylePreferenceQuiz';
import ReviewCard from '../../components/ReviewCard';
import { showAlert } from '../../components/StyledAlert';

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
  const [avatarKey, setAvatarKey] = useState(0);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [selectedPortfolioIndex, setSelectedPortfolioIndex] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAction, setDeleteAction] = useState(null);
  const [portfolioTouchBlocked, setPortfolioTouchBlocked] = useState(false);
  const portfolioModalClosingRef = useRef(false);
  const prevAvatarUrlRef = useRef(null);
  const [reviewsReceived, setReviewsReceived] = useState([]);
  const [reviewsGiven, setReviewsGiven] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState('received'); // 'received' or 'given'
  const insets = useSafeAreaInsets();

  // Auto-refresh when screen comes into focus - but only if needed
  useFocusEffect(
    useCallback(() => {
      // Don't refresh on every focus - only if we have profile data and it's been a while
      // This prevents constant flashing
      if (user?.id && profile?.id === user.id) {
        // Only refresh if profile data seems stale (optional - can be removed if still flashing)
        // For now, skip auto-refresh to prevent flashing
        // loadProfile(true);
      }
    }, [user?.id, profile?.id])
  );

  useEffect(() => {
    // Only reset if user actually changed (not on every mount)
    const currentUserId = profile?.id;
    if (currentUserId && currentUserId !== user?.id) {
      reset();
      setIsInitialLoad(true);
      prevAvatarUrlRef.current = null; // Reset avatar ref on user change
    }

    if (user?.id) {
      // If we already have profile data for this user, don't reset or reload
      if (profile && profile.id === user.id) {
        setIsInitialLoad(false);
        // Set avatar ref if not set (without updating key)
        const currentAvatarUrl = profile?.avatar_url || user?.avatar_url;
        if (currentAvatarUrl && !prevAvatarUrlRef.current) {
          prevAvatarUrlRef.current = currentAvatarUrl;
        }
        return;
      }
      // Only load if we don't have profile data yet
      if (!profile || profile.id !== user.id) {
        loadProfile();
      }
    } else {
      // No user - ensure we're not showing loading
      setIsInitialLoad(false);
    }
  }, [user?.id]); // Remove loadProfile from deps to prevent re-triggering

  const loadProfile = useCallback(async (forceRefresh = false) => {
    try {
      if (!user?.id) return;
      const prevAvatarUrl = prevAvatarUrlRef.current;
      await fetchProfile(user.id, token, forceRefresh);
      // Check if avatar changed and update key to force image refresh
      const updatedProfile = useProfileStore.getState().profile;
      const newAvatarUrl = updatedProfile?.avatar_url || user?.avatar_url;
      // Only update avatar key if URL actually changed (not just on every load)
      if (newAvatarUrl && prevAvatarUrl !== newAvatarUrl) {
        prevAvatarUrlRef.current = newAvatarUrl;
        setAvatarKey(prev => prev + 1);
      } else if (!prevAvatarUrlRef.current && newAvatarUrl) {
        // Set initial avatar URL ref without updating key (prevents flash on first load)
        prevAvatarUrlRef.current = newAvatarUrl;
      }
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setIsInitialLoad(false);
    }
  }, [user?.id, token, fetchProfile]);
  
  // Watch for avatar URL changes - only update key when URL actually changes
  // This handles cases where avatar changes outside of loadProfile (e.g., from edit profile)
  useEffect(() => {
    const currentAvatarUrl = profile?.avatar_url || user?.avatar_url;
    // Only update if URL actually changed (not on every render)
    if (currentAvatarUrl && currentAvatarUrl !== prevAvatarUrlRef.current) {
      prevAvatarUrlRef.current = currentAvatarUrl;
      setAvatarKey(prev => prev + 1);
    } else if (!prevAvatarUrlRef.current && currentAvatarUrl) {
      // Set initial avatar URL ref without updating key
      prevAvatarUrlRef.current = currentAvatarUrl;
    }
  }, [profile?.avatar_url, user?.avatar_url]);

  const loadReviews = useCallback(async () => {
    const isArtist = profile?.artist !== null && profile?.artist !== undefined;
    if (!user?.id || !isArtist || !profile?.artist?.id) return;
    
    setReviewsLoading(true);
    try {
      // Load reviews received (from clients)
      const receivedResponse = await axios.get(
        `${API_URL}/review-enhancements/artist/${profile.artist.id}/with-responses`,
        {
          params: { limit: 50 },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      setReviewsReceived(receivedResponse.data.data?.reviews || []);

      // Load reviews given (to clients)
      try {
        const givenResponse = await axios.get(
          `${API_URL}/reviews/user/${user.id}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        setReviewsGiven(givenResponse.data.reviews || []);
      } catch (givenError) {
        console.log('Error loading reviews given:', givenError);
        setReviewsGiven([]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviewsReceived([]);
      setReviewsGiven([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [user?.id, profile?.artist?.id, token, profile?.artist]);

  useEffect(() => {
    const isArtist = profile?.artist !== null && profile?.artist !== undefined;
    if (isArtist && profile?.artist?.id) {
      loadReviews();
    }
  }, [profile?.artist?.id, loadReviews, profile?.artist]);

  const handleLogout = () => {
    setDeleteAction({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      buttonText: 'Log Out',
      onConfirm: async () => {
        try {
          setShowDeleteModal(false);
          // Clear profile store immediately to prevent seeing old data
          useProfileStore.getState().reset();
          // Navigate immediately with a fast transition
          router.replace('/auth/login');
          // Clear auth state after navigation starts
          setTimeout(async () => {
            await logout();
          }, 50);
        } catch (error) {
          console.error('Logout error:', error);
        }
      },
    });
    setShowDeleteModal(true);
  };

  // Early return if no user (prevents flash during logout)
  // Return a blank screen with background color to prevent white flash
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    );
  }

  // Show loading only if we truly have no data
  const showLoading = isInitialLoad && isLoading && !profile;

  const isArtist = profile?.artist !== null && profile?.artist !== undefined;
  const artworks = profile?.artist?.artworks || [];
  const artistId = profile?.artist?.id || profile?.id;
  const isOwnProfile = user?.id === profile?.id;

  const confirmDeleteArtwork = async (artworkId) => {
    if (!token || !isOwnProfile) return;
    setDeleteAction({
      title: 'Delete Artwork',
      message: 'Are you sure you want to delete this artwork? This cannot be undone.',
      onConfirm: async () => {
        setShowDeleteModal(false);
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
          
          showAlert({
            title: 'Success',
            message: 'Artwork deleted successfully',
            type: 'success',
            duration: 2000,
          });
        } catch (error) {
          console.error('Error deleting artwork:', error);
          const msg = error.response?.data?.error || 'Failed to delete artwork. Please try again.';
          showAlert({
            title: 'Error',
            message: msg,
            type: 'error',
            duration: 3000,
          });
        }
      },
    });
    setShowDeleteModal(true);
  };

  const handleDeleteArtwork = confirmDeleteArtwork;

  const handleDeletePortfolioImage = async (index) => {
    if (!token || !isOwnProfile) return;
    const currentImages = profile?.artist?.portfolio_images || [];
    const updated = currentImages.filter((_, idx) => idx !== index);

    setDeleteAction({
      title: 'Remove Portfolio Image',
      message: 'Are you sure you want to remove this portfolio image?',
      onConfirm: async () => {
        setShowDeleteModal(false);
            try {
              // Filter out any empty/blank images before sending
              const cleanedImages = updated.filter(img => {
                if (!img || typeof img !== 'string') return false;
                const trimmed = img.trim();
                return trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
              });
              await axios.put(
                `${API_URL}/users/me/artist`,
                { portfolio_images: cleanedImages },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              );
              await fetchProfile(user.id, token);
              showAlert({
                title: 'Removed',
                message: 'Portfolio image removed successfully',
                type: 'success',
                duration: 2000,
              });
            } catch (error) {
              console.error('Error removing portfolio image:', error);
              const msg = error.response?.data?.error || 'Failed to remove image. Please try again.';
              showAlert({
                title: 'Error',
                message: msg,
                type: 'error',
                duration: 3000,
              });
            }
      },
    });
    setShowDeleteModal(true);
  };

  const handleDeletePortfolioImageByUrl = async (urlToDelete) => {
    if (!token || !isOwnProfile) return;
    const currentImages = profile?.artist?.portfolio_images || [];
    // Filter out the image by URL (more reliable than index)
    const updated = currentImages.filter(img => {
      if (!img || typeof img !== 'string') return false;
      return img.trim() !== urlToDelete.trim();
    });

    setDeleteAction({
      title: 'Remove Portfolio Image',
      message: 'Are you sure you want to remove this portfolio image?',
      onConfirm: async () => {
        setShowDeleteModal(false);
            try {
              // Filter out any empty/blank images before sending
              const cleanedImages = updated.filter(img => {
                if (!img || typeof img !== 'string') return false;
                const trimmed = img.trim();
                return trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
              });
              await axios.put(
                `${API_URL}/users/me/artist`,
                { portfolio_images: cleanedImages },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
              );
              await fetchProfile(user.id, token);
              showAlert({
                title: 'Removed',
                message: 'Portfolio image removed successfully',
                type: 'success',
                duration: 2000,
              });
            } catch (error) {
              console.error('Error removing portfolio image:', error);
              const msg = error.response?.data?.error || 'Failed to remove image. Please try again.';
              showAlert({
                title: 'Error',
                message: msg,
                type: 'error',
                duration: 3000,
              });
            }
      },
    });
    setShowDeleteModal(true);
  };

  // Always render container to prevent black screen
  return (
    <View style={styles.container}>
      {/* Header - Always render */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 80 }}
      >
        {showLoading ? (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Profile Info */}
            <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {(profile?.avatar_url || user?.avatar_url) ? (
              <Image 
                source={{ 
                  uri: (() => {
                    const url = profile?.avatar_url || user?.avatar_url;
                    // Only add cache-busting parameter if avatar key changed (not on every render)
                    if (avatarKey > 0) {
                      const separator = url?.includes('?') ? '&' : '?';
                      return `${url}${separator}_v=${avatarKey}`;
                    }
                    return url;
                  })()
                }} 
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                transition={300}
                key={avatarKey > 0 ? `avatar-${avatarKey}` : 'avatar-initial'}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={60} color={colors.text.disabled} />
              </View>
            )}
          </View>

          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{profile?.username}</Text>
            <Ionicons 
              name="checkmark-circle" 
              size={18} 
              color={(profile?.is_verified || profile?.verified) ? colors.error : colors.text.disabled}
              style={styles.verifiedBadge}
            />
          </View>
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
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="briefcase" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Commission Info</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => router.push('/profile/edit-artist')}
                  style={styles.editIconButton}
                >
                  <Ionicons name="create-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.commissionCard}>
                {/* Status Badge */}
                <View style={[
                  styles.statusBadgeContainer,
                  profile.artist.commission_status === 'open' && styles.statusBadgeOpen,
                  profile.artist.commission_status === 'limited' && styles.statusBadgeLimited,
                  profile.artist.commission_status === 'closed' && styles.statusBadgeClosed,
                ]}>
                  <Ionicons
                    name={
                      profile.artist.commission_status === 'open'
                        ? 'checkmark-circle'
                        : profile.artist.commission_status === 'limited'
                        ? 'time'
                        : 'close-circle'
                    }
                    size={20}
                    color={
                      profile.artist.commission_status === 'open'
                        ? colors.success
                        : profile.artist.commission_status === 'limited'
                        ? colors.status.warning
                        : colors.error
                    }
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color: profile.artist.commission_status === 'open'
                          ? colors.success
                          : profile.artist.commission_status === 'limited'
                          ? colors.status.warning
                          : colors.error
                      }
                    ]}
                  >
                    {profile.artist.commission_status === 'open'
                      ? 'Open for Commissions'
                      : profile.artist.commission_status === 'limited'
                      ? 'Limited Availability'
                      : 'Currently Closed'}
                  </Text>
                </View>

                {/* Info Grid */}
                <View style={styles.infoGrid}>
                  <View style={styles.infoGridItem}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="pricetag" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.infoGridLabel}>Pricing</Text>
                    <Text style={styles.infoGridValue}>
                      ${profile.artist.min_price} - ${profile.artist.max_price}
                    </Text>
                  </View>

                  <View style={styles.infoGridItem}>
                    <View style={styles.infoIconContainer}>
                      <Ionicons name="time-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.infoGridLabel}>Turnaround</Text>
                    <Text style={styles.infoGridValue}>{profile.artist.turnaround_days} days</Text>
                  </View>
                </View>

                {profile.artist.specialties && profile.artist.specialties.length > 0 && (
                  <View style={styles.specialtiesContainer}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="brush" size={18} color={colors.primary} />
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

{(() => {
                  // Filter out empty/null/blank images
                  const portfolioImages = profile.artist.portfolio_images || [];
                  const validImages = portfolioImages.filter(img => {
                    if (!img || typeof img !== 'string') return false;
                    const trimmed = img.trim();
                    return trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
                  });
                  
                  if (validImages.length > 0) {
                    return (
                      <View style={styles.portfolioScrollContainer}>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.portfolioScrollContent}
                          snapToAlignment="start"
                          decelerationRate="fast"
                        >
                          {validImages.map((imageUrl, index) => (
                            <TouchableOpacity
                              key={`portfolio-${imageUrl}-${index}`}
                              style={styles.portfolioScrollItem}
                              activeOpacity={0.85}
                              disabled={portfolioTouchBlocked}
                              onPress={() => {
                                if (!portfolioTouchBlocked) {
                                  setSelectedPortfolioIndex(index);
                                }
                              }}
                              onLongPress={() => {
                                if (isOwnProfile && !portfolioTouchBlocked) {
                                  handleDeletePortfolioImageByUrl(imageUrl);
                                }
                              }}
                            >
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.portfolioScrollImage}
                                contentFit="cover"
                                transition={200}
                                onError={(error) => {
                                  console.warn('Portfolio image failed to load:', imageUrl, error);
                                }}
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    );
                  } else {
                    return (
                      <TouchableOpacity
                        style={styles.addPortfolioButton}
                        onPress={() => router.push('/profile/edit-portfolio')}
                      >
                        <Ionicons name="add-circle-outline" size={48} color={colors.primary} />
                        <Text style={styles.addPortfolioText}>Add Portfolio Images</Text>
                        <Text style={styles.addPortfolioSubtext}>Showcase your best work to attract clients</Text>
                      </TouchableOpacity>
                    );
                  }
                })()}
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
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="star-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Reviews</Text>
                  {activeReviewTab === 'received' && reviewsReceived.length > 0 && (
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingBadgeText}>
                        {profile.artist.average_rating?.toFixed(1) || '0.0'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Tabs */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  style={[styles.tab, activeReviewTab === 'received' && styles.tabActive]}
                  onPress={() => setActiveReviewTab('received')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="star" 
                    size={18} 
                    color={activeReviewTab === 'received' ? colors.primary : colors.text.secondary} 
                  />
                  <Text style={[styles.tabText, activeReviewTab === 'received' && styles.tabTextActive]}>
                    Received ({reviewsReceived.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeReviewTab === 'given' && styles.tabActive]}
                  onPress={() => setActiveReviewTab('given')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="star-outline" 
                    size={18} 
                    color={activeReviewTab === 'given' ? colors.primary : colors.text.secondary} 
                  />
                  <Text style={[styles.tabText, activeReviewTab === 'given' && styles.tabTextActive]}>
                    Given ({reviewsGiven.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Content */}
              {reviewsLoading ? (
                <View style={styles.reviewsLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : activeReviewTab === 'received' ? (
                reviewsReceived.length > 0 ? (
                  <View style={styles.reviewsList}>
                    {reviewsReceived.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        isArtist={isOwnProfile}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyReviewsContainer}>
                    <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
                    <Text style={styles.emptyReviewsText}>No reviews received yet</Text>
                    <Text style={styles.emptyReviewsSubtext}>
                      Clients will leave reviews after completing commissions
                    </Text>
                  </View>
                )
              ) : (
                reviewsGiven.length > 0 ? (
                  <View style={styles.reviewsList}>
                    {reviewsGiven.map((review) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        isArtist={isOwnProfile}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyReviewsContainer}>
                    <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
                    <Text style={styles.emptyReviewsText}>No reviews given yet</Text>
                    <Text style={styles.emptyReviewsSubtext}>
                      Leave reviews for clients after completing commissions
                    </Text>
                  </View>
                )
              )}
            </View>
          </>
        )}

        {/* Client Stats Section (only for non-artists) */}
        {!isArtist && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="stats-chart" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Overview</Text>
              </View>
            </View>
            <View style={styles.clientStatsCard}>
              <TouchableOpacity
                style={styles.clientStatItem}
                onPress={() => router.push('/(tabs)/boards')}
                activeOpacity={0.7}
              >
                <View style={styles.clientStatIconContainer}>
                  <Ionicons name="albums" size={22} color={colors.primary} />
                </View>
                <View style={styles.clientStatContent}>
                  <Text style={styles.clientStatValue}>{profile?.boards?.length || 0}</Text>
                  <Text style={styles.clientStatLabel}>Collections</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
              </TouchableOpacity>

              <View style={styles.clientStatDivider} />

              <TouchableOpacity
                style={styles.clientStatItem}
                onPress={() => router.push('/(tabs)/explore')}
                activeOpacity={0.7}
              >
                <View style={styles.clientStatIconContainer}>
                  <Ionicons name="briefcase" size={22} color={colors.primary} />
                </View>
                <View style={styles.clientStatContent}>
                  <Text style={styles.clientStatValue}>
                    {profile?.commissions_count || 0}
                  </Text>
                  <Text style={styles.clientStatLabel}>Commissions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
              </TouchableOpacity>

              <View style={styles.clientStatDivider} />

              <View style={styles.clientStatItem}>
                <View style={styles.clientStatIconContainer}>
                  <Ionicons name="calendar" size={22} color={colors.text.secondary} />
                </View>
                <View style={styles.clientStatContent}>
                  <Text style={styles.clientStatValue}>
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric'
                        })
                      : 'N/A'}
                  </Text>
                  <Text style={styles.clientStatLabel}>Member Since</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions (for artists) */}
        {isArtist && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Artist Tools</Text>
            <View style={styles.quickActionsList}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/commission-packages')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="cube-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Commission Packages</Text>
                  <Text style={styles.quickActionSubtitle}>Manage packages & custom forms</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/artist-settings')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="settings-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Commission Settings</Text>
                  <Text style={styles.quickActionSubtitle}>Queue, terms & preferences</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/verification')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Get Verified</Text>
                  <Text style={styles.quickActionSubtitle}>Build trust with verification badges</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/(tabs)/explore')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>My Commissions</Text>
                  <Text style={styles.quickActionSubtitle}>View commission requests</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>
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
                onPress={() => router.push('/(tabs)/explore')}
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

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => setShowStyleQuiz(true)}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Style Preference Quiz</Text>
                  <Text style={styles.quickActionSubtitle}>Get personalized artist matches</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push('/commission-requests')}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.quickActionText}>
                  <Text style={styles.quickActionTitle}>Commission Requests</Text>
                  <Text style={styles.quickActionSubtitle}>Post requests & get bids</Text>
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
          </>
        )}
      </ScrollView>

      {/* Portfolio Modal Viewer */}
      {(() => {
        const portfolioImages = profile?.artist?.portfolio_images || [];
        const validImages = portfolioImages.filter(img => {
          if (!img || typeof img !== 'string') return false;
          const trimmed = img.trim();
          return trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'));
        });
        
        return (
          <Modal
            visible={selectedPortfolioIndex !== null && validImages.length > 0}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={() => {
              portfolioModalClosingRef.current = true;
              setSelectedPortfolioIndex(null);
              setPortfolioTouchBlocked(true);
              setTimeout(() => {
                setPortfolioTouchBlocked(false);
                portfolioModalClosingRef.current = false;
              }, 1500);
            }}
          >
            <View style={styles.portfolioModalContainer}>
              <StatusBar barStyle="light-content" />
              
              {/* Header */}
              <View style={styles.portfolioModalHeader}>
                <TouchableOpacity
                  style={styles.portfolioModalCloseButton}
                  onPress={() => {
                    portfolioModalClosingRef.current = true;
                    setSelectedPortfolioIndex(null);
                    setPortfolioTouchBlocked(true);
                    setTimeout(() => {
                      setPortfolioTouchBlocked(false);
                      portfolioModalClosingRef.current = false;
                    }, 1500);
                  }}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.portfolioModalCounter}>
                  {selectedPortfolioIndex !== null ? `${selectedPortfolioIndex + 1} / ${validImages.length}` : ''}
                </Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Image Viewer */}
              <FlatList
                data={validImages}
                renderItem={({ item }) => (
                  <View style={styles.portfolioModalImageContainer}>
                    <Image
                      source={{ uri: item }}
                      style={styles.portfolioModalImage}
                      contentFit="contain"
                    />
                  </View>
                )}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={selectedPortfolioIndex !== null && selectedPortfolioIndex < validImages.length ? selectedPortfolioIndex : 0}
                getItemLayout={(data, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                onMomentumScrollEnd={(event) => {
                  // Prevent reopening modal if it's being closed
                  if (portfolioModalClosingRef.current) {
                    return;
                  }
                  const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
                  if (newIndex >= 0 && newIndex < validImages.length && selectedPortfolioIndex !== null) {
                    setSelectedPortfolioIndex(newIndex);
                  }
                }}
              />
            </View>
          </Modal>
        );
      })()}

      {/* Custom Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>{deleteAction?.title}</Text>
            <Text style={styles.deleteModalMessage}>{deleteAction?.message}</Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonCancel]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteModalButton, styles.deleteModalButtonDelete]}
                onPress={() => deleteAction?.onConfirm?.()}
              >
                <Text style={styles.deleteModalButtonTextDelete}>
                  {deleteAction?.buttonText || 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Style Preference Quiz Modal */}
      {!isArtist && (
        <StylePreferenceQuiz
          visible={showStyleQuiz}
          onClose={() => setShowStyleQuiz(false)}
          token={token}
          onComplete={() => {
            // Quiz completed, user can now use smart matches
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContent: {
    paddingVertical: spacing.xl * 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
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
    backgroundColor: colors.surface, // Show background while loading
  },
  avatarPlaceholder: {
    width: IS_SMALL_SCREEN ? 90 : 100,
    height: IS_SMALL_SCREEN ? 90 : 100,
    borderRadius: IS_SMALL_SCREEN ? 45 : 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  username: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
  },
  verifiedBadge: {
    marginTop: 2,
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
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border + '80',
  },
  editButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  section: {
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 17 : 20,
    fontWeight: '700',
  },
  editIconButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
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
  portfolioScrollContainer: {
    marginLeft: -(IS_SMALL_SCREEN ? spacing.md : spacing.lg),
    marginRight: -(IS_SMALL_SCREEN ? spacing.md : spacing.lg),
  },
  portfolioScrollContent: {
    paddingLeft: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingRight: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    gap: spacing.sm,
  },
  portfolioScrollItem: {
    width: width * 0.75,
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  portfolioScrollImage: {
    width: '100%',
    height: '100%',
  },
  commissionCard: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    padding: 0,
    gap: spacing.md,
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  statusBadgeOpen: {
    borderColor: colors.success,
    backgroundColor: colors.success + '20',
  },
  statusBadgeLimited: {
    borderColor: colors.status.warning,
    backgroundColor: colors.status.warning + '20',
  },
  statusBadgeClosed: {
    borderColor: colors.error,
    backgroundColor: colors.error + '20',
  },
  statusBadgeText: {
    ...typography.bodyBold,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
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
  infoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoGridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.xs : spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '80',
  },
  infoIconContainer: {
    width: IS_SMALL_SCREEN ? 36 : 44,
    height: IS_SMALL_SCREEN ? 36 : 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoGridLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  infoGridValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  infoLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  statusOpenText: {
    color: colors.status.success,
    fontWeight: '600',
  },
  statusLimitedText: {
    color: colors.status.warning,
    fontWeight: '600',
  },
  statusClosedText: {
    color: colors.status.error,
    fontWeight: '600',
  },
  specialtiesContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '80',
    gap: spacing.sm,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  tagText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
    fontWeight: '500',
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
  ratingBadge: {
    backgroundColor: colors.status.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  ratingBadgeText: {
    ...typography.caption,
    color: colors.status.warning,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  tabActive: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary + '40',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  reviewsList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  reviewsLoadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyReviewsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyReviewsText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyReviewsSubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  boardsList: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  boardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '80',
    ...shadows.small,
  },
  boardName: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
  },
  seeAllText: {
    ...typography.body,
    color: colors.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  addPortfolioButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addPortfolioText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.sm,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  addPortfolioSubtext: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
    textAlign: 'center',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '80',
    ...shadows.small,
  },
  statIconContainer: {
    width: IS_SMALL_SCREEN ? 40 : 48,
    height: IS_SMALL_SCREEN ? 40 : 48,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  clientStatsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '80',
    overflow: 'hidden',
    ...shadows.small,
  },
  clientStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  clientStatDivider: {
    height: 0,
    backgroundColor: 'transparent',
    marginHorizontal: spacing.lg,
  },
  clientStatIconContainer: {
    width: IS_SMALL_SCREEN ? 48 : 52,
    height: IS_SMALL_SCREEN ? 48 : 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientStatContent: {
    flex: 1,
  },
  clientStatValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  clientStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
  },
  quickActionsList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border + '80',
  },
  quickActionIcon: {
    width: IS_SMALL_SCREEN ? 40 : 44,
    height: IS_SMALL_SCREEN ? 40 : 44,
    borderRadius: borderRadius.full,
    backgroundColor: `${colors.primary}20`,
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
  // Portfolio Modal Styles
  portfolioModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  portfolioModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Constants.statusBarHeight + spacing.sm,
    paddingBottom: spacing.sm,
  },
  portfolioModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portfolioModalCounter: {
    ...typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  portfolioModalImageContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portfolioModalImage: {
    width: width,
    height: '80%',
  },
  // Custom Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  deleteModalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '80',
  },
  deleteModalHeader: {
    marginBottom: spacing.md,
  },
  deleteModalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: 20,
    fontWeight: '700',
  },
  deleteModalMessage: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  deleteModalButtonCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '80',
  },
  deleteModalButtonDelete: {
    backgroundColor: colors.error,
  },
  deleteModalButtonTextCancel: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  deleteModalButtonTextDelete: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
});