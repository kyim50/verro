import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { showAlert } from '../components/StyledAlert';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function MyCommissions() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commissionsData, setCommissionsData] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // active, pending, completed, cancelled
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [showStateHistory, setShowStateHistory] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadCommissions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await axios.get(
        `${API_URL}/commissions/history/client/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCommissionsData(response.data);
    } catch (error) {
      console.error('Error loading commissions:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load commissions',
        text2: error.response?.data?.error || 'Please try again',
      });
    }
  }, [user?.id, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCommissions();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadCommissions().then(() => setLoading(false));
    }, [loadCommissions])
  );

  const handleCancelCommission = async (commission) => {
    // Check if commission can be cancelled
    const response = await axios.get(
      `${API_URL}/commissions/${commission.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const fullCommission = response.data;

    // Get milestones to check cancellation eligibility
    if (fullCommission.status === 'in_progress') {
      try {
        const milestonesResponse = await axios.get(
          `${API_URL}/milestones/commission/${commission.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const milestones = milestonesResponse.data.milestones || [];
        if (milestones.length > 0) {
          const paidCount = milestones.filter(m => m.payment_status === 'paid').length;
          const totalCount = milestones.length;
          const completionPct = (paidCount / totalCount) * 100;

          if (completionPct > 50) {
            showAlert({
              title: 'Cannot Cancel',
              message: `This commission is ${completionPct.toFixed(0)}% complete (${paidCount}/${totalCount} milestones paid). Please contact the artist directly to discuss cancellation options.`,
              buttons: [
                {
                  text: 'Contact Artist',
                  onPress: () => router.push(`/messages/${fullCommission.conversation_id}`),
                },
                { text: 'OK', style: 'cancel' },
              ],
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error checking milestones:', error);
      }
    }

    // Confirm cancellation
    showAlert({
      title: 'Cancel Commission?',
      message: fullCommission.status === 'pending'
        ? 'The artist hasn\'t accepted yet. You can cancel without penalty.'
        : 'Are you sure you want to cancel this commission?',
      buttons: [
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => confirmCancellation(commission),
        },
        { text: 'No', style: 'cancel' },
      ],
    });
  };

  const confirmCancellation = async (commission) => {
    setCancelling(true);
    try {
      await axios.patch(
        `${API_URL}/commissions/${commission.id}/status`,
        {
          status: 'cancelled',
          cancellation_reason: 'Cancelled by client',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Commission Cancelled',
        text2: 'The commission has been cancelled successfully',
      });

      await loadCommissions();
    } catch (error) {
      console.error('Error cancelling commission:', error);

      if (error.response?.data?.details) {
        const details = error.response.data.details;
        showAlert({
          title: 'Cannot Cancel',
          message: `${error.response.data.error}\n\nCompletion: ${details.completionPercentage}%\nMilestones Paid: ${details.paidMilestones}/${details.totalMilestones}\n\n${details.message}`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Cancellation Failed',
          text2: error.response?.data?.error || 'Please try again',
        });
      }
    } finally {
      setCancelling(false);
    }
  };

  const renderStateHistory = (commission) => {
    if (!commission.state_history || commission.state_history.length === 0) {
      return null;
    }

    return (
      <Modal
        visible={showStateHistory && selectedCommission?.id === commission.id}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStateHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Commission History</Text>
              <TouchableOpacity onPress={() => setShowStateHistory(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.historyList}>
              {commission.state_history.map((entry, index) => (
                <View key={index} style={styles.historyEntry}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyContent}>
                    <Text style={styles.historyStatus}>
                      {entry.from_status || 'Created'} → {entry.to_status}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(entry.changed_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCommissionCard = (commission) => {
    const canCancel = commission.status === 'pending' || commission.status === 'in_progress';

    return (
      <TouchableOpacity
        key={commission.id}
        style={styles.commissionCard}
        onPress={() => router.push(`/commission/${commission.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.artistInfo}>
            {commission.artist?.avatar_url ? (
              <Image
                source={{ uri: commission.artist.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color={colors.text.tertiary} />
              </View>
            )}
            <View style={styles.artistDetails}>
              <Text style={styles.artistName}>
                {commission.artist?.full_name || commission.artist?.username || 'Artist'}
              </Text>
              {commission.queue_position && (
                <View style={styles.queueBadge}>
                  <Ionicons name="list" size={12} color={colors.primary} />
                  <Text style={styles.queueText}>Position #{commission.queue_position}</Text>
                </View>
              )}
            </View>
          </View>
          {commission.final_price && (
            <Text style={styles.price}>${commission.final_price}</Text>
          )}
        </View>

        <View style={styles.statusRow}>
          <View style={[
            styles.statusBadge,
            commission.status === 'completed' && styles.completedBadge,
            commission.status === 'cancelled' && styles.cancelledBadge,
            commission.status === 'pending' && styles.pendingBadge,
          ]}>
            <Text style={[
              styles.statusText,
              commission.status === 'completed' && styles.completedText,
              commission.status === 'cancelled' && styles.cancelledText,
              commission.status === 'pending' && styles.pendingText,
            ]}>
              {commission.status.replace('_', ' ')}
            </Text>
          </View>

          {commission.state_history && commission.state_history.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSelectedCommission(commission);
                setShowStateHistory(true);
              }}
              style={styles.historyButton}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.historyButtonText}>History</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.date}>
            Created {new Date(commission.created_at).toLocaleDateString()}
          </Text>
          {canCancel && (
            <TouchableOpacity
              onPress={() => handleCancelCommission(commission)}
              disabled={cancelling}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {commission.cancellation_reason && (
          <View style={styles.cancellationInfo}>
            <Ionicons name="information-circle" size={16} color={colors.error} />
            <Text style={styles.cancellationText}>
              Cancelled: {commission.cancellation_reason}
            </Text>
          </View>
        )}

        {renderStateHistory(commission)}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!commissionsData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>My Commissions</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No commissions yet</Text>
        </View>
      </View>
    );
  }

  const { grouped, stats } = commissionsData;
  const currentCommissions = grouped[activeTab] || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>My Commissions</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({grouped.active.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({grouped.pending.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({grouped.completed.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.activeTab]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.activeTabText]}>
            Cancelled ({grouped.cancelled.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {currentCommissions.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="folder-open-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No {activeTab} commissions</Text>
          </View>
        ) : (
          currentCommissions.map(renderCommissionCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  commissionCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  avatarPlaceholder: {
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistDetails: {
    flex: 1,
  },
  artistName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  price: {
    ...typography.h3,
    color: colors.success,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  completedBadge: {
    backgroundColor: colors.success + '20',
  },
  cancelledBadge: {
    backgroundColor: colors.error + '20',
  },
  pendingBadge: {
    backgroundColor: colors.warning + '20',
  },
  statusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  completedText: {
    color: colors.success,
  },
  cancelledText: {
    color: colors.error,
  },
  pendingText: {
    color: colors.warning,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  historyButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  cancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cancelButtonText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  cancellationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  cancellationText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  emptySection: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '70%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  historyList: {
    padding: spacing.md,
  },
  historyEntry: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  historyContent: {
    flex: 1,
  },
  historyStatus: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  historyDate: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
