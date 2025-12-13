import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const ESCROW_STATUSES = {
  held: {
    label: 'Funds Held in Escrow',
    description: 'Payment is secure and will be released when you approve the work',
    icon: 'lock-closed',
    color: colors.status.warning,
  },
  released: {
    label: 'Funds Released',
    description: 'Payment has been released to the artist',
    icon: 'checkmark-circle',
    color: colors.status.success,
  },
  refunded: {
    label: 'Refunded',
    description: 'Payment has been refunded',
    icon: 'arrow-undo-circle',
    color: colors.status.error,
  },
  pending: {
    label: 'Pending Release',
    description: 'Waiting for commission completion',
    icon: 'time-outline',
    color: colors.text.secondary,
  },
};

export default function EscrowStatus({ commission, onRelease, isClient = false }) {
  if (!commission || !commission.escrow_status) return null;

  const status = ESCROW_STATUSES[commission.escrow_status] || ESCROW_STATUSES.pending;
  const canRelease = isClient && 
    commission.escrow_status === 'held' && 
    commission.status === 'completed';

  return (
    <View style={styles.container}>
      <View style={[styles.statusCard, { borderColor: status.color }]}>
        <View style={styles.statusHeader}>
          <View style={[styles.iconContainer, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon} size={24} color={status.color} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>{status.label}</Text>
            <Text style={styles.statusDescription}>{status.description}</Text>
          </View>
        </View>

        {commission.escrow_amount && (
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Escrow Amount</Text>
            <Text style={styles.amountValue}>${commission.escrow_amount.toFixed(2)}</Text>
          </View>
        )}

        {canRelease && (
          <TouchableOpacity
            style={styles.releaseButton}
            onPress={onRelease}
          >
            <Ionicons name="unlock-outline" size={20} color={colors.text.primary} />
            <Text style={styles.releaseButtonText}>Release Funds</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statusDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  amountLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  amountValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  releaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  releaseButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});




