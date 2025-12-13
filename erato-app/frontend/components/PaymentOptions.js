import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const PAYMENT_TYPES = [
  {
    id: 'full',
    name: 'Full Payment',
    description: 'Pay the full amount upfront',
    icon: 'card-outline',
  },
  {
    id: 'deposit',
    name: 'Deposit + Final',
    description: 'Pay 50% now, 50% on completion',
    icon: 'wallet-outline',
  },
  {
    id: 'milestone',
    name: 'Milestone Payments',
    description: 'Pay in stages as work progresses',
    icon: 'layers-outline',
  },
];

export default function PaymentOptions({
  visible,
  onClose,
  commission,
  onSelectPaymentType,
  onProceed,
}) {
  const [selectedType, setSelectedType] = useState(null);
  const [depositPercentage, setDepositPercentage] = useState(50);

  const handleSelect = (type) => {
    setSelectedType(type);
    if (onSelectPaymentType) {
      onSelectPaymentType(type);
    }
  };

  const handleProceed = () => {
    if (!selectedType) {
      return;
    }

    const paymentData = {
      paymentType: selectedType,
      depositPercentage: selectedType === 'deposit' ? depositPercentage : null,
    };

    if (onProceed) {
      onProceed(paymentData);
    }
  };

  const calculateAmounts = () => {
    if (!commission || !selectedType) return null;

    const total = commission.final_price || commission.total_price || 0;

    if (selectedType === 'full') {
      return { total, deposit: 0, final: 0 };
    }

    if (selectedType === 'deposit') {
      const deposit = total * (depositPercentage / 100);
      const final = total - deposit;
      return { total, deposit, final };
    }

    return { total, deposit: 0, final: 0 };
  };

  const amounts = calculateAmounts();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.description}>
              Choose how you'd like to pay for this commission
            </Text>

            <View style={styles.optionsContainer}>
              {PAYMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.optionCard,
                    selectedType === type.id && styles.optionCardSelected,
                  ]}
                  onPress={() => handleSelect(type.id)}
                >
                  <View style={styles.optionHeader}>
                    <View style={[
                      styles.optionIconContainer,
                      selectedType === type.id && { backgroundColor: colors.primary + '20' }
                    ]}>
                      <Ionicons
                        name={type.icon}
                        size={24}
                        color={selectedType === type.id ? colors.primary : colors.text.secondary}
                      />
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={[
                        styles.optionName,
                        selectedType === type.id && styles.optionNameSelected
                      ]}>
                        {type.name}
                      </Text>
                      <Text style={styles.optionDescription}>
                        {type.description}
                      </Text>
                    </View>
                    {selectedType === type.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Deposit Percentage Selector */}
            {selectedType === 'deposit' && (
              <View style={styles.depositSection}>
                <Text style={styles.sectionTitle}>Deposit Percentage</Text>
                <View style={styles.percentageSelector}>
                  {[25, 50, 75].map((percent) => (
                    <TouchableOpacity
                      key={percent}
                      style={[
                        styles.percentageButton,
                        depositPercentage === percent && styles.percentageButtonSelected,
                      ]}
                      onPress={() => setDepositPercentage(percent)}
                    >
                      <Text style={[
                        styles.percentageText,
                        depositPercentage === percent && styles.percentageTextSelected
                      ]}>
                        {percent}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.customPercentageInput}
                  value={depositPercentage.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num >= 10 && num <= 90) {
                      setDepositPercentage(num);
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="Custom %"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>
            )}

            {/* Amount Breakdown */}
            {amounts && selectedType && (
              <View style={styles.amountBreakdown}>
                <Text style={styles.breakdownTitle}>Payment Breakdown</Text>
                {selectedType === 'full' && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Total Amount</Text>
                    <Text style={styles.breakdownValue}>${amounts.total.toFixed(2)}</Text>
                  </View>
                )}
                {selectedType === 'deposit' && (
                  <>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Deposit ({depositPercentage}%)</Text>
                      <Text style={styles.breakdownValue}>${amounts.deposit.toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Final Payment</Text>
                      <Text style={styles.breakdownValue}>${amounts.final.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.breakdownRow, styles.breakdownTotal]}>
                      <Text style={styles.breakdownTotalLabel}>Total</Text>
                      <Text style={styles.breakdownTotalValue}>${amounts.total.toFixed(2)}</Text>
                    </View>
                  </>
                )}
                {selectedType === 'milestone' && (
                  <Text style={styles.milestoneNote}>
                    Milestone amounts will be set by the artist
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.proceedButton, !selectedType && styles.proceedButtonDisabled]}
              onPress={handleProceed}
              disabled={!selectedType}
            >
              <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
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
  modalBody: {
    padding: spacing.md,
    maxHeight: '70%',
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  optionsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionNameSelected: {
    color: colors.primary,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  depositSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  percentageSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  percentageButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  percentageText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  percentageTextSelected: {
    color: colors.primary,
  },
  customPercentageInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  amountBreakdown: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breakdownTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  breakdownLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  breakdownValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  breakdownTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownTotalLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  breakdownTotalValue: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 18,
  },
  milestoneNote: {
    ...typography.caption,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  proceedButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  proceedButtonDisabled: {
    opacity: 0.5,
  },
  proceedButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});



