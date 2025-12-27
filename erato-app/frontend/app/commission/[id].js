import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import MilestoneApprovalCard from '../../components/MilestoneApprovalCard';
import { uploadImage, validateImage } from '../../utils/imageUpload';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function CommissionDetails() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commission, setCommission] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);

  // Complete milestone modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionImage, setCompletionImage] = useState(null);
  const [additionalImages, setAdditionalImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const isArtist = commission?.artist_id === user?.id;
  const isClient = commission?.client_id === user?.id;

  const loadCommissionData = useCallback(async () => {
    if (!id) return;

    try {
      // Load commission details
      const commissionResponse = await axios.get(
        `${API_URL}/commissions/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCommission(commissionResponse.data);

      // Load milestones
      const milestonesResponse = await axios.get(
        `${API_URL}/milestones/commission/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMilestones(milestonesResponse.data.milestones || []);

      // Load progress updates
      const progressResponse = await axios.get(
        `${API_URL}/commissions/${id}/progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgressUpdates(Array.isArray(progressResponse.data) ? progressResponse.data : []);

    } catch (error) {
      console.error('Error loading commission:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load commission',
        text2: error.response?.data?.error || 'Please try again',
      });
    }
  }, [id, token]);

  useEffect(() => {
    loadCommissionData().then(() => setLoading(false));
  }, [loadCommissionData]);

  const approvalCheckpoints = useMemo(() => {
    if (!Array.isArray(progressUpdates)) return [];
    return progressUpdates.filter(
      update => update.update_type === 'approval_checkpoint'
    );
  }, [progressUpdates]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCommissionData();
    setRefreshing(false);
  };

  const pickImage = async (isAdditional = false) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !isAdditional,
      aspect: isAdditional ? undefined : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await validateImage(result.assets[0].uri);
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: error.message,
        });
        return;
      }

      if (isAdditional) {
        setAdditionalImages([...additionalImages, result.assets[0].uri]);
      } else {
        setCompletionImage(result.assets[0].uri);
      }
    }
  };

  const handleCompleteMilestone = async () => {
    if (!completionImage) {
      Toast.show({
        type: 'error',
        text1: 'Image Required',
        text2: 'Please upload an image of your work',
      });
      return;
    }

    setUploading(true);
    try {
      // Upload main image
      const mainImageUrl = await uploadImage(completionImage, 'artworks', '', token);

      // Upload additional images
      const additionalImageUrls = [];
      for (const imgUri of additionalImages) {
        const url = await uploadImage(imgUri, 'artworks', '', token);
        additionalImageUrls.push(url);
      }

      // Complete milestone (creates approval checkpoint)
      await axios.post(
        `${API_URL}/milestones/${selectedMilestone.id}/complete`,
        {
          image_url: mainImageUrl,
          notes: completionNotes || `${selectedMilestone.title} - Ready for approval`,
          additional_images: additionalImageUrls,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Milestone Completed',
        text2: 'Sent to client for approval',
      });

      // Reset form
      setShowCompleteModal(false);
      setSelectedMilestone(null);
      setCompletionNotes('');
      setCompletionImage(null);
      setAdditionalImages([]);

      // Reload data
      await loadCommissionData();

    } catch (error) {
      console.error('Error completing milestone:', error);
      Toast.show({
        type: 'error',
        text1: 'Completion Failed',
        text2: error.response?.data?.error || 'Please try again',
      });
    } finally {
      setUploading(false);
    }
  };

  const renderMilestoneCard = (milestone) => {
    const isPaid = milestone.payment_status === 'paid';
    const isLocked = milestone.is_locked;
    const isCurrent = commission?.current_milestone_id === milestone.id;
    const hasCheckpoint = milestone.progress_update;

    return (
      <View key={milestone.id} style={styles.milestoneCard}>
        <View style={styles.milestoneHeader}>
          <View style={styles.milestoneInfo}>
            <View style={styles.milestoneNumber}>
              <Text style={styles.milestoneNumberText}>{milestone.milestone_number}</Text>
            </View>
            <View style={styles.milestoneTitleContainer}>
              <Text style={styles.milestoneTitle}>{milestone.title}</Text>
              <Text style={styles.milestoneDescription}>{milestone.description}</Text>
            </View>
          </View>
          <Text style={styles.milestoneAmount}>${milestone.amount}</Text>
        </View>

        <View style={styles.milestoneStatus}>
          <View style={[
            styles.statusBadge,
            isPaid && styles.paidBadge,
            isLocked && styles.lockedBadge,
          ]}>
            <Ionicons
              name={isPaid ? 'checkmark-circle' : isLocked ? 'lock-closed' : 'radio-button-off'}
              size={16}
              color={isPaid ? colors.success : isLocked ? colors.text.tertiary : colors.primary}
            />
            <Text style={[
              styles.statusText,
              isPaid && styles.paidText,
              isLocked && styles.lockedText,
            ]}>
              {isPaid ? 'Paid' : isLocked ? 'Locked' : 'Ready'}
            </Text>
          </View>

          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentText}>Current</Text>
            </View>
          )}
        </View>

        {/* Artist Actions */}
        {isArtist && !isLocked && !hasCheckpoint && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              setSelectedMilestone(milestone);
              setShowCompleteModal(true);
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
            <Text style={styles.completeButtonText}>Complete Milestone</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!commission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Commission Not Found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Commission Details</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Commission Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{commission.status.replace('_', ' ')}</Text>

          {commission.queue_position && (
            <>
              <Text style={styles.infoLabel}>Queue Position</Text>
              <Text style={styles.infoValue}>#{commission.queue_position}</Text>
            </>
          )}

          {commission.final_price && (
            <>
              <Text style={styles.infoLabel}>Total Price</Text>
              <Text style={styles.infoValue}>${commission.final_price}</Text>
            </>
          )}
        </View>

        {/* Milestones */}
        <Text style={styles.sectionTitle}>Milestones</Text>
        {milestones.length === 0 ? (
          <View style={styles.emptySection}>
            <Ionicons name="list-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No milestones defined yet</Text>
          </View>
        ) : (
          milestones.map(renderMilestoneCard)
        )}

        {/* Approval Checkpoints */}
        {approvalCheckpoints.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Approval Checkpoints</Text>
            {approvalCheckpoints.map(checkpoint => (
              <MilestoneApprovalCard
                key={checkpoint.id}
                progressUpdate={checkpoint}
                commissionId={id}
                token={token}
                onApprovalChange={loadCommissionData}
                isClient={isClient}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Complete Milestone Modal */}
      <Modal
        visible={showCompleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete {selectedMilestone?.title}</Text>
              <TouchableOpacity onPress={() => setShowCompleteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Upload Your Work *</Text>
              <TouchableOpacity
                style={styles.imageUploadButton}
                onPress={() => pickImage(false)}
              >
                {completionImage ? (
                  <Image source={{ uri: completionImage }} style={styles.uploadedImage} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
                    <Text style={styles.uploadText}>Tap to upload image</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Additional Angles (Optional)</Text>
              <View style={styles.additionalImagesContainer}>
                {additionalImages.map((uri, index) => (
                  <View key={index} style={styles.additionalImageWrapper}>
                    <Image source={{ uri }} style={styles.additionalImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setAdditionalImages(additionalImages.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {additionalImages.length < 3 && (
                  <TouchableOpacity
                    style={styles.addImageButton}
                    onPress={() => pickImage(true)}
                  >
                    <Ionicons name="add" size={32} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add any notes for the client..."
                placeholderTextColor={colors.text.tertiary}
                value={completionNotes}
                onChangeText={setCompletionNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={handleCompleteMilestone}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>Submit for Approval</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  infoValue: {
    ...typography.h3,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  milestoneCard: {
    backgroundColor: colors.background.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  milestoneInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  milestoneNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  milestoneNumberText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  milestoneTitleContainer: {
    flex: 1,
  },
  milestoneTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  milestoneDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  milestoneAmount: {
    ...typography.h3,
    color: colors.success,
  },
  milestoneStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  paidBadge: {
    backgroundColor: colors.success + '20',
  },
  lockedBadge: {
    backgroundColor: colors.text.tertiary + '20',
  },
  statusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  paidText: {
    color: colors.success,
  },
  lockedText: {
    color: colors.text.tertiary,
  },
  currentBadge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  currentText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  completeButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  emptySection: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  modalLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  imageUploadButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
  },
  uploadText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  additionalImagesContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  additionalImageWrapper: {
    position: 'relative',
  },
  additionalImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 100,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
});
