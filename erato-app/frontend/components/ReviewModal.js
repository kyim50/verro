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
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, DEFAULT_AVATAR } from '../constants/theme';

export default function ReviewModal({
  visible,
  onClose,
  onSubmit,
  userName,
  userAvatar,
  reviewType = 'client_to_artist' // 'client_to_artist' or 'artist_to_client'
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({
        type: 'info',
        text1: 'Rating Required',
        text2: 'Please select a star rating',
        visibilityTime: 2000,
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim() || null);
      // Reset form
      setRating(0);
      setComment('');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to submit review',
        visibilityTime: 3000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

  const isArtistReview = reviewType === 'artist_to_client';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Leave a Review</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <View style={styles.userSection}>
              <Image
                source={{ uri: userAvatar || DEFAULT_AVATAR }}
                style={styles.userAvatar}
                contentFit="cover"
              />
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userRole}>
                {isArtistReview ? 'Client' : 'Artist'}
              </Text>
            </View>

            {/* Star Rating - Pinterest style: Clean, large, interactive */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={44}
                    color={star <= rating ? colors.status.warning : colors.text.disabled}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {rating === 5 && '✨ Excellent!'}
                {rating === 4 && '😊 Great!'}
                {rating === 3 && '👍 Good'}
                {rating === 2 && '😐 Fair'}
                {rating === 1 && '😕 Poor'}
              </Text>
            )}

            {/* Comment - Pinterest style: Clean textarea */}
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>
                Share your experience <Text style={styles.optional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder="What did you like? What could be improved?"
                placeholderTextColor={colors.text.disabled}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{comment.length}/500</Text>
            </View>

            {/* Actions - Pinterest style: Primary CTA button */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  rating === 0 && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting || rating === 0}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={styles.skipButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  userAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  userName: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  userRole: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  starButton: {
    padding: spacing.xs,
  },
  ratingLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    textAlign: 'center',
    fontSize: 17,
    marginBottom: spacing.xl,
  },
  commentSection: {
    marginBottom: spacing.xl,
  },
  commentLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  optional: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '400',
    fontSize: 14,
  },
  commentInput: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
    fontSize: 12,
  },
  actions: {
    gap: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 4,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 56,
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
    shadowOpacity: 0,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.background,
    fontWeight: '700',
    fontSize: 17,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.button,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
