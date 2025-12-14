import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius, DEFAULT_AVATAR } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ReviewCard({ review, isArtist = false, onUpdate }) {
  const { token, user } = useAuthStore();
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState(review.artist_response || '');
  const [submitting, setSubmitting] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count || 0);
  const [userMarkedHelpful, setUserMarkedHelpful] = useState(review.userMarkedHelpful || false);
  const [togglingHelpful, setTogglingHelpful] = useState(false);

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Response cannot be empty',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (review.artist_response) {
        // Update existing response
        await axios.put(
          `${API_URL}/review-enhancements/${review.id}/respond`,
          { response: responseText.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Create new response
        await axios.post(
          `${API_URL}/review-enhancements/${review.id}/respond`,
          { response: responseText.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: review.artist_response ? 'Response updated' : 'Response added',
      });

      setShowResponseModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error submitting response:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to submit response',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResponse = async () => {
    try {
      await axios.delete(
        `${API_URL}/review-enhancements/${review.id}/respond`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setResponseText('');
      setShowResponseModal(false);
      if (onUpdate) onUpdate();

      Toast.show({
        type: 'success',
        text1: 'Deleted',
        text2: 'Response removed',
      });
    } catch (error) {
      console.error('Error deleting response:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete response',
      });
    }
  };

  const handleToggleHelpful = async () => {
    if (togglingHelpful) return;

    setTogglingHelpful(true);
    try {
      if (userMarkedHelpful) {
        await axios.delete(
          `${API_URL}/review-enhancements/${review.id}/helpful`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setHelpfulCount(prev => Math.max(0, prev - 1));
        setUserMarkedHelpful(false);
      } else {
        await axios.post(
          `${API_URL}/review-enhancements/${review.id}/helpful`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setHelpfulCount(prev => prev + 1);
        setUserMarkedHelpful(true);
      }
    } catch (error) {
      console.error('Error toggling helpful:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update helpful status',
      });
    } finally {
      setTogglingHelpful(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.reviewHeader}>
          <View style={styles.reviewerInfo}>
            <Image
              source={{ uri: review.client?.avatar_url || review.clients?.avatar_url || review.clients?.profile_picture || DEFAULT_AVATAR }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.reviewerDetails}>
              <View style={styles.reviewerNameRow}>
                <Text style={styles.reviewerName}>
                  {review.client?.full_name || review.client?.username || review.clients?.full_name || review.clients?.username || 'Anonymous'}
                </Text>
                {review.verified_commission && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reviewDate}>
                {new Date(review.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= review.rating ? 'star' : 'star-outline'}
                size={16}
                color={colors.status.warning}
              />
            ))}
          </View>
        </View>

        {review.comment && (
          <Text style={styles.comment}>{review.comment}</Text>
        )}

        {/* Artist Response */}
        {review.artist_response && (
          <View style={styles.responseContainer}>
            <View style={styles.responseHeader}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.responseLabel}>Artist Response</Text>
            </View>
            <Text style={styles.responseText}>{review.artist_response}</Text>
            {review.artist_responded_at && (
              <Text style={styles.responseDate}>
                {new Date(review.artist_responded_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {/* Helpful Button */}
          <TouchableOpacity
            style={[styles.actionButton, userMarkedHelpful && styles.actionButtonActive]}
            onPress={handleToggleHelpful}
            disabled={togglingHelpful || !token}
          >
            <Ionicons
              name={userMarkedHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={userMarkedHelpful ? colors.primary : colors.text.secondary}
            />
            <Text style={[
              styles.actionText,
              userMarkedHelpful && styles.actionTextActive
            ]}>
              Helpful {helpfulCount > 0 && `(${helpfulCount})`}
            </Text>
          </TouchableOpacity>

          {/* Artist Response Button */}
          {isArtist && review.review_type === 'client_to_artist' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowResponseModal(true)}
            >
              <Ionicons
                name={review.artist_response ? 'pencil' : 'chatbubble-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {review.artist_response ? 'Edit Response' : 'Respond'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {review.artist_response ? 'Edit Response' : 'Respond to Review'}
              </Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Your Response</Text>
              <TextInput
                style={styles.textArea}
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Thank the client for their feedback..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>
                {responseText.length}/500
              </Text>
            </View>

            <View style={styles.modalFooter}>
              {review.artist_response && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteResponse}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResponseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitResponse}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  reviewerName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: colors.status.success + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  verifiedText: {
    ...typography.small,
    color: colors.status.success,
    fontSize: 10,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  comment: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  responseContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  responseLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  responseText: {
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  responseDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionButtonActive: {
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.sm,
  },
  actionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  actionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
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
  inputLabel: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
  },
  deleteButtonText: {
    ...typography.bodyBold,
    color: colors.status.error,
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
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});






