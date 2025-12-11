import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [client, setClient] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClientProfile();
  }, [id]);

  const fetchClientProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Fetch client profile
      const userResponse = await axios.get(`${API_URL}/users/${id}`, { headers });
      setClient(userResponse.data);

      // Fetch client's commission history (if you're an artist viewing their profile)
      if (user?.artists && token) {
        try {
          const commissionsResponse = await axios.get(
            `${API_URL}/commissions?clientId=${id}&artistId=${user.artists.id}`,
            { headers }
          );
          setCommissions(commissionsResponse.data.commissions || []);
        } catch (commError) {
          console.error('Error fetching commissions:', commError);
          setCommissions([]);
        }
      }

      // Fetch client reviews
      try {
        const reviewsResponse = await axios.get(`${API_URL}/reviews/client/${id}`, { headers });
        setReviews(reviewsResponse.data.reviews || []);
        setAverageRating(parseFloat(reviewsResponse.data.averageRating) || 0);
        setTotalReviews(reviewsResponse.data.totalReviews || 0);
      } catch (reviewError) {
        console.error('Error fetching reviews:', reviewError);
        setReviews([]);
        setAverageRating(0);
        setTotalReviews(0);
      }
    } catch (err) {
      console.error('Error fetching client profile:', err);
      setError(err.response?.data?.error || 'Failed to load client profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!token) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to message this user',
        visibilityTime: 2000,
      });
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/messages/conversations`,
        { participant_ids: [id] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      router.push(`/messages/${response.data.conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error.response?.status === 403) {
        Toast.show({
          type: 'info',
          text1: 'Commission Required',
          text2: error.response?.data?.error || 'You must have an accepted commission with this user before you can message them.',
          visibilityTime: 4000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.response?.data?.error || 'Failed to start conversation. Please try again.',
          visibilityTime: 3000,
        });
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (error || !client) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'User not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchClientProfile}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwnProfile = user?.id === client.id;
  const completedCommissions = commissions.filter(c => c.status === 'completed');
  const totalSpent = commissions
    .filter(c => c.price && (c.status === 'completed' || c.status === 'in_progress' || c.status === 'accepted'))
    .reduce((sum, c) => sum + parseFloat(c.price || 0), 0);

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
              source={{ uri: client.avatar_url || 'https://via.placeholder.com/120' }}
              style={styles.avatar}
              contentFit="cover"
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameContainer}>
            <Text style={styles.clientName} numberOfLines={1}>
              {client.full_name || client.username}
            </Text>
            <Text style={styles.clientUsername} numberOfLines={1}>
              @{client.username}
            </Text>
          </View>

          {/* Rating (if available) */}
          {averageRating > 0 && (
            <View style={styles.ratingContainer}>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= Math.round(averageRating) ? "star" : "star-outline"}
                    size={16}
                    color={colors.status.warning}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>
                {averageRating.toFixed(1)} ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
              </Text>
            </View>
          )}

          {/* Bio */}
          {client.bio && (
            <Text style={styles.bio} numberOfLines={3}>
              {client.bio}
            </Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.statValue}>
                {client.created_at ? new Date(client.created_at).getFullYear() : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
            {user?.artists && commissions.length > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                  <Text style={styles.statValue}>{commissions.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-done-outline" size={18} color={colors.success} />
                  <Text style={styles.statValue}>{completedCommissions.length}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleMessage}
              >
                <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Financial Summary (if viewing as artist) */}
        {user?.artists && commissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="cash-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Financial Summary</Text>
              </View>
            </View>

            <View style={styles.financialCard}>
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Total Spent</Text>
                <Text style={styles.financialValue}>
                  ${totalSpent.toFixed(2)}
                </Text>
              </View>
              <View style={styles.financialDivider} />
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Pending</Text>
                <Text style={styles.financialValue}>
                  ${commissions
                    .filter(c => c.price && (c.status === 'pending' || c.status === 'in_progress'))
                    .reduce((sum, c) => sum + parseFloat(c.price || 0), 0)
                    .toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="star-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Reviews from Artists</Text>
              </View>
            </View>

            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAuthor}>
                    {review.artist?.avatar_url && (
                      <Image
                        source={{ uri: review.artist.avatar_url }}
                        style={styles.reviewAvatar}
                        contentFit="cover"
                      />
                    )}
                    <View style={styles.reviewAuthorInfo}>
                      <Text style={styles.reviewAuthorName}>
                        {review.artist?.full_name || review.artist?.username || 'Anonymous Artist'}
                      </Text>
                      <View style={styles.reviewRating}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= review.rating ? "star" : "star-outline"}
                            size={12}
                            color={colors.status.warning}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  {review.created_at && (
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  )}
                </View>

                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}

                {review.commission && (
                  <View style={styles.reviewCommission}>
                    <Ionicons name="briefcase-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.reviewCommissionText} numberOfLines={1}>
                      {review.commission.details || review.commission.client_note || 'Commission'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Commission History (if viewing as artist) */}
        {user?.artists && commissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Commission History</Text>
              </View>
            </View>

            {commissions.map((commission) => {
              let statusColor;
              let statusIcon;

              switch (commission.status) {
                case 'pending':
                  statusColor = colors.warning;
                  statusIcon = 'time-outline';
                  break;
                case 'accepted':
                  statusColor = colors.info;
                  statusIcon = 'checkmark-circle-outline';
                  break;
                case 'in_progress':
                  statusColor = colors.primary;
                  statusIcon = 'brush-outline';
                  break;
                case 'completed':
                  statusColor = colors.success;
                  statusIcon = 'checkmark-done-outline';
                  break;
                case 'cancelled':
                  statusColor = colors.error;
                  statusIcon = 'close-circle-outline';
                  break;
                default:
                  statusColor = colors.text.secondary;
                  statusIcon = 'help-circle-outline';
              }

              return (
                <View key={commission.id} style={styles.commissionCard}>
                  <View style={styles.commissionHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Ionicons name={statusIcon} size={14} color={statusColor} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {commission.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </View>
                    {commission.price && (
                      <Text style={styles.commissionPrice}>${commission.price}</Text>
                    )}
                  </View>

                  <Text style={styles.commissionDetails} numberOfLines={2}>
                    {commission.details}
                  </Text>

                  {commission.created_at && (
                    <Text style={styles.commissionDate}>
                      {new Date(commission.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State for Artists */}
        {user?.artists && commissions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Commission History</Text>
            <Text style={styles.emptyText}>You haven't worked with this client yet</Text>
          </View>
        )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '600',
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.error,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  retryText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  clientHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary,
    ...shadows.md,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    width: '100%',
  },
  clientName: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  clientUsername: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 3,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
  },
  actionButtons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  messageButton: {
    backgroundColor: colors.primary,
  },
  messageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
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
    fontWeight: '600',
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
  },
  financialCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  financialItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  financialDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  financialLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  financialValue: {
    ...typography.h2,
    color: colors.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 24,
    fontWeight: '700',
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewAuthorInfo: {
    flex: 1,
  },
  reviewAuthorName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    marginBottom: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  reviewComment: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  reviewCommission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewCommissionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  commissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  commissionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
