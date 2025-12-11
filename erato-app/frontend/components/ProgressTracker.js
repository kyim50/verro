import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ProgressTracker({ commissionId, token, isArtist, onProgressUpdate }) {
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadNote, setUploadNote] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [approvalRequested, setApprovalRequested] = useState(false);

  useEffect(() => {
    loadProgressUpdates();
  }, [commissionId]);

  const loadProgressUpdates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/commissions/${commissionId}/progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProgressUpdates(response.data.updates || []);
    } catch (error) {
      console.error('Error loading progress updates:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load progress updates',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Required',
        text2: 'Please grant photo library access',
        visibilityTime: 2000,
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setSelectedImages(result.assets);
    }
  };

  const uploadProgress = async () => {
    if (selectedImages.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Images',
        text2: 'Please select at least one image',
        visibilityTime: 2000,
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('note', uploadNote);
      formData.append('requires_approval', approvalRequested);

      selectedImages.forEach((image, index) => {
        formData.append('images', {
          uri: image.uri,
          type: 'image/jpeg',
          name: `progress_${Date.now()}_${index}.jpg`,
        });
      });

      await axios.post(
        `${API_URL}/commissions/${commissionId}/progress`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Progress update uploaded',
        visibilityTime: 2000,
      });

      setShowUploadModal(false);
      setUploadNote('');
      setSelectedImages([]);
      setApprovalRequested(false);
      loadProgressUpdates();
      onProgressUpdate?.();
    } catch (error) {
      console.error('Error uploading progress:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to upload progress',
        visibilityTime: 2000,
      });
    } finally {
      setUploading(false);
    }
  };

  const approveUpdate = async (updateId) => {
    try {
      await axios.post(
        `${API_URL}/commissions/progress/${updateId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Approved',
        text2: 'Progress update approved',
        visibilityTime: 2000,
      });

      loadProgressUpdates();
      onProgressUpdate?.();
    } catch (error) {
      console.error('Error approving update:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to approve update',
        visibilityTime: 2000,
      });
    }
  };

  const requestRevision = async (updateId, revisionNote) => {
    try {
      await axios.post(
        `${API_URL}/commissions/progress/${updateId}/request-revision`,
        { revision_note: revisionNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Revision Requested',
        text2: 'Artist will be notified',
        visibilityTime: 2000,
      });

      loadProgressUpdates();
      onProgressUpdate?.();
    } catch (error) {
      console.error('Error requesting revision:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to request revision',
        visibilityTime: 2000,
      });
    }
  };

  const renderProgressUpdate = ({ item }) => {
    const isPending = item.requires_approval && item.approval_status === 'pending';
    const isApproved = item.approval_status === 'approved';
    const isRevisionRequested = item.approval_status === 'revision_requested';

    return (
      <View style={styles.updateCard}>
        <View style={styles.updateHeader}>
          <View style={styles.updateMeta}>
            <Ionicons
              name={
                isApproved ? 'checkmark-circle' :
                isRevisionRequested ? 'alert-circle' :
                isPending ? 'time' :
                'image-outline'
              }
              size={20}
              color={
                isApproved ? colors.status.success :
                isRevisionRequested ? colors.status.warning :
                isPending ? colors.status.info :
                colors.primary
              }
            />
            <Text style={styles.updateDate}>
              {new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          {item.requires_approval && (
            <View style={[
              styles.approvalBadge,
              { backgroundColor:
                isApproved ? colors.status.success + '20' :
                isRevisionRequested ? colors.status.warning + '20' :
                colors.status.info + '20'
              }
            ]}>
              <Text style={[
                styles.approvalBadgeText,
                { color:
                  isApproved ? colors.status.success :
                  isRevisionRequested ? colors.status.warning :
                  colors.status.info
                }
              ]}>
                {isApproved ? 'Approved' : isRevisionRequested ? 'Revision Needed' : 'Pending Approval'}
              </Text>
            </View>
          )}
        </View>

        {item.note && (
          <Text style={styles.updateNote}>{item.note}</Text>
        )}

        {/* Progress Images */}
        {item.images && item.images.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imagesScroll}
            contentContainerStyle={styles.imagesContainer}
          >
            {item.images.map((imageUrl, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setSelectedUpdate(item);
                  setShowImageViewer(true);
                }}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.progressImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Revision Note */}
        {item.revision_note && (
          <View style={styles.revisionNoteBox}>
            <View style={styles.revisionHeader}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.status.warning} />
              <Text style={styles.revisionHeaderText}>Revision Feedback</Text>
            </View>
            <Text style={styles.revisionNoteText}>{item.revision_note}</Text>
          </View>
        )}

        {/* Approval Actions (for clients on pending updates) */}
        {!isArtist && isPending && (
          <View style={styles.approvalActions}>
            <TouchableOpacity
              style={styles.revisionButton}
              onPress={() => {
                // Show revision input modal
                const note = prompt('Please describe the changes needed:');
                if (note) {
                  requestRevision(item.id, note);
                }
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.status.warning} />
              <Text style={styles.revisionButtonText}>Request Revision</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => approveUpdate(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.text.primary} />
              <Text style={styles.approveButtonText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress Timeline */}
      {progressUpdates.length > 0 ? (
        <View style={{ flex: 1 }}>
          {/* Add Update Button - Only show when there are updates */}
          {isArtist && (
            <View style={styles.headerButtonContainer}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => setShowUploadModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text.primary} />
                <Text style={styles.uploadButtonText}>Add Update</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={progressUpdates}
            renderItem={renderProgressUpdate}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.timelineContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.emptyStateContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Progress Updates</Text>
            <Text style={styles.emptyText}>
              {isArtist
                ? 'Upload work-in-progress images to keep your client updated'
                : 'Your artist will share progress updates here'}
            </Text>
            {isArtist && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => setShowUploadModal(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text.primary} />
                <Text style={styles.emptyStateButtonText}>Add First Update</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Progress Update</Text>
              <TouchableOpacity
                onPress={() => setShowUploadModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.uploadContent} showsVerticalScrollIndicator={false}>
              {/* Image Picker */}
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
                <Ionicons name="images-outline" size={32} color={colors.primary} />
                <Text style={styles.imagePickerText}>
                  {selectedImages.length > 0
                    ? `${selectedImages.length} image(s) selected`
                    : 'Select Images (Max 5)'}
                </Text>
              </TouchableOpacity>

              {/* Selected Images Preview */}
              {selectedImages.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectedImagesScroll}
                  contentContainerStyle={styles.selectedImagesContainer}
                >
                  {selectedImages.map((image, index) => (
                    <View key={index} style={styles.selectedImageWrapper}>
                      <Image
                        source={{ uri: image.uri }}
                        style={styles.selectedImage}
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => {
                          setSelectedImages(selectedImages.filter((_, i) => i !== index));
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Note Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Note (Optional)</Text>
                <Text style={styles.inputHint}>
                  Describe what you've completed or what stage you're at
                </Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g., Completed initial sketch, working on colors, ready for review..."
                  placeholderTextColor={colors.text.disabled}
                  value={uploadNote}
                  onChangeText={setUploadNote}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Approval Checkpoint Toggle */}
              <TouchableOpacity
                style={styles.checkpointToggle}
                onPress={() => setApprovalRequested(!approvalRequested)}
              >
                <View style={styles.checkpointLeft}>
                  <Ionicons
                    name={approvalRequested ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={approvalRequested ? colors.primary : colors.text.secondary}
                  />
                  <View style={styles.checkpointTextContainer}>
                    <Text style={styles.checkpointText}>Request Approval</Text>
                    <Text style={styles.checkpointSubtext}>
                      Client must approve before continuing
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Upload Button */}
              <TouchableOpacity
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={uploadProgress}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.text.primary} />
                    <Text style={styles.submitButtonText}>Upload Progress</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      {selectedUpdate && (
        <Modal
          visible={showImageViewer}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowImageViewer(false)}
        >
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setShowImageViewer(false)}
            >
              <Ionicons name="close" size={32} color={colors.text.primary} />
            </TouchableOpacity>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.imageViewerScroll}
            >
              {selectedUpdate.images?.map((imageUrl, index) => (
                <View key={index} style={styles.imageViewerPage}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.fullImage}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  headerButtonContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  uploadButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  timelineContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  updateCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  updateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  updateDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  approvalBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  approvalBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updateNote: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  imagesScroll: {
    marginVertical: spacing.sm,
  },
  imagesContainer: {
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  progressImage: {
    width: 180,
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  revisionNoteBox: {
    backgroundColor: colors.status.warning + '10',
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  revisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  revisionHeaderText: {
    ...typography.bodyBold,
    color: colors.status.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  revisionNoteText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  revisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.status.warning,
  },
  revisionButtonText: {
    ...typography.bodyBold,
    color: colors.status.warning,
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.success,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  approveButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  emptyStateButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'flex-end',
  },
  uploadModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadContent: {
    padding: spacing.lg,
  },
  imagePickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  imagePickerText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  selectedImagesScroll: {
    marginBottom: spacing.md,
  },
  selectedImagesContainer: {
    gap: spacing.sm,
  },
  selectedImageWrapper: {
    position: 'relative',
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
  },
  inputSection: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  inputHint: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 20,
  },
  checkpointToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkpointLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  checkpointTextContainer: {
    flex: 1,
  },
  checkpointText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  checkpointSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.medium,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Image Viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.98)',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface + 'CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerScroll: {
    flex: 1,
  },
  imageViewerPage: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
