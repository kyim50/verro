import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function QueueDashboard() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queueData, setQueueData] = useState(null);
  const [autoPromote, setAutoPromote] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  const loadQueueData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await axios.get(
        `${API_URL}/commissions/queue/artist/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setQueueData(response.data);
      setAutoPromote(response.data.settings?.auto_promote || false);
    } catch (error) {
      console.error('Error loading queue:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load queue',
        text2: error.response?.data?.error || 'Please try again',
      });
    }
  }, [user?.id, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQueueData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadQueueData().then(() => setLoading(false));
    }, [loadQueueData])
  );

  const toggleAutoPromote = async (value) => {
    setUpdatingSettings(true);
    try {
      await axios.patch(
        `${API_URL}/commissions/queue/settings`,
        { auto_promote_waitlist: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAutoPromote(value);
      Toast.show({
        type: 'success',
        text1: 'Settings Updated',
        text2: value ? 'Waitlist auto-promotion enabled' : 'Auto-promotion disabled',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.response?.data?.error || 'Please try again',
      });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const renderCommissionCard = (commission, showPosition = true) => (
    <TouchableOpacity
      key={commission.id}
      style={styles.commissionCard}
      onPress={() => router.push(`/commission/${commission.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.clientInfo}>
          {commission.client?.avatar_url ? (
            <Image
              source={{ uri: commission.client.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color={colors.text.tertiary} />
            </View>
          )}
          <View style={styles.clientDetails}>
            <Text style={styles.clientName}>
              {commission.client?.full_name || commission.client?.username || 'Client'}
            </Text>
            {showPosition && commission.queue_position && (
              <View style={styles.positionBadge}>
                <Ionicons name="list" size={12} color={colors.primary} />
                <Text style={styles.positionText}>Position #{commission.queue_position}</Text>
              </View>
            )}
          </View>
        </View>
        {commission.final_price && (
          <Text style={styles.price}>${commission.final_price}</Text>
        )}
      </View>

      {commission.current_milestone && (
        <View style={styles.milestoneInfo}>
          <View style={styles.milestoneIndicator} />
          <Text style={styles.milestoneText}>
            {commission.current_milestone.title} ({commission.current_milestone.payment_status})
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{commission.status.replace('_', ' ')}</Text>
        </View>
        <Text style={styles.date}>
          Accepted {new Date(commission.accepted_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!queueData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Commission Queue</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Unable to load queue data</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { active_queue, pending_requests, waitlist, settings, stats } = queueData;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Commission Queue</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_waitlist}</Text>
            <Text style={styles.statLabel}>Waitlist</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {stats.available_slots}
            </Text>
            <Text style={styles.statLabel}>Slots Open</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Queue Settings</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-promote from Waitlist</Text>
              <Text style={styles.settingDescription}>
                Automatically move waitlisted commissions to active when slots open
              </Text>
            </View>
            <Switch
              value={autoPromote}
              onValueChange={toggleAutoPromote}
              disabled={updatingSettings}
              trackColor={{ false: colors.border, true: colors.primary + '40' }}
              thumbColor={autoPromote ? colors.primary : colors.background.tertiary}
            />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingSubtext}>
              Max Queue Slots: {settings.max_slots} • Waitlist: {settings.allow_waitlist ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Active Queue */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Queue ({active_queue.length})</Text>
            <View style={styles.queueIndicator}>
              <View style={styles.queueDot} />
              <Text style={styles.queueText}>In Progress</Text>
            </View>
          </View>
          {active_queue.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No active commissions</Text>
              <Text style={styles.emptySubtext}>Accept pending requests to fill your queue</Text>
            </View>
          ) : (
            active_queue.map(commission => renderCommissionCard(commission, true))
          )}
        </View>

        {/* Pending Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Requests ({pending_requests.length})</Text>
            <View style={[styles.queueIndicator, { backgroundColor: colors.warning + '20' }]}>
              <View style={[styles.queueDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.queueText, { color: colors.warning }]}>Awaiting Response</Text>
            </View>
          </View>
          {pending_requests.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="mail-open-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          ) : (
            pending_requests.map(commission => renderCommissionCard(commission, false))
          )}
        </View>

        {/* Waitlist */}
        {waitlist.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Waitlist ({waitlist.length})</Text>
              <View style={[styles.queueIndicator, { backgroundColor: colors.text.tertiary + '20' }]}>
                <View style={[styles.queueDot, { backgroundColor: colors.text.tertiary }]} />
                <Text style={[styles.queueText, { color: colors.text.tertiary }]}>Waiting</Text>
              </View>
            </View>
            {waitlist.map(commission => renderCommissionCard(commission, false))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
  section: {
    marginBottom: spacing.lg,
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
  queueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  queueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.xs,
  },
  queueText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  settingSubtext: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
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
  clientInfo: {
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
  clientDetails: {
    flex: 1,
  },
  clientName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  price: {
    ...typography.h3,
    color: colors.success,
  },
  milestoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  milestoneIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  milestoneText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  date: {
    ...typography.caption,
    color: colors.text.tertiary,
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
  emptySubtext: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
