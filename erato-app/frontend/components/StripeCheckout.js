import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Conditional Stripe import with fallback for Expo Go
let CardField, useStripe;
let isStripeMocked = false;
try {
  const stripeModule = require('@stripe/stripe-react-native');
  CardField = stripeModule.CardField;
  useStripe = stripeModule.useStripe;
} catch (error) {
  console.warn('⚠️ Stripe native module not available (Expo Go). Using mock components for development.');
  isStripeMocked = true;
  // Mock CardField component
  CardField = ({ onCardChange }) => {
    useEffect(() => {
      // Simulate card completion for testing
      const timer = setTimeout(() => onCardChange?.({ complete: true }), 1000);
      return () => clearTimeout(timer);
    }, [onCardChange]);
    return (
      <View style={{ backgroundColor: colors.surface, height: 50, borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ color: colors.text.disabled }}>
          Stripe unavailable in Expo Go - Test mode active
        </Text>
      </View>
    );
  };
  // Mock useStripe hook
  useStripe = () => ({
    confirmPayment: async () => {
      console.log('🧪 Mock Stripe: confirmPayment called');
      // Simulate successful payment
      return {
        paymentIntent: {
          id: 'mock_pi_' + Date.now().toString(36),
          status: 'Succeeded'
        }
      };
    }
  });
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

/**
 * Stripe Checkout Component
 * Uses Stripe's native card input and payment processing
 */
export default function StripeCheckout({
  visible,
  onClose,
  commissionId,
  amount,
  paymentType,
  milestoneId,
  onSuccess,
  onError,
}) {
  const { token } = useAuthStore();
  const { confirmPayment } = useStripe();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  useEffect(() => {
    if (visible && commissionId && amount) {
      createPaymentIntent();
    } else {
      // Reset state when modal closes
      setClientSecret(null);
      setPaymentIntentId(null);
      setCardComplete(false);
    }
  }, [visible, commissionId, amount]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      const requestBody = {
        commissionId,
        paymentType: paymentType || 'full',
        amount,
      };

      // Include milestoneId if this is a milestone payment
      if (milestoneId) {
        requestBody.milestoneId = milestoneId;
      }

      const response = await axios.post(
        `${API_URL}/payments/stripe/create-payment-intent`,
        requestBody,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { clientSecret: secret, paymentIntentId: intentId } = response.data.data;
        setClientSecret(secret);
        setPaymentIntentId(intentId);
      } else {
        throw new Error(response.data.error || 'Failed to create payment intent');
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || error.message || 'Failed to initialize payment',
      });
      if (onError) onError(error);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!cardComplete || !clientSecret) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please complete your card details',
      });
      return;
    }

    try {
      setLoading(true);

      // Confirm the payment with Stripe
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent.status === 'Succeeded') {
        // Payment succeeded, confirm with backend
        await confirmPaymentWithBackend(paymentIntent.id);
      } else {
        throw new Error('Payment was not completed');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to process payment',
      });
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPaymentWithBackend = async (intentId) => {
    try {
      const response = await axios.post(
        `${API_URL}/payments/stripe/confirm-payment`,
        { paymentIntentId: intentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Successful',
          text2: `Payment of $${amount.toFixed(2)} has been processed`,
        });
        if (onSuccess) onSuccess(response.data.data);
        onClose();
      } else {
        throw new Error(response.data.error || 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Secure Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={26} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Amount to Pay</Text>
              <Text style={styles.amountValue}>${amount?.toFixed(2) || '0.00'}</Text>
            </View>

            {loading && !clientSecret ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Setting up payment...</Text>
              </View>
            ) : (
              <>
                <View style={styles.cardFieldContainer}>
                  <Text style={styles.cardFieldLabel}>Card Details</Text>
                  <CardField
                    postalCodeEnabled={true}
                    placeholders={{
                      number: '4242 4242 4242 4242',
                    }}
                    cardStyle={styles.cardFieldStyle}
                    style={styles.cardField}
                    onCardChange={(cardDetails) => {
                      setCardComplete(cardDetails.complete);
                    }}
                  />
                </View>

                <View style={styles.securityNote}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.status.success} />
                  <Text style={styles.securityText}>
                    Secured by Stripe encryption
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color={colors.primary} />
                  <Text style={styles.infoText}>
                    Your payment is encrypted and secure. We don't store your card details.
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.payButton,
                (!cardComplete || loading) && styles.payButtonDisabled,
              ]}
              onPress={handlePayment}
              disabled={!cardComplete || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color="#FFFFFF" />
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
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 22,
    flex: 1,
  },
  closeButton: {
    padding: spacing.xs,
    marginRight: -spacing.xs,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    fontSize: 15,
  },
  amountContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: colors.text.disabled,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 32,
  },
  cardFieldContainer: {
    marginBottom: spacing.lg,
  },
  cardFieldLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  cardField: {
    height: 50,
    marginVertical: spacing.xs,
  },
  cardFieldStyle: {
    backgroundColor: colors.surface,
    textColor: colors.text.primary,
    placeholderColor: colors.text.disabled,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    fontSize: 15,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: 4,
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
    fontSize: 12,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  securityText: {
    ...typography.caption,
    color: colors.status.success,
    fontSize: 13,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md + 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  payButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
