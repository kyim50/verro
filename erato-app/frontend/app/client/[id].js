import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import Toast from 'react-native-toast-message';
import ReviewCard from '../../components/ReviewCard';

const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [reviewsGiven, setReviewsGiven] = useState([]);
  const [reviewsReceived, setReviewsReceived] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [activeReviewTab, setActiveReviewTab] = useState('received'); // 'received' or 'given'
  const isOwnProfile = user?.id === id;

  useEffect(() => {
    setLoading(true);
    loadClientProfile();
    loadClientCommissions();
    loadClientReviewsGiven();
    loadClientReviewsReceived();
  }, [id]);

  const loadClientProfile = async () => {
    try {
      setLoading(true);

      // Fetch client user data
      const response = await axios.get(
        `${API_URL}/users/${id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      setClient(response.data.user || response.data);

      // Fetch client stats if available
      try {
        const statsResponse = await axios.get(
          `${API_URL}/users/${id}/stats`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        setStats(statsResponse.data);
      } catch (err) {
        console.log('Stats not available');
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load client profile',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientCommissions = async () => {
    if (!token) return;
    try {
      const response = await axios.get(
        `${API_URL}/commissions?client_id=${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const commissionsData = response.data.commissions || [];
      console.log('Commissions data:', commissionsData[0]); // Debug log
      setCommissions(commissionsData);
    } catch (error) {
      console.log('Error loading commissions:', error);
    }
  };

  const loadClientReviewsGiven = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/reviews/user/${id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setReviewsGiven(response.data.reviews || []);
    } catch (error) {
      console.log('Error loading reviews given:', error);
      setReviewsGiven([]);
    }
  };

  const loadClientReviewsReceived = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/reviews/client/${id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setReviewsReceived(response.data.reviews || []);
    } catch (error) {
      console.log('Error loading reviews received:', error);
      setReviewsReceived([]);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/(tabs)/home');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Client Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push('/(tabs)/home');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Client Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.errorTitle}>Client Not Found</Text>
          <Text style={styles.errorText}>This client profile could not be loaded.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadClientProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const completedCommissions = commissions.filter(c => c.status === 'completed').length;
  const inProgressCommissions = commissions.filter(c => c.status === 'in_progress').length;
  const pendingCommissions = commissions.filter(c => c.status === 'pending').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(tabs)/home');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Client Header - Pinterest-inspired clean layout */}
        <View style={styles.clientHeader}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: client.avatar_url || DEFAULT_AVATAR }}
              style={styles.avatar}
              contentFit="cover"
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.clientName} numberOfLines={1}>
                {client.full_name || client.username}
              </Text>
            </View>
            <View style={styles.clientUsernameRow}>
              <Text style={styles.clientUsername} numberOfLines={1}>
                @{client.username}
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={(client.is_verified || client.verified) ? colors.error : colors.text.disabled}
                style={styles.verifiedBadge}
              />
            </View>
          </View>

          {/* Bio */}
          {client.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {client.bio}
            </Text>
          )}

          {/* Stats - Pinterest-style Cards */}
          <View style={styles.pinterestStatsGrid}>
            <View style={styles.pinterestStatCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.pinterestStatValue}>{commissions.length || 0}</Text>
              <Text style={styles.pinterestStatLabel}>Total</Text>
            </View>
            <View style={styles.pinterestStatCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.pinterestStatValue}>{inProgressCommissions + pendingCommissions}</Text>
              <Text style={styles.pinterestStatLabel}>Active</Text>
            </View>
          </View>

          {/* Member Since */}
          <View style={styles.memberSinceContainer}>
            <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.memberSinceText}>
              Member since {new Date(client.created_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
              })}
            </Text>
          </View>
        </View>

        {/* Rating Section */}
        {reviewsReceived.length > 0 && (
          <View style={styles.section}>
            <View style={styles.ratingCard}>
              <View style={styles.ratingIconContainer}>
                <Ionicons name="star" size={32} color={colors.primary} />
              </View>
              <Text style={styles.ratingValue}>
                {reviewsReceived.length > 0
                  ? (reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / reviewsReceived.length).toFixed(1)
                  : '0.0'}
              </Text>
              <Text style={styles.ratingLabel}>
                {reviewsReceived.length} {reviewsReceived.length === 1 ? 'Review' : 'Reviews'}
              </Text>
            </View>
          </View>
        )}

        {/* Reviews Section with Tabs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="star-outline" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Reviews</Text>
              {activeReviewTab === 'received' && reviewsReceived.length > 0 && (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText}>
                    {(reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / reviewsReceived.length).toFixed(1)}
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

          {/* Tab Content - Horizontal Carousel */}
          {activeReviewTab === 'received' ? (
            reviewsReceived.length > 0 ? (
              <FlatList
                data={reviewsReceived}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewsCarouselContent}
                snapToInterval={width * 0.85 + spacing.md}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={styles.reviewCarouselItem}>
                    <ReviewCard
                      review={item}
                      isArtist={false}
                    />
                  </View>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
            ) : (
              <View style={styles.emptyReviewsContainer}>
                <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
                <Text style={styles.emptyReviewsText}>No reviews received yet</Text>
                <Text style={styles.emptyReviewsSubtext}>
                  Artists will leave reviews after completing commissions
                </Text>
              </View>
            )
          ) : (
            reviewsGiven.length > 0 ? (
              <FlatList
                data={reviewsGiven}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.reviewsCarouselContent}
                snapToInterval={width * 0.85 + spacing.md}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <View style={styles.reviewCarouselItem}>
                    <ReviewCard
                      review={item}
                      isArtist={false}
                    />
                  </View>
                )}
                keyExtractor={(item) => item.id.toString()}
              />
            ) : (
              <View style={styles.emptyReviewsContainer}>
                <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
                <Text style={styles.emptyReviewsText}>No reviews given yet</Text>
                <Text style={styles.emptyReviewsSubtext}>
                  Leave reviews for artists after completing commissions
                </Text>
              </View>
            )
          )}
        </View>

        {/* Commission History */}
        {commissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Commission History</Text>
              </View>
            </View>
            <View style={styles.commissionList}>
              {commissions.slice(0, 10).map((commission, index) => (
                <TouchableOpacity
                  key={commission.id}
                  style={[
                    styles.commissionItem,
                    index < commissions.slice(0, 10).length - 1 && styles.commissionItemBorder
                  ]}
                  onPress={() => {
                    // Navigate to artist profile
                    if (commission.artist_id) {
                      router.push(`/artist/${commission.artist_id}`);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* Artist Avatar */}
                  <Image
                    source={{
                      uri: commission.artists?.users?.avatar_url ||
                           commission.artists?.avatar_url ||
                           commission.artist?.users?.avatar_url ||
                           commission.artist?.avatar_url ||
                           DEFAULT_AVATAR
                    }}
                    style={styles.commissionArtistAvatar}
                    contentFit="cover"
                  />

                  {/* Commission Info */}
                  <View style={styles.commissionInfo}>
                    <Text style={styles.commissionArtistName} numberOfLines={1}>
                      @{commission.artists?.users?.username ||
                         commission.artists?.username ||
                         commission.artist?.users?.username ||
                         commission.artist?.username ||
                         commission.artist_username ||
                         'Artist'}
                    </Text>
                    <Text style={styles.commissionTitle} numberOfLines={1}>
                      {commission.title || commission.description || 'Commission Request'}
                    </Text>
                    <Text style={styles.commissionDate}>
                      {new Date(commission.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(commission.status) + '20' }
                  ]}>
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(commission.status) }
                      ]}
                      numberOfLines={1}
                    >
                      {formatStatus(commission.status)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return colors.status.success;
    case 'in_progress': return colors.status.info;
    case 'accepted': return colors.status.info;
    case 'pending': return colors.status.warning;
    case 'declined': return colors.status.error;
    case 'cancelled': return colors.status.error;
    default: return colors.text.secondary;
  }
};

const formatStatus = (status) => {
  return status.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Constants.statusBarHeight + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  clientHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 110 : 120,
    height: IS_SMALL_SCREEN ? 110 : 120,
    borderRadius: IS_SMALL_SCREEN ? 55 : 60,
    borderWidth: 4,
    borderColor: colors.background,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clientName: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 26 : 30,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  clientUsernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  clientUsername: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '400',
  },
  verifiedBadge: {
    marginLeft: 0,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    minHeight: 80,
    minWidth: 80,
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    fontWeight: '700', // Pinterest-style (was 800)
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.gray600,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
    fontWeight: '500', // Pinterest-style
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  verifiedBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: colors.border + '60',
  },
  memberSinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  memberSinceText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
    letterSpacing: -0.3,
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
  commissionList: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  commissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  commissionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15',
  },
  commissionArtistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  commissionInfo: {
    flex: 1,
  },
  commissionArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '700',
    marginBottom: spacing.xs / 4,
  },
  commissionTitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '400',
    marginBottom: spacing.xs / 2,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    flexShrink: 0,
    minWidth: 85,
  },
  statusText: {
    ...typography.caption,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  reviewsList: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  reviewsCarouselContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  reviewCarouselItem: {
    width: width * 0.85,
    marginRight: spacing.md,
  },
  emptyReviewsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 1.5,
  },
  emptyReviewsText: {
    ...typography.h3,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  emptyReviewsSubtext: {
    ...typography.body,
    color: colors.text.disabled,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingVertical: 0,
    marginBottom: spacing.md,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'transparent',
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  // Pinterest-style Stats Grid
  pinterestStatsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  pinterestStatCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinterestStatValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
    marginTop: spacing.xs / 2,
  },
  pinterestStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Rating Card - Pinterest-style
  ratingCard: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  ratingIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ratingValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 36 : 40,
    fontWeight: '700',
    letterSpacing: -1,
  },
  ratingLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    fontWeight: '500',
  },
});
