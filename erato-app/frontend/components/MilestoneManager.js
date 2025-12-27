import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function MilestoneManager({ commissionId, commission, onUpdate }) {
  const { token } = useAuthStore();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);

  useEffect(() => {
    fetchMilestones();
  }, [commissionId]);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/milestones/commission/${commissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMilestones(response.data.milestones || []);
    } catch (error) {
      console.error('Error fetching milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMilestones = async () => {
    try {
      setGenerating(true);
      const response = await axios.post(
        `${API_URL}/milestones/commission/${commissionId}/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Milestones Generated',
        text2: 'Default milestones created. Each update is auto-saved for client to view.',
      });

      setMilestones(response.data.milestones || []);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error generating milestones:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to generate milestones',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleEditMilestone = (milestone) => {
    setEditingMilestone({
      ...milestone,
      tempPercentage: milestone.percentage.toString(),
    });
    setShowEditModal(true);
  };

  const handleSaveMilestone = async () => {
    try {
      const percentage = parseFloat(editingMilestone.tempPercentage);
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Percentage',
          text2: 'Percentage must be between 0 and 100',
        });
        return;
      }

      const price = commission.final_price || commission.budget || 0;
      const amount = (price * percentage) / 100;

      await axios.put(
        `${API_URL}/milestones/${editingMilestone.id}`,
        {
          percentage,
          amount: amount.toFixed(2),
          title: editingMilestone.title,
          description: editingMilestone.description,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Milestone Updated',
        text2: 'Auto-saved and visible to client',
      });

      setShowEditModal(false);
      setEditingMilestone(null);
      fetchMilestones();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating milestone:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to update milestone',
      });
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const isPlanConfirmed = commission?.milestone_plan_confirmed;
  const totalPercentage = milestones.reduce((sum, m) => sum + parseFloat(m.percentage || 0), 0);
  const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;
  const hasAnyPaidMilestone = milestones.some(m => m.payment_status === 'paid');
  const isLocked = isPlanConfirmed || hasAnyPaidMilestone;

  if (milestones.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="layers-outline" size={48} color={colors.text.disabled} />
        <Text style={styles.emptyText}>No Milestones Set</Text>
        <Text style={styles.emptySubtext}>
          Generate default milestones to set up payment stages
        </Text>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateMilestones}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color={colors.text.primary} />
              <Text style={styles.generateButtonText}>Generate Milestones</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with status */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Payment Milestones</Text>
          {isPlanConfirmed && (
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.confirmedText}>Client Confirmed</Text>
            </View>
          )}
        </View>
        <View style={styles.totalBadge}>
          <Text style={[
            styles.totalText,
            { color: isValidTotal ? colors.status.success : colors.status.error }
          ]}>
            {totalPercentage.toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Warning if not valid total */}
      {!isValidTotal && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color={colors.status.warning} />
          <Text style={styles.warningText}>
            Milestones must total 100% before client can confirm
          </Text>
        </View>
      )}

      {/* Milestones list */}
      <ScrollView style={styles.milestonesList}>
        {milestones.map((milestone, index) => {
          const isPaid = milestone.payment_status === 'paid';
          const amount = parseFloat(milestone.amount);
          const percentage = parseFloat(milestone.percentage);

          return (
            <View key={milestone.id} style={[
              styles.milestoneCard,
              isPaid && styles.milestoneCardPaid
            ]}>
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
                {isPaid ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
                ) : (
                  !isLocked && (
                    <TouchableOpacity
                      onPress={() => handleEditMilestone(milestone)}
                      style={styles.editButton}
                    >
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )
                )}
              </View>

              <View style={styles.milestoneFooter}>
                <View>
                  <Text style={styles.milestoneAmount}>${amount.toFixed(2)}</Text>
                  <Text style={styles.milestonePercentage}>{percentage.toFixed(1)}%</Text>
                </View>
                {isPaid && milestone.paid_at && (
                  <View style={styles.paidInfo}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
                    <Text style={styles.paidText}>
                      Paid {new Date(milestone.paid_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Auto-save notice */}
      {!isLocked && (
        <View style={styles.autoSaveNotice}>
          <Ionicons name="checkmark-circle" size={16} color={colors.status.success} />
          <Text style={styles.autoSaveText}>
            Milestones are auto-saved and visible to client
          </Text>
        </View>
      )}

      {/* Show locked message if any milestone is paid */}
      {hasAnyPaidMilestone && (
        <View style={styles.lockedNotice}>
          <Ionicons name="lock-closed" size={16} color={colors.text.disabled} />
          <Text style={styles.lockedText}>
            Milestones are locked after first payment
          </Text>
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Milestone</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={editingMilestone?.title || ''}
                  onChangeText={(text) =>
                    setEditingMilestone({ ...editingMilestone, title: text })
                  }
                  placeholder="Milestone title"
                  placeholderTextColor={colors.text.disabled}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editingMilestone?.description || ''}
                  onChangeText={(text) =>
                    setEditingMilestone({ ...editingMilestone, description: text })
                  }
                  placeholder="What's included in this milestone?"
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Percentage of Total</Text>
                <TextInput
                  style={styles.input}
                  value={editingMilestone?.tempPercentage || ''}
                  onChangeText={(text) =>
                    setEditingMilestone({ ...editingMilestone, tempPercentage: text })
                  }
                  placeholder="25"
                  placeholderTextColor={colors.text.disabled}
                  keyboardType="decimal-pad"
                />
                {editingMilestone?.tempPercentage && (commission?.final_price || commission?.budget) && (
                  <Text style={styles.calculatedAmount}>
                    = ${(((commission.final_price || commission.budget) * parseFloat(editingMilestone.tempPercentage || 0)) / 100).toFixed(2)}
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveMilestone}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: spacing.lg,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  generateButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  confirmedText: {
    ...typography.caption,
    color: colors.status.success,
    fontSize: 12,
    fontWeight: '600',
  },
  totalBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  totalText: {
    ...typography.bodyBold,
    fontSize: 18,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.warning + '20',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: colors.status.warning,
    flex: 1,
  },
  milestonesList: {
    flex: 1,
    marginBottom: spacing.md,
  },
  milestoneCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 0,
  },
  milestoneCardPaid: {
    backgroundColor: colors.status.success + '10',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  milestoneNumber: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneNumberText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: 17,
    fontWeight: '600',
  },
  milestoneDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  editButton: {
    padding: spacing.sm,
  },
  milestoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 0,
  },
  milestoneAmount: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  milestonePercentage: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontSize: 14,
    fontWeight: '500',
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
  autoSaveNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.success + '15',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  autoSaveText: {
    ...typography.caption,
    color: colors.status.success,
    fontSize: 13,
    fontWeight: '500',
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  lockedText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
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
    padding: spacing.xl,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 0,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  calculatedAmount: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xl,
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
  saveButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
