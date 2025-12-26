import React, { useState, useEffect, useRef } from 'react';
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
  milestoneId,
  onSuccess,
  onError,
}) {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState(null);
  const [orderId, setOrderId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (visible && commissionId && amount) {
      createPayPalOrder();
    } else {
      // Reset state when modal closes
      setApprovalUrl(null);
      setOrderId(null);
      setIsPolling(false);
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [visible, commissionId, amount]);

  const createPayPalOrder = async () => {
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
        `${API_URL}/payments/create-order`,
        requestBody,
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
      const canOpen = await Linking.canOpenURL(urlToOpen);
      if (canOpen) {
        await Linking.openURL(urlToOpen);
        // Don't start polling automatically - let user click button when they return
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
    
    if (isPolling) return; // Prevent multiple simultaneous checks
    
    try {
      setLoading(true);
      setIsPolling(true);
      
      const response = await axios.post(
        `${API_URL}/payments/capture-order`,
        { orderId: idToCheck },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        handlePaymentSuccess(response.data.data);
      }
    } catch (error) {
      console.log('Payment not completed yet:', error.message);
      Toast.show({
        type: 'info',
        text1: 'Payment Not Complete',
        text2: 'Please complete payment in PayPal and try again',
      });
    } finally {
      setLoading(false);
      setIsPolling(false);
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
    // Just close the modal
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
            <Text style={styles.modalTitle}>Secure Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color={colors.text.disabled} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {approvalUrl ? 'Processing...' : 'Setting up payment...'}
              </Text>
            </View>
          ) : approvalUrl ? (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
              </View>

              <TouchableOpacity
                style={styles.payPalButton}
                onPress={() => handleOpenPayPal()}
              >
                <Ionicons name="logo-paypal" size={28} color="#FFFFFF" />
                <Text style={styles.payPalButtonText}>Continue to PayPal</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>After completing payment</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.checkStatusButton, (loading || isPolling) && styles.checkStatusButtonDisabled]}
                onPress={() => checkPaymentStatus()}
                disabled={loading || isPolling}
              >
                {loading || isPolling ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
                )}
                <Text style={styles.checkStatusButtonText}>
                  {loading || isPolling ? 'Checking...' : 'Confirm Payment'}
                </Text>
              </TouchableOpacity>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.status.success} />
                <Text style={styles.securityText}>
                  Secured by PayPal encryption
                </Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>${amount.toFixed(2)}</Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
                <Text style={styles.infoText}>
                  You'll be redirected to PayPal to complete your payment securely.
                </Text>
              </View>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.status.success} />
                <Text style={styles.securityText}>
                  Secured by PayPal encryption
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color="#FFFFFF" />
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
  payPalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: '#0070ba',
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    shadowColor: '#0070ba',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payPalButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  checkStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 0,
    marginTop: spacing.md,
  },
  checkStatusButtonDisabled: {
    opacity: 0.5,
  },
  checkStatusButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  amountContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
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
    marginTop: spacing.xl,
  },
  securityText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.text.disabled,
    paddingHorizontal: spacing.md,
    fontSize: 12,
    fontWeight: '500',
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

