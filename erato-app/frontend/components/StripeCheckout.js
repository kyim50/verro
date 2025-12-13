import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

/**
 * Stripe Checkout Component
 * 
 * NOTE: This component requires @stripe/stripe-react-native to be installed:
 * npm install @stripe/stripe-react-native
 * 
 * For now, this is a placeholder that shows the payment flow.
 * To fully implement:
 * 1. Install @stripe/stripe-react-native
 * 2. Initialize Stripe with publishable key
 * 3. Use CardField component for card input
 * 4. Use confirmPayment with clientSecret
 */
export default function StripeCheckout({
  visible,
  onClose,
  commissionId,
  amount,
  paymentType,
  onSuccess,
  onError,
}) {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  useEffect(() => {
    if (visible && commissionId && amount) {
      createPaymentIntent();
    }
  }, [visible, commissionId, amount]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/payments/create-intent`,
        {
          commissionId,
          paymentType: paymentType || 'full',
          amount,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setClientSecret(response.data.data.clientSecret);
      setPaymentIntentId(response.data.data.paymentIntentId);
    } catch (error) {
      console.error('Error creating payment intent:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to initialize payment',
      });
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    // TODO: Implement actual Stripe payment
    // This requires @stripe/stripe-react-native
    // 
    // Example implementation:
    // const { error, paymentIntent } = await confirmPayment(clientSecret, {
    //   paymentMethodType: 'Card',
    // });
    // 
    // if (error) {
    //   onError(error);
    // } else {
    //   onSuccess(paymentIntent);
    // }

    // For now, show a message that Stripe SDK needs to be installed
    Toast.show({
      type: 'info',
      text1: 'Stripe SDK Required',
      text2: 'Please install @stripe/stripe-react-native to enable payments',
    });
  };

  if (!visible) return null;

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
            <Text style={styles.modalTitle}>Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Initializing payment...</Text>
              </View>
            ) : (
              <>
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>Amount</Text>
                  <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.status.info} />
                  <Text style={styles.infoText}>
                    Stripe payment integration requires @stripe/stripe-react-native package.
                    Install it to enable card payments.
                  </Text>
                </View>

                {/* Placeholder for CardField */}
                <View style={styles.cardFieldPlaceholder}>
                  <Ionicons name="card-outline" size={48} color={colors.text.disabled} />
                  <Text style={styles.placeholderText}>Card Input Field</Text>
                  <Text style={styles.placeholderSubtext}>
                    Install @stripe/stripe-react-native to enable
                  </Text>
                </View>

                <View style={styles.securityNote}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.status.success} />
                  <Text style={styles.securityText}>
                    Your payment is secure and encrypted
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payButton, loading && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading || !clientSecret}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={18} color={colors.text.primary} />
                  <Text style={styles.payButtonText}>Pay ${amount.toFixed(2)}</Text>
                </>
              )}
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  amountContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  amountValue: {
    ...typography.h1,
    color: colors.text.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.status.info + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  cardFieldPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  placeholderSubtext: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  securityText: {
    ...typography.caption,
    color: colors.text.secondary,
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
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});



