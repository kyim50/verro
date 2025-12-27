import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { showAlert } from './StyledAlert';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function MilestoneApprovalCard({ progressUpdate, commissionId, token, onApprovalChange, isClient }) {
  const [approving, setApproving] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalAction, setApprovalAction] = useState(null); // 'approve' or 'reject'
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleApproval = async () => {
    if (!approvalAction) return;

    setApproving(true);
    try {
      const response = await axios.patch(
        `${API_URL}/commissions/${commissionId}/progress/${progressUpdate.id}/approve`,
        {
          approve: approvalAction === 'approve',
          notes: approvalNotes || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: approvalAction === 'approve' ? 'Milestone Approved' : 'Revision Requested',
        text2: approvalAction === 'approve'
          ? 'Artist can now proceed to the next milestone'
          : 'Artist has been notified of the requested changes',
      });

      setShowApprovalModal(false);
      setApprovalNotes('');
      setApprovalAction(null);

      if (onApprovalChange) {
        onApprovalChange(response.data);
      }
    } catch (error) {
      console.error('Error updating approval:', error);
      Toast.show({
        type: 'error',
        text1: 'Approval Failed',
        text2: error.response?.data?.error || 'Please try again',
      });
    } finally {
      setApproving(false);
    }
  };

  const openApprovalModal = (action) => {
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const renderApprovalModal = () => (
    <Modal
      visible={showApprovalModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowApprovalModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {approvalAction === 'approve' ? 'Approve Milestone' : 'Request Revisions'}
            </Text>
            <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalDescription}>
              {approvalAction === 'approve'
                ? 'Approving will allow the artist to proceed to the next milestone.'
                : 'Let the artist know what changes you\'d like to see.'}
            </Text>

            <TextInput
              style={styles.notesInput}
              placeholder={
                approvalAction === 'approve'
                  ? 'Add a note (optional)...'
                  : 'Describe the changes needed...'
              }
              placeholderTextColor={colors.text.tertiary}
              value={approvalNotes}
              onChangeText={setApprovalNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowApprovalModal(false)}
                disabled={approving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  approvalAction === 'approve' ? styles.approveButton : styles.rejectButton,
                ]}
                onPress={handleApproval}
                disabled={approving}
              >
                {approving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {approvalAction === 'approve' ? 'Approve' : 'Request Changes'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderImageModal = () => (
    <Modal
      visible={showImageModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowImageModal(false)}
    >
      <View style={styles.imageModalOverlay}>
        <TouchableOpacity
          style={styles.imageModalClose}
          onPress={() => setShowImageModal(false)}
        >
          <Ionicons name="close-circle" size={40} color={colors.white} />
        </TouchableOpacity>
        {selectedImage && (
          <Image
            source={{ uri: selectedImage }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );

  const getStatusIcon = () => {
    switch (progressUpdate.approval_status) {
      case 'approved':
        return { name: 'checkmark-circle', color: colors.success };
      case 'rejected':
        return { name: 'close-circle', color: colors.error };
      default:
        return { name: 'time', color: colors.warning };
    }
  };

  const getStatusText = () => {
    switch (progressUpdate.approval_status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Revisions Requested';
      default:
        return 'Awaiting Approval';
    }
  };

  const statusIcon = getStatusIcon();
  const additionalImages = progressUpdate.metadata?.additional_images || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={statusIcon.name} size={24} color={statusIcon.color} />
          <Text style={styles.title}>Approval Checkpoint</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusIcon.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusIcon.color }]}>
            {getStatusText()}
          </Text>
        </View>
      </View>

      {progressUpdate.notes && (
        <Text style={styles.notes}>{progressUpdate.notes}</Text>
      )}

      {/* Main Image */}
      {progressUpdate.image_url && (
        <TouchableOpacity
          onPress={() => {
            setSelectedImage(progressUpdate.image_url);
            setShowImageModal(true);
          }}
        >
          <Image
            source={{ uri: progressUpdate.image_url }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}

      {/* Additional Images */}
      {additionalImages.length > 0 && (
        <View style={styles.additionalImagesContainer}>
          <Text style={styles.additionalImagesLabel}>Additional Angles:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {additionalImages.map((imgUrl, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedImage(imgUrl);
                  setShowImageModal(true);
                }}
              >
                <Image
                  source={{ uri: imgUrl }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Approval/Rejection Info */}
      {progressUpdate.approval_status !== 'pending' && (
        <View style={styles.approvalInfo}>
          <View style={styles.approvalHeader}>
            <Ionicons
              name={progressUpdate.approval_status === 'approved' ? 'checkmark-circle' : 'information-circle'}
              size={16}
              color={progressUpdate.approval_status === 'approved' ? colors.success : colors.error}
            />
            <Text style={styles.approvalLabel}>
              {progressUpdate.approval_status === 'approved' ? 'Approved by' : 'Feedback from'} Client
            </Text>
          </View>
          {progressUpdate.approval_notes && (
            <Text style={styles.approvalNotes}>{progressUpdate.approval_notes}</Text>
          )}
          <Text style={styles.approvalDate}>
            {new Date(progressUpdate.approved_at).toLocaleString()}
          </Text>
        </View>
      )}

      {/* Action Buttons (Client Only) */}
      {isClient && progressUpdate.approval_status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectActionButton]}
            onPress={() => openApprovalModal('reject')}
            disabled={approving}
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>
              Request Changes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveActionButton]}
            onPress={() => openApprovalModal('approve')}
            disabled={approving}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
            <Text style={[styles.actionButtonText, { color: colors.white }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderApprovalModal()}
      {renderImageModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.warning + '40',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  notes: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  additionalImagesContainer: {
    marginTop: spacing.sm,
  },
  additionalImagesLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  approvalInfo: {
    backgroundColor: colors.background.tertiary,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  approvalLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  approvalNotes: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  approvalDate: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  approveActionButton: {
    backgroundColor: colors.success,
  },
  rejectActionButton: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.error,
  },
  actionButtonText: {
    ...typography.body,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
    ...shadows.lg,
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
  },
  modalDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.tertiary,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  confirmButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
