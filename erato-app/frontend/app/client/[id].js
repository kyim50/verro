import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import axios from 'axios';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [client, setClient] = useState(null);
  const [commissions, setCommissions] = useState([]);
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
    } catch (err) {
      console.error('Error fetching client profile:', err);
      setError(err.response?.data?.error || 'Failed to load client profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!token) {
      Alert.alert('Login Required', 'Please log in to message this user');
      return;
    }

    try {
      // Create or get existing conversation
      const response = await axios.post(
        `${API_URL}/messages/conversations`,
        { participant_ids: [id] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Navigate to the conversation
      router.push(`/messages/${response.data.conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error.response?.status === 403) {
        Alert.alert(
          'Commission Required',
          error.response?.data?.error || 'You must have an accepted commission with this user before you can message them.'
        );
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to start conversation. Please try again.');
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
          <Image
            source={{ uri: client.avatar_url || 'https://via.placeholder.com/120' }}
            style={styles.avatar}
            contentFit="cover"
          />
          <Text style={styles.clientName}>
            {client.full_name || client.username}
          </Text>
          <Text style={styles.clientUsername}>@{client.username}</Text>

          {client.bio && (
            <Text style={styles.bio}>{client.bio}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.statValue}>
                {client.created_at ? new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
            {user?.artists && commissions.length > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
                  <Text style={styles.statValue}>{commissions.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-done-outline" size={20} color="#4CAF50" />
                  <Text style={styles.statValue}>
                    {commissions.filter(c => c.status === 'completed').length}
                  </Text>
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
                  ${commissions.filter(c => c.price && (c.status === 'completed' || c.status === 'in_progress' || c.status === 'accepted')).reduce((sum, c) => sum + parseFloat(c.price || 0), 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.financialDivider} />
              <View style={styles.financialItem}>
                <Text style={styles.financialLabel}>Pending</Text>
                <Text style={styles.financialValue}>
                  ${commissions.filter(c => c.price && (c.status === 'pending' || c.status === 'in_progress')).reduce((sum, c) => sum + parseFloat(c.price || 0), 0).toFixed(2)}
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
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
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
  },
  clientName: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  clientUsername: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
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
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 11,
  },
  actionButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  messageButton: {
    backgroundColor: colors.primary,
  },
  messageButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
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
  },
  financialCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
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
    fontSize: 24,
    fontWeight: '700',
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 16,
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