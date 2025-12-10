import { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

export default function ReviewModal({ 
  visible, 
  onClose, 
  onSubmit, 
  userName, 
  userAvatar,
  reviewType = 'client_to_artist' // 'client_to_artist' or 'artist_to_client'
}) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim() || null);
      // Reset form
      setRating(0);
      setComment('');
      setHoveredRating(0);
      onClose();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (rating === 0) {
      Alert.alert(
        'Skip Review?',
        'You can review later if you change your mind.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip',
            onPress: () => {
              setRating(0);
              setComment('');
              setHoveredRating(0);
              onClose();
            },
          },
        ]
      );
    } else {
      setRating(0);
      setComment('');
      setHoveredRating(0);
      onClose();
    }
  };

  const displayRating = hoveredRating || rating;
  const isArtistReview = reviewType === 'artist_to_client';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlayInner}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContainer}>
                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentInner}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Header */}
                  <View style={styles.header}>
                    <Text style={styles.title}>
                      {isArtistReview ? 'Review Client' : 'Review Artist'}
                    </Text>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* User Info */}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{userName}</Text>
                    <Text style={styles.subtitle}>
                      How would you rate your experience working with {isArtistReview ? 'this client' : 'this artist'}?
                    </Text>
                  </View>

                  {/* Star Rating */}
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        onPressIn={() => setHoveredRating(star)}
                        onPressOut={() => setHoveredRating(0)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={star <= displayRating ? "star" : "star-outline"}
                          size={48}
                          color={star <= displayRating ? colors.status.warning : colors.text.disabled}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  {rating > 0 && (
                    <Text style={styles.ratingText}>
                      {rating === 5 && 'Excellent!'}
                      {rating === 4 && 'Great!'}
                      {rating === 3 && 'Good'}
                      {rating === 2 && 'Fair'}
                      {rating === 1 && 'Poor'}
                    </Text>
                  )}

                  {/* Comment Input */}
                  <View style={styles.commentContainer}>
                    <Text style={styles.commentLabel}>Share your experience (optional)</Text>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Tell others about your experience..."
                      placeholderTextColor={colors.text.disabled}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>{comment.length}/500</Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.button, styles.skipButton]}
                      onPress={handleClose}
                      disabled={submitting}
                    >
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.submitButton,
                        rating === 0 && styles.submitButtonDisabled,
                      ]}
                      onPress={handleSubmit}
                      disabled={submitting || rating === 0}
                    >
                      {submitting ? (
                        <Text style={styles.submitButtonText}>Submitting...</Text>
                      ) : (
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    ...shadows.large,
  },
  modalContentInner: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  userName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 14,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
  ratingText: {
    ...typography.bodyBold,
    color: colors.primary,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: spacing.md,
  },
  commentContainer: {
    marginBottom: spacing.lg,
  },
  commentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  commentInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipButtonText: {
    ...typography.button,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
  },
});



