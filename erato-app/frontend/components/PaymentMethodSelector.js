import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

/**
 * PaymentMethodSelector - Modal to choose between PayPal and Card payment
 * Shows BEFORE proceeding to checkout
 */
export default function PaymentMethodSelector({
  visible,
  onClose,
  onSelectPayPal,
  onSelectCard,
  amount,
}) {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const paymentMethods = [
    {
      id: 'paypal',
      name: 'PayPal',
      description: 'Pay with your PayPal account',
      icon: 'logo-paypal',
      color: '#0070ba',
    },
    {
      id: 'card',
      name: 'Credit or Debit Card',
      description: 'Pay with any major credit or debit card',
      icon: 'card-outline',
      color: colors.primary,
    },
  ];

  const handleSelect = (methodId) => {
    setSelectedMethod(methodId);
  };

  const handleProceed = () => {
    if (!selectedMethod) return;

    if (selectedMethod === 'paypal') {
      onSelectPayPal();
    } else if (selectedMethod === 'card') {
      onSelectCard();
    }

    // Reset selection for next time
    setSelectedMethod(null);
  };

  const handleClose = () => {
    setSelectedMethod(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Payment Method</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {amount && (
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
              </View>
            )}

            <Text style={styles.description}>
              Select how you'd like to pay
            </Text>

            <View style={styles.methodsContainer}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodCard,
                    selectedMethod === method.id && styles.methodCardSelected,
                  ]}
                  onPress={() => handleSelect(method.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.methodHeader}>
                    <View
                      style={[
                        styles.methodIconContainer,
                        selectedMethod === method.id && {
                          backgroundColor: method.color + '20',
                        },
                      ]}
                    >
                      <Ionicons
                        name={method.icon}
                        size={28}
                        color={selectedMethod === method.id ? method.color : colors.text.secondary}
                      />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text
                        style={[
                          styles.methodName,
                          selectedMethod === method.id && styles.methodNameSelected,
                        ]}
                      >
                        {method.name}
                      </Text>
                      <Text style={styles.methodDescription}>
                        {method.description}
                      </Text>
                    </View>
                    {selectedMethod === method.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color={method.color}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.proceedButton,
                !selectedMethod && styles.proceedButtonDisabled,
              ]}
              onPress={handleProceed}
              disabled={!selectedMethod}
            >
              <Text style={styles.proceedButtonText}>Continue</Text>
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
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  amountContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: colors.text.disabled,
    marginBottom: spacing.xs,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 32,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    fontSize: 15,
  },
  methodsContainer: {
    gap: spacing.md,
  },
  methodCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  methodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: 16,
    fontWeight: '600',
  },
  methodNameSelected: {
    color: colors.text.primary,
  },
  methodDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  proceedButton: {
    flex: 2,
    paddingVertical: spacing.md + 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  proceedButtonDisabled: {
    opacity: 0.5,
  },
  proceedButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
