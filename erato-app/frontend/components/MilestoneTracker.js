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
      const response = await axios.get(
        `${API_URL}/payments/milestones/${commissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMilestones(response.data.data || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
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
  const canPay = isClient && isUnpaid;

  return (
    <View style={[styles.milestoneCard, isPaid && styles.milestoneCardPaid]}>
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
        </View>
        {isPaid && (
          <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
        )}
      </View>

      <View style={styles.milestoneFooter}>
        <View>
          <Text style={styles.milestoneAmount}>${milestone.amount.toFixed(2)}</Text>
          <Text style={styles.milestonePercentage}>
            {milestone.percentage}% of total
          </Text>
        </View>
        {canPay && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => onPay && onPay(milestone)}
          >
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
      </View>

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
  },
  payButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
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
});














