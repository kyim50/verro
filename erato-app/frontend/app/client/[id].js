import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
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
      setCommissions(response.data.commissions || []);
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
        {/* Client Header */}
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
              {(client.is_verified || client.verified) && (
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color={colors.error}
                  style={styles.verifiedBadge}
                />
              )}
            </View>
          </View>

          {/* Bio */}
          {client.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {client.bio}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{commissions.length || 0}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{completedCommissions}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
              <Text style={styles.statValue}>{inProgressCommissions + pendingCommissions}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            {reviewsReceived.length > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="star" size={18} color={colors.status.warning} />
                  <Text style={styles.statValue}>
                    {reviewsReceived.length > 0
                      ? (reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / reviewsReceived.length).toFixed(1)
                      : '0.0'}
                  </Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </>
            )}
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

          {/* Tab Content */}
          {activeReviewTab === 'received' ? (
            reviewsReceived.length > 0 ? (
              <View style={styles.reviewsList}>
                {reviewsReceived.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isArtist={false}
                  />
                ))}
              </View>
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
              <View style={styles.reviewsList}>
                {reviewsGiven.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isArtist={false}
                  />
                ))}
              </View>
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
                    // Navigate to commission details if needed
                    router.push(`/(tabs)/explore?commissionId=${commission.id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.commissionInfo}>
                    <Text style={styles.commissionTitle} numberOfLines={1}>
                      {commission.title || 'Commission Request'}
                    </Text>
                    <Text style={styles.commissionDate}>
                      {new Date(commission.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(commission.status) + '20' }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: getStatusColor(commission.status) }
                    ]}>
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingTop: IS_SMALL_SCREEN ? Constants.statusBarHeight + spacing.sm : Constants.statusBarHeight + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
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
    paddingTop: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  clientHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  avatarContainer: {
    marginBottom: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 100 : 120,
    height: IS_SMALL_SCREEN ? 100 : 120,
    borderRadius: IS_SMALL_SCREEN ? 50 : 60,
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.medium,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  clientName: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    fontWeight: '700',
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
  },
  verifiedBadge: {
    marginLeft: spacing.xs / 2,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    lineHeight: 22,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    opacity: 0.5,
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
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '60',
    ...shadows.small,
  },
  commissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  commissionItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  commissionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  commissionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    marginBottom: spacing.xs / 2,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    fontWeight: '600',
  },
  reviewsList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
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
});
