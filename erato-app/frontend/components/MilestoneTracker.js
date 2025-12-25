import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function MilestoneTracker({ commissionId, isClient = false, onPayMilestone }) {
  const { token } = useAuthStore();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMilestones();
  }, [commissionId]);

  const fetchMilestones = async () => {
    try {
      console.log('🔍 Fetching milestones for commission:', commissionId);
      console.log('📍 API URL:', `${API_URL}/milestones/commission/${commissionId}`);
      console.log('🔑 Token exists:', !!token);

      const response = await axios.get(
        `${API_URL}/milestones/commission/${commissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('✅ Milestones fetched:', response.data.milestones?.length || 0);
      setMilestones(response.data.milestones || []);
    } catch (error) {
      console.error('❌ Error fetching milestones:', error);
      console.error('Response:', error.response?.data);
      Toast.show({
        type: 'error',
        text1: 'Failed to load milestones',
        text2: error.response?.data?.error || 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (milestones.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="layers-outline" size={48} color={colors.text.disabled} />
        <Text style={styles.emptyText}>No milestones set</Text>
        <Text style={styles.emptySubtext}>
          The artist will create milestones for this commission
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Milestones</Text>
      <ScrollView style={styles.milestonesList}>
        {milestones.map((milestone, index) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            index={index}
            isClient={isClient}
            onPay={onPayMilestone}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function MilestoneCard({ milestone, index, isClient, onPay }) {
  const isPaid = milestone.payment_status === 'paid';
  const isUnpaid = milestone.payment_status === 'unpaid';
  const isLocked = milestone.is_locked;
  const canPay = isClient && isUnpaid && !isLocked;
  const hasRevisionFee = milestone.revision_fee_added > 0;
  const hasProgressUpdate = milestone.progress_update && milestone.progress_update.length > 0;

  // Get status icon and color
  const getStatusIcon = () => {
    if (isPaid) return { name: 'checkmark-circle', color: colors.status.success };
    if (isLocked) return { name: 'lock-closed', color: colors.text.disabled };
    if (isUnpaid) return { name: 'time-outline', color: colors.status.warning };
    return { name: 'ellipse-outline', color: colors.text.disabled };
  };

  const statusIcon = getStatusIcon();

  return (
    <View style={[styles.milestoneCard, isPaid && styles.milestoneCardPaid, isLocked && styles.milestoneCardLocked]}>
      <View style={styles.milestoneHeader}>
        <View style={styles.milestoneNumber}>
          <Text style={styles.milestoneNumberText}>{milestone.milestone_number}</Text>
        </View>
        <View style={styles.milestoneInfo}>
          <Text style={styles.milestoneTitle}>{milestone.title}</Text>
          {milestone.description && (
            <Text style={styles.milestoneDescription} numberOfLines={2}>
              {milestone.description}
            </Text>
          )}
          {isLocked && (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color={colors.text.disabled} />
              <Text style={styles.lockedText}>Locked - pay previous milestones first</Text>
            </View>
          )}
        </View>
        <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />
      </View>

      <View style={styles.milestoneFooter}>
        <View>
          <Text style={styles.milestoneAmount}>${parseFloat(milestone.amount).toFixed(2)}</Text>
          <Text style={styles.milestonePercentage}>
            {parseFloat(milestone.percentage).toFixed(1)}% of total
          </Text>
          {hasRevisionFee && (
            <Text style={styles.revisionFeeText}>
              +${parseFloat(milestone.revision_fee_added).toFixed(2)} revision fee
            </Text>
          )}
        </View>
        {canPay && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => onPay && onPay(milestone)}
          >
            <Ionicons name="card-outline" size={16} color="#fff" />
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
        )}
        {isPaid && milestone.paid_at && (
          <View style={styles.paidInfo}>
            <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
            <Text style={styles.paidText}>
              Paid {new Date(milestone.paid_at).toLocaleDateString()}
            </Text>
          </View>
        )}
        {isLocked && !isPaid && (
          <View style={styles.lockedInfo}>
            <Ionicons name="lock-closed" size={16} color={colors.text.disabled} />
            <Text style={styles.lockedInfoText}>Locked</Text>
          </View>
        )}
      </View>

      {hasProgressUpdate && (
        <View style={styles.progressUpdateContainer}>
          <Ionicons name="images-outline" size={14} color={colors.primary} />
          <Text style={styles.progressUpdateText}>
            Work in progress - {milestone.progress_update[0].approval_status === 'approved' ? 'Approved' : 'Pending approval'}
          </Text>
        </View>
      )}

      {milestone.due_date && (
        <View style={styles.dueDateContainer}>
          <Ionicons name="calendar-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.dueDateText}>
            Due: {new Date(milestone.due_date).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  milestonesList: {
    maxHeight: 400,
  },
  milestoneCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  milestoneCardPaid: {
    borderColor: colors.status.success,
    backgroundColor: colors.status.success + '10',
  },
  milestoneCardLocked: {
    opacity: 0.6,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  milestoneNumber: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneNumberText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  milestoneDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  milestoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  milestoneAmount: {
    ...typography.h3,
    color: colors.text.primary,
  },
  milestonePercentage: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  payButtonText: {
    ...typography.bodyBold,
    color: '#fff',
    fontSize: 12,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paidText: {
    ...typography.caption,
    color: colors.status.success,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dueDateText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.text.disabled + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  lockedText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 11,
  },
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockedInfoText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  revisionFeeText: {
    ...typography.caption,
    color: colors.status.warning,
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressUpdateText: {
    ...typography.caption,
    color: colors.primary,
  },
});

















