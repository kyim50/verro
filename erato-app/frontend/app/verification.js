import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { uploadImage } from '../utils/imageUpload';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

const VERIFICATION_TYPES = {
  portfolio: {
    name: 'Portfolio Verified',
    icon: 'shield-checkmark',
    color: '#3B82F6',
    description: 'Prove ownership of your portfolio by linking to your professional portfolio sites.',
    requirements: [
      'Link to at least one professional portfolio (ArtStation, DeviantArt, etc.)',
      'Provide verification code or screenshot showing account ownership',
      'Portfolio must contain at least 5 artworks',
      'Account must be at least 3 months old',
    ],
  },
  payment: {
    name: 'Payment Verified',
    icon: 'card',
    color: '#10B981',
    description: 'Earn this badge by completing commissions and maintaining high ratings.',
    requirements: [
      'Complete at least 5 paid commissions',
      'Maintain an average rating of 4+ stars',
      'No disputes or chargebacks',
      'Account in good standing',
    ],
  },
  identity: {
    name: 'Identity Verified',
    icon: 'person-check',
    color: '#8B5CF6',
    description: 'Verify your identity with government-issued ID for enhanced trust.',
    requirements: [
      'Provide government-issued ID',
      'Complete video verification call (optional)',
      'Verify payment details match identity',
      'Pass background check (for commercial tiers)',
    ],
  },
};

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [requirements, setRequirements] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    portfolioLinks: [],
    notes: '',
    files: [],
  });

  useEffect(() => {
    fetchSubmissions();
    fetchRequirements();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/verification/my-submissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmissions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const fetchRequirements = async () => {
    try {
      const response = await axios.get(`${API_URL}/verification/badge-requirements`);
      setRequirements(response.data.data);
    } catch (error) {
      console.error('Error fetching requirements:', error);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setFormData({ portfolioLinks: [], notes: '', files: [] });
  };

  const handleAddPortfolioLink = () => {
    Alert.prompt(
      'Add Portfolio Link',
      'Enter the URL of your portfolio (ArtStation, DeviantArt, etc.)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (url) => {
            if (url && url.trim()) {
              try {
                new URL(url);
                setFormData({
                  ...formData,
                  portfolioLinks: [...formData.portfolioLinks, url.trim()],
                });
              } catch {
                Toast.show({
                  type: 'error',
                  text1: 'Invalid URL',
                  text2: 'Please enter a valid URL',
                });
              }
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleRemovePortfolioLink = (index) => {
    setFormData({
      ...formData,
      portfolioLinks: formData.portfolioLinks.filter((_, i) => i !== index),
    });
  };

  const handleFileUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Please allow photo access',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      setUploading(true);
      const uploadPromises = result.assets.map(asset => uploadImage(asset.uri));
      const uploadedUrls = await Promise.all(uploadPromises);

      setFormData({
        ...formData,
        files: [...formData.files, ...uploadedUrls],
      });

      Toast.show({
        type: 'success',
        text1: 'Uploaded',
        text2: `${uploadedUrls.length} file(s) uploaded`,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Failed to upload files',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = (index) => {
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (selectedType === 'portfolio' && formData.portfolioLinks.length === 0 && formData.files.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please provide at least one portfolio link or verification file',
      });
      return;
    }

    if (selectedType === 'identity' && formData.files.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please upload your ID document',
      });
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('verificationType', selectedType);
      formDataToSend.append('notes', formData.notes);
      
      if (selectedType === 'portfolio') {
        formDataToSend.append('portfolioLinks', JSON.stringify(formData.portfolioLinks));
      }

      // Add files
      formData.files.forEach((fileUrl, index) => {
        // Note: In a real implementation, you'd need to convert URLs back to files
        // For now, we'll send URLs in the request body instead
      });

      await axios.post(
        `${API_URL}/verification/submit`,
        {
          verificationType: selectedType,
          portfolioLinks: formData.portfolioLinks,
          notes: formData.notes,
          files: formData.files, // URLs
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Submitted',
        text2: 'Your verification request has been submitted for review',
      });

      setSelectedType(null);
      setFormData({ portfolioLinks: [], notes: '', files: [] });
      await fetchSubmissions();
    } catch (error) {
      console.error('Error submitting verification:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to submit verification',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSubmissionStatus = (type) => {
    const submission = submissions.find(s => s.verification_type === type);
    if (!submission) return null;
    return submission.status;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.description}>
          Get verified to build trust with clients and unlock new features on Erato.
        </Text>

        {/* Verification Type Selection */}
        {!selectedType ? (
          <View style={styles.typesContainer}>
            {Object.entries(VERIFICATION_TYPES).map(([key, type]) => {
              const status = getSubmissionStatus(key);
              const isPending = status === 'pending';
              const isApproved = status === 'approved';
              const isRejected = status === 'rejected';

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.typeCard,
                    isApproved && styles.typeCardApproved,
                    isRejected && styles.typeCardRejected,
                  ]}
                  onPress={() => handleTypeSelect(key)}
                >
                  <View style={[styles.typeIconContainer, { backgroundColor: type.color + '20' }]}>
                    <Ionicons
                      name={isApproved ? type.icon : `${type.icon}-outline`}
                      size={32}
                      color={isApproved ? type.color : colors.text.secondary}
                    />
                  </View>
                  <Text style={styles.typeName}>{type.name}</Text>
                  <Text style={styles.typeDescription} numberOfLines={2}>
                    {type.description}
                  </Text>
                  {isPending && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Pending Review</Text>
                    </View>
                  )}
                  {isApproved && (
                    <View style={[styles.statusBadge, styles.statusBadgeApproved]}>
                      <Ionicons name="checkmark-circle" size={16} color={type.color} />
                      <Text style={[styles.statusText, { color: type.color }]}>Verified</Text>
                    </View>
                  )}
                  {isRejected && (
                    <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
                      <Ionicons name="close-circle" size={16} color={colors.status.error} />
                      <Text style={[styles.statusText, { color: colors.status.error }]}>Rejected</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.backToTypes}
              onPress={() => setSelectedType(null)}
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backToTypesText}>Back to Types</Text>
            </TouchableOpacity>

            <View style={styles.formHeader}>
              <View style={[styles.formIconContainer, { backgroundColor: VERIFICATION_TYPES[selectedType].color + '20' }]}>
                <Ionicons
                  name={VERIFICATION_TYPES[selectedType].icon}
                  size={32}
                  color={VERIFICATION_TYPES[selectedType].color}
                />
              </View>
              <Text style={styles.formTitle}>{VERIFICATION_TYPES[selectedType].name}</Text>
              <Text style={styles.formDescription}>
                {VERIFICATION_TYPES[selectedType].description}
              </Text>
            </View>

            {/* Requirements */}
            {requirements && requirements[selectedType] && (
              <View style={styles.requirementsSection}>
                <Text style={styles.sectionTitle}>Requirements</Text>
                {requirements[selectedType].requirements.map((req, index) => (
                  <View key={index} style={styles.requirementItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
                    <Text style={styles.requirementText}>{req}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Portfolio Links */}
            {selectedType === 'portfolio' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Portfolio Links</Text>
                {formData.portfolioLinks.map((link, index) => (
                  <View key={index} style={styles.linkItem}>
                    <Ionicons name="link" size={16} color={colors.text.secondary} />
                    <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
                    <TouchableOpacity onPress={() => handleRemovePortfolioLink(index)}>
                      <Ionicons name="close-circle" size={20} color={colors.status.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleAddPortfolioLink}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={styles.addButtonText}>Add Portfolio Link</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* File Upload */}
            {(selectedType === 'portfolio' || selectedType === 'identity') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {selectedType === 'identity' ? 'ID Document' : 'Verification Files'}
                </Text>
                {formData.files.length > 0 && (
                  <View style={styles.filesList}>
                    {formData.files.map((file, index) => (
                      <View key={index} style={styles.fileItem}>
                        <Ionicons name="document-outline" size={20} color={colors.text.secondary} />
                        <Text style={styles.fileText} numberOfLines={1}>
                          File {index + 1}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemoveFile(index)}>
                          <Ionicons name="close-circle" size={20} color={colors.status.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleFileUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>
                        {selectedType === 'identity' ? 'Upload ID' : 'Upload Files'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
              <TextInput
                style={styles.textArea}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholder="Add any additional information..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.submitButtonText}>Submit for Review</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* My Submissions */}
        {submissions.length > 0 && (
          <View style={styles.submissionsSection}>
            <Text style={styles.sectionTitle}>My Submissions</Text>
            {submissions.map((submission) => (
              <View key={submission.id} style={styles.submissionCard}>
                <View style={styles.submissionHeader}>
                  <Text style={styles.submissionType}>
                    {VERIFICATION_TYPES[submission.verification_type]?.name || submission.verification_type}
                  </Text>
                  <View style={[
                    styles.submissionStatus,
                    submission.status === 'approved' && styles.submissionStatusApproved,
                    submission.status === 'rejected' && styles.submissionStatusRejected,
                  ]}>
                    <Text style={styles.submissionStatusText}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.submissionDate}>
                  Submitted: {new Date(submission.submitted_at).toLocaleDateString()}
                </Text>
                {submission.admin_notes && (
                  <Text style={styles.submissionNotes}>
                    {submission.admin_notes}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  typesContainer: {
    gap: spacing.md,
  },
  typeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCardApproved: {
    borderColor: colors.status.success,
    borderWidth: 2,
  },
  typeCardRejected: {
    borderColor: colors.status.error,
  },
  typeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  typeDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
  },
  statusBadgeApproved: {
    backgroundColor: colors.status.success + '20',
  },
  statusBadgeRejected: {
    backgroundColor: colors.status.error + '20',
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  formContainer: {
    gap: spacing.lg,
  },
  backToTypes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  backToTypesText: {
    ...typography.body,
    color: colors.primary,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  formIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formDescription: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  requirementsSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  requirementText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  linkText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  filesList: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  fileText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  submissionsSection: {
    marginTop: spacing.xl,
  },
  submissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  submissionType: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  submissionStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  submissionStatusApproved: {
    backgroundColor: colors.status.success + '20',
  },
  submissionStatusRejected: {
    backgroundColor: colors.status.error + '20',
  },
  submissionStatusText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  submissionDate: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  submissionNotes: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
});













