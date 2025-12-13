import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

/**
 * PayPal Checkout Component
 * Uses PayPal's hosted checkout flow via WebView
 */
export default function PayPalCheckout({
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
  const [approvalUrl, setApprovalUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    if (visible && commissionId && amount) {
      createPayPalOrder();
    } else {
      // Reset state when modal closes
      setApprovalUrl(null);
      setOrderId(null);
    }
  }, [visible, commissionId, amount]);

  const createPayPalOrder = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `${API_URL}/payments/create-order`,
        {
          commissionId,
          paymentType: paymentType || 'full',
          amount,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const { orderId: newOrderId, approvalUrl: newApprovalUrl } = response.data.data;
        setOrderId(newOrderId);
        setApprovalUrl(newApprovalUrl);
        // Open PayPal in browser
        if (newApprovalUrl) {
          handleOpenPayPal(newApprovalUrl, newOrderId);
        }
      } else {
        throw new Error(response.data.error || 'Failed to create payment order');
      }
    } catch (error) {
      console.error('Error creating PayPal order:', error);
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

  const handleOpenPayPal = async (url, orderIdToCheck) => {
    const urlToOpen = url || approvalUrl;
    const orderIdForCheck = orderIdToCheck || orderId;
    
    if (!urlToOpen) return;
    
    try {
      // Open PayPal in system browser using Linking
      const canOpen = await Linking.canOpenURL(urlToOpen);
      if (canOpen) {
        await Linking.openURL(urlToOpen);
        
        // After opening browser, set up a check for payment completion
        // We'll poll for payment status after a delay
        if (orderIdForCheck) {
          setTimeout(() => {
            checkPaymentStatus(orderIdForCheck);
          }, 3000); // Give user time to complete payment
        }
      } else {
        throw new Error('Cannot open PayPal URL');
      }
    } catch (error) {
      console.error('Error opening PayPal:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open PayPal. Please try again.',
        visibilityTime: 3000,
      });
    }
  };

  const checkPaymentStatus = async (orderIdToCheck) => {
    const idToCheck = orderIdToCheck || orderId;
    if (!idToCheck) return;
    
    try {
      // Try to capture the order (will fail if not approved)
      const response = await axios.post(
        `${API_URL}/payments/capture-order`,
        { orderId: idToCheck },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        handlePaymentSuccess(response.data.data);
      }
    } catch (error) {
      // Payment not completed yet or user cancelled
      console.log('Payment not completed:', error.message);
      handlePaymentCancel();
    }
  };

  const handlePaymentSuccess = async (data) => {
    try {
      setLoading(true);

      Toast.show({
        type: 'success',
        text1: 'Payment Successful',
        text2: `Payment of $${amount.toFixed(2)} has been processed`,
      });
      if (onSuccess) onSuccess(data || { orderId, status: 'completed' });
      onClose();
    } catch (error) {
      console.error('Error processing payment success:', error);
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentCancel = () => {
    Toast.show({
      type: 'info',
      text1: 'Payment Cancelled',
      text2: 'You cancelled the payment process',
    });
    onClose();
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
            <Text style={styles.modalTitle}>Pay with PayPal</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {approvalUrl ? 'Processing payment...' : 'Initializing payment...'}
              </Text>
            </View>
          ) : approvalUrl ? (
            <ScrollView style={styles.modalBody}>
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Amount</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                  Click the button below to complete your payment with PayPal. You will be redirected to PayPal's secure checkout page.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.payPalButton}
                onPress={handleOpenPayPal}
              >
                <Ionicons name="logo-paypal" size={24} color={colors.text.primary} />
                <Text style={styles.payPalButtonText}>Continue to PayPal</Text>
              </TouchableOpacity>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark" size={16} color={colors.status.success} />
                <Text style={styles.securityText}>
                  Your payment is secure and encrypted
                </Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.modalBody}>
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Amount</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                  You will be redirected to PayPal to complete your payment securely.
                </Text>
              </View>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark" size={16} color={colors.status.success} />
                <Text style={styles.securityText}>
                  Your payment is secure and encrypted
                </Text>
              </View>
            </ScrollView>
          )}

          {!approvalUrl && (
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payButton, loading && styles.payButtonDisabled]}
                onPress={createPayPalOrder}
                disabled={loading}
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
          )}
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
    height: '90%',
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
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  payPalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#0070ba',
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  payPalButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
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

