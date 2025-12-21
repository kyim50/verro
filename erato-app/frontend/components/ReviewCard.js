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

export default function ReviewCard({ review, isArtist = false, onUpdate, showingGivenReviews = false }) {
  const { token, user } = useAuthStore();
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseText, setResponseText] = useState(review.artist_response || '');
  const [submitting, setSubmitting] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count || 0);
  const [userMarkedHelpful, setUserMarkedHelpful] = useState(review.userMarkedHelpful || false);
  const [togglingHelpful, setTogglingHelpful] = useState(false);

  // Determine who left the review
  const isClientReview = review.review_type === 'client_to_artist';

  // Get reviewer info based on context
  // If showing "given" reviews, show who received the review
  // If showing "received" reviews, show who gave the review
  let reviewer;
  if (showingGivenReviews) {
    // Show the person who received the review
    reviewer = isClientReview
      ? (review.artist || review.artists)
      : (review.client || review.clients);
  } else {
    // Show the person who gave the review
    reviewer = isClientReview
      ? (review.client || review.clients)
      : (review.artist || review.artists);
  }

  const reviewerName = reviewer?.users?.full_name || reviewer?.users?.username || reviewer?.full_name || reviewer?.username || 'Anonymous';
  const reviewerAvatar = reviewer?.users?.avatar_url || reviewer?.users?.profile_picture || reviewer?.avatar_url || reviewer?.profile_picture || DEFAULT_AVATAR;

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
        await axios.put(
          `${API_URL}/review-enhancements/${review.id}/respond`,
          { response: responseText.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.reviewerInfo}>
            <Image
              source={{ uri: reviewerAvatar }}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={styles.reviewerDetails}>
              <Text style={styles.reviewerName} numberOfLines={1}>
                {reviewerName}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
                {review.verified_commission && (
                  <>
                    <Text style={styles.dot}>•</Text>
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Stars */}
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= review.rating ? 'star' : 'star-outline'}
                size={18}
                color={colors.status.warning}
              />
            ))}
          </View>
        </View>

        {/* Comment */}
        {review.comment && (
          <Text style={styles.comment}>{review.comment}</Text>
        )}

        {/* Artist Response */}
        {review.artist_response && (
          <View style={styles.responseContainer}>
            <View style={styles.responseHeader}>
              <Ionicons name="chatbubble" size={14} color={colors.primary} />
              <Text style={styles.responseLabel}>Response</Text>
            </View>
            <Text style={styles.responseText}>{review.artist_response}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleToggleHelpful}
            disabled={togglingHelpful || !token}
          >
            <Ionicons
              name={userMarkedHelpful ? 'thumbs-up' : 'thumbs-up-outline'}
              size={18}
              color={userMarkedHelpful ? colors.primary : colors.text.disabled}
            />
            {helpfulCount > 0 && (
              <Text style={[styles.actionText, userMarkedHelpful && styles.actionTextActive]}>
                {helpfulCount}
              </Text>
            )}
          </TouchableOpacity>

          {isArtist && review.review_type === 'client_to_artist' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowResponseModal(true)}
            >
              <Ionicons
                name={review.artist_response ? 'create-outline' : 'chatbubble-outline'}
                size={18}
                color={colors.text.secondary}
              />
              <Text style={styles.actionText}>
                {review.artist_response ? 'Edit' : 'Respond'}
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
                {review.artist_response ? 'Edit Response' : 'Respond'}
              </Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Ionicons name="close" size={26} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.textArea}
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Thank your client for their feedback..."
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
                  <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitResponse}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.background} />
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
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  dot: {
    color: colors.text.disabled,
    fontSize: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  verifiedText: {
    ...typography.caption,
    color: colors.status.success,
    fontSize: 12,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  comment: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  responseContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  responseText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border + '30',
    minHeight: 140,
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.sm,
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});









