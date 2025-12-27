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
import { CardField, useStripe } from '@stripe/stripe-react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Secure Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color={colors.text.disabled} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
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
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.status.success} />
                  <Text style={styles.securityText}>
                    Secured by Stripe encryption
                  </Text>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color={colors.primary} />
                  <Text style={styles.infoText}>
                    Your payment information is encrypted and secure. Verro does not store your card details.
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
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 24,
  },
  modalBody: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
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
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  amountLabel: {
    ...typography.caption,
    color: colors.text.disabled,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 42,
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
    marginVertical: spacing.sm,
  },
  cardFieldStyle: {
    backgroundColor: colors.surface,
    textColor: colors.text.primary,
    placeholderColor: colors.text.disabled,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
    fontSize: 14,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  securityText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 13,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.lg,
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
  payButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
