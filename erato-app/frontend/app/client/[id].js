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
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Constants.statusBarHeight || 44;

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [client, setClient] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [boards, setBoards] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchClientProfile();
  }, [id]);

  const fetchClientProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch client profile
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const userResponse = await axios.get(`${API_URL}/users/${id}`, { headers });
      setClient(userResponse.data);

      // Fetch client's commission history (if you're an artist viewing their profile)
      if (user?.artists && token) {
        try {
          const commissionsResponse = await axios.get(
            `${API_URL}/commissions?clientId=${id}&artistId=${user.artists.id}`,
            { headers }
          );
          setCommissions(commissionsResponse.data || []);
        } catch (commError) {
          console.error('Error fetching commissions:', commError);
          setCommissions([]);
        }
      }

      // Fetch client's boards
      try {
        const boardsResponse = await axios.get(`${API_URL}/users/${id}/boards`, { headers });
        setBoards(Array.isArray(boardsResponse.data) ? boardsResponse.data : boardsResponse.data.boards || []);
      } catch (boardError) {
        console.error('Error fetching boards:', boardError);
        setBoards([]);
      }

      // Fetch reviews about this client (from artists)
      try {
        const reviewsResponse = await axios.get(`${API_URL}/reviews/client/${id}`, { headers });
        const reviewsData = reviewsResponse.data.reviews || [];
        setReviews(reviewsData);
      } catch (reviewError) {
        console.error('Error fetching reviews:', reviewError);
        setReviews([]);
      }
    } catch (err) {
      console.error('Error fetching client profile:', err);
      setError(err.response?.data?.error || 'Failed to load client profile');
    } finally {
      setIsLoading(false);
    }
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;


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
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Client Header */}
        <View style={styles.clientHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: client.avatar_url || DEFAULT_AVATAR }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.avatarBadge}>
              <Ionicons name="person" size={16} color={colors.primary} />
            </View>
          </View>
          
          <View style={styles.nameSection}>
            <Text style={styles.clientName}>
              {client.full_name || client.username}
            </Text>
            <Text style={styles.clientUsername}>@{client.username}</Text>
            {averageRating && (
              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= Math.round(parseFloat(averageRating)) ? "star" : "star-outline"}
                      size={18}
                      color={colors.status.warning}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {averageRating} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </Text>
              </View>
            )}
          </View>

          {client.bio && (
            <View style={styles.bioContainer}>
              <Text style={styles.bio}>{client.bio}</Text>
            </View>
          )}

          {/* Quick Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>
                {client.created_at ? new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="albums-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{boards.length}</Text>
              <Text style={styles.statLabel}>Boards</Text>
            </View>
            
            {user?.artists && commissions.length > 0 ? (
              <>
                <View style={styles.statCard}>
                  <View style={styles.statIconContainer}>
                    <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.statValue}>{commissions.length}</Text>
                  <Text style={styles.statLabel}>Projects</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: colors.status.success + '20' }]}>
                    <Ionicons name="checkmark-done-outline" size={24} color={colors.status.success} />
                  </View>
                  <Text style={styles.statValue}>
                    {commissions.filter(c => c.status === 'completed').length}
                  </Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </>
            ) : (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="star-outline" size={24} color={colors.status.warning} />
                </View>
                <Text style={styles.statValue}>New</Text>
                <Text style={styles.statLabel}>Client</Text>
              </View>
            )}
          </View>

        </View>

        {/* Financial Summary (if viewing as artist) */}
        {user?.artists && commissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="cash-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Financial Summary</Text>
              </View>
            </View>

            <View style={styles.financialCard}>
              <View style={styles.financialItem}>
                <View style={styles.financialHeader}>
                  <Ionicons name="trending-up-outline" size={18} color={colors.status.success} />
                  <Text style={styles.financialLabel}>Total Revenue</Text>
                </View>
                <Text style={styles.financialValue}>
                  ${commissions.filter(c => c.price && (c.status === 'completed' || c.status === 'in_progress' || c.status === 'accepted')).reduce((sum, c) => sum + parseFloat(c.price || 0), 0).toFixed(2)}
                </Text>
                <Text style={styles.financialSubtext}>
                  {commissions.filter(c => c.status === 'completed' && c.price).length} completed project{commissions.filter(c => c.status === 'completed' && c.price).length !== 1 ? 's' : ''}
                </Text>
              </View>
              
              <View style={styles.financialDivider} />
              
              <View style={styles.financialItem}>
                <View style={styles.financialHeader}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.status.warning} />
                  <Text style={styles.financialLabel}>Pending</Text>
                </View>
                <Text style={[styles.financialValue, { color: colors.status.warning }]}>
                  ${commissions.filter(c => c.price && (c.status === 'pending' || c.status === 'in_progress')).reduce((sum, c) => sum + parseFloat(c.price || 0), 0).toFixed(2)}
                </Text>
                <Text style={styles.financialSubtext}>
                  {commissions.filter(c => (c.status === 'pending' || c.status === 'in_progress') && c.price).length} active project{commissions.filter(c => (c.status === 'pending' || c.status === 'in_progress') && c.price).length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Commission History (if viewing as artist) */}
        {user?.artists && commissions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="list-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Commission History</Text>
              </View>
              <Text style={styles.sectionSubtitle}>{commissions.length} {commissions.length === 1 ? 'project' : 'projects'}</Text>
            </View>

            {commissions.map((commission) => {
              let statusColor;
              let statusIcon;

              switch (commission.status) {
                case 'pending':
                  statusColor = colors.status.warning;
                  statusIcon = 'time-outline';
                  break;
                case 'accepted':
                  statusColor = colors.status.info;
                  statusIcon = 'checkmark-circle-outline';
                  break;
                case 'in_progress':
                  statusColor = colors.primary;
                  statusIcon = 'brush-outline';
                  break;
                case 'completed':
                  statusColor = colors.status.success;
                  statusIcon = 'checkmark-done-outline';
                  break;
                case 'cancelled':
                  statusColor = colors.status.error;
                  statusIcon = 'close-circle-outline';
                  break;
                default:
                  statusColor = colors.text.secondary;
                  statusIcon = 'help-circle-outline';
              }

              return (
                <TouchableOpacity
                  key={commission.id}
                  style={styles.commissionCard}
                  onPress={() => {
                    // Navigate to commission detail or conversation
                    router.push(`/messages/${id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.commissionCardHeader}>
                    <View style={styles.commissionCardTop}>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Ionicons name={statusIcon} size={16} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {commission.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </Text>
                      </View>
                      {commission.price && (
                        <Text style={styles.commissionPrice}>${parseFloat(commission.price).toFixed(2)}</Text>
                      )}
                    </View>
                    
                    {commission.details && (
                      <Text style={styles.commissionDetails} numberOfLines={2}>
                        {commission.details}
                      </Text>
                    )}
                    
                    <View style={styles.commissionCardFooter}>
                      {commission.created_at && (
                        <View style={styles.commissionDateContainer}>
                          <Ionicons name="calendar-outline" size={14} color={colors.text.secondary} />
                          <Text style={styles.commissionDate}>
                            {new Date(commission.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Boards Section */}
        {boards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <View style={styles.sectionIconContainer}>
                  <Ionicons name="albums-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Boards</Text>
              </View>
              <Text style={styles.sectionSubtitle}>{boards.length} {boards.length === 1 ? 'board' : 'boards'}</Text>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.boardsScroll}
            >
              {boards.slice(0, 5).map((board) => (
                <TouchableOpacity
                  key={board.id}
                  style={styles.boardCard}
                  onPress={() => router.push(`/board/${board.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.boardIconContainer}>
                    <Ionicons 
                      name={board.is_public ? "albums-outline" : "lock-closed-outline"} 
                      size={32} 
                      color={colors.primary} 
                    />
                  </View>
                  <Text style={styles.boardName} numberOfLines={1}>
                    {board.name}
                  </Text>
                  {board.artwork_count > 0 && (
                    <Text style={styles.boardCount}>
                      {board.artwork_count} {board.artwork_count === 1 ? 'artwork' : 'artworks'}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty State for Artists */}
        {user?.artists && commissions.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="briefcase-outline" size={64} color={colors.text.disabled} />
            </View>
            <Text style={styles.emptyTitle}>No Commission History</Text>
            <Text style={styles.emptyText}>You haven't worked with this client yet</Text>
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="star-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>Reviews</Text>
            </View>
            {reviews.length > 0 && (
              <View style={styles.reviewSummary}>
                <Text style={styles.reviewAverage}>
                  {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                </Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name="star"
                      size={14}
                      color={star <= Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) ? colors.status.warning : colors.text.disabled}
                    />
                  ))}
                </View>
                <Text style={styles.sectionSubtitle}>({reviews.length})</Text>
              </View>
            )}
          </View>

          {reviews.length > 0 ? (
            reviews.map((review) => {
              const artistUser = review.artist || review.artists?.users;
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewHeaderLeft}>
                      {artistUser && (
                        <>
                          <Image
                            source={{ uri: artistUser.avatar_url || DEFAULT_AVATAR }}
                            style={styles.reviewAvatar}
                            contentFit="cover"
                          />
                          <View style={styles.reviewInfo}>
                            <Text style={styles.reviewArtistName}>
                              {artistUser.full_name || artistUser.username || 'Artist'}
                            </Text>
                            {review.commission && (
                              <Text style={styles.reviewCommission} numberOfLines={1}>
                                {review.commission.title || 'Commission'}
                              </Text>
                            )}
                          </View>
                        </>
                      )}
                    </View>
                    <View style={styles.reviewRating}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"}
                          size={16}
                          color={colors.status.warning}
                        />
                      ))}
                    </View>
                  </View>
                  
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                  
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
              );
            })
          ) : (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={48} color={colors.text.disabled} />
              <Text style={styles.emptyReviewsText}>No reviews yet</Text>
              <Text style={styles.emptyReviewsSubtext}>
                No artists have reviewed this client yet
              </Text>
            </View>
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
    paddingTop: STATUS_BAR_HEIGHT + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
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
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.medium,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  nameSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  clientName: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  clientUsername: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  bioContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
  actionButtons: {
    width: '100%',
  },
  actionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.small,
  },
  messageButton: {
    backgroundColor: colors.primary,
  },
  messageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 20,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  financialCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  financialItem: {
    flex: 1,
    gap: spacing.xs,
  },
  financialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  financialDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  financialLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  financialValue: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  financialSubtext: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 12,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.small,
  },
  commissionCardHeader: {
    padding: spacing.md,
  },
  commissionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  commissionPrice: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.md,
    lineHeight: 20,
    fontSize: 14,
  },
  commissionCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commissionDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl * 2,
    marginTop: spacing.xl,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontSize: 15,
  },
  boardsScroll: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  boardCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginRight: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  boardIconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  boardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  boardCount: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewAverage: {
    ...typography.h3,
    color: colors.status.warning,
    fontSize: 20,
    fontWeight: '700',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    marginBottom: 2,
  },
  reviewCommission: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 20,
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyReviewsText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyReviewsSubtext: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    fontSize: 13,
  },
});
