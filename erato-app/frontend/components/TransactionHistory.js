import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

const TRANSACTION_TYPES = {
  deposit: { label: 'Deposit', icon: 'wallet', color: colors.primary },
  final: { label: 'Final Payment', icon: 'card', color: colors.primary },
  full: { label: 'Full Payment', icon: 'cash', color: colors.primary },
  milestone: { label: 'Milestone', icon: 'layers', color: colors.primary },
  tip: { label: 'Tip', icon: 'heart', color: colors.status.error },
  refund: { label: 'Refund', icon: 'arrow-undo', color: colors.status.error },
};

const STATUS_COLORS = {
  succeeded: colors.status.success,
  pending: colors.status.warning,
  failed: colors.status.error,
  refunded: colors.status.error,
};

export default function TransactionHistory({ commissionId }) {
  const { token } = useAuthStore();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [commissionId]);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/payments/commission/${commissionId}/transactions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTransactions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load transaction history',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTransaction = ({ item }) => {
    const typeConfig = TRANSACTION_TYPES[item.transaction_type] || TRANSACTION_TYPES.full;
    const statusColor = STATUS_COLORS[item.status] || colors.text.secondary;

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={[styles.iconContainer, { backgroundColor: typeConfig.color + '20' }]}>
            <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionType}>{typeConfig.label}</Text>
            <Text style={styles.transactionDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[
              styles.amountText,
              item.transaction_type === 'refund' && styles.amountTextRefund
            ]}>
              {item.transaction_type === 'refund' ? '-' : '+'}${item.amount.toFixed(2)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {item.description && (
          <Text style={styles.transactionDescription}>{item.description}</Text>
        )}

        {item.platform_fee > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Platform Fee (10%)</Text>
            <Text style={styles.feeValue}>-${item.platform_fee.toFixed(2)}</Text>
          </View>
        )}

        {item.artist_payout && item.transaction_type !== 'tip' && (
          <View style={styles.payoutRow}>
            <Text style={styles.payoutLabel}>Artist Payout</Text>
            <Text style={styles.payoutValue}>${item.artist_payout.toFixed(2)}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={48} color={colors.text.disabled} />
        <Text style={styles.emptyText}>No transactions yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction History</Text>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  transactionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  transactionDate: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  amountTextRefund: {
    color: colors.status.error,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  transactionDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  feeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  feeValue: {
    ...typography.caption,
    color: colors.status.error,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  payoutLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  payoutValue: {
    ...typography.caption,
    color: colors.status.success,
  },
});

















