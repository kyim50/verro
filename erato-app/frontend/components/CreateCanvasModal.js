import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

export default function CreateCanvasModal({
  visible,
  onClose,
  onCreateCanvas,
  canvasName,
  setCanvasName,
  isPublic,
  setIsPublic,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={28} color={colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Create Canvas</Text>
                  <View style={{ width: 28 }} />
                </View>

                <ScrollView
                  style={styles.formContainer}
                  contentContainerStyle={styles.formContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Canvas Preview Thumbnail */}
                  <View style={styles.preview}>
                    <View style={styles.previewGrid}>
                      <View style={styles.previewItem} />
                      <View style={styles.previewItem} />
                      <View style={styles.previewItem} />
                    </View>
                  </View>

                  {/* Canvas Name Input */}
                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Canvas Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Name your canvas"
                      placeholderTextColor={colors.text.disabled}
                      value={canvasName}
                      onChangeText={setCanvasName}
                      autoFocus
                    />
                  </View>

                  {/* Privacy Toggle */}
                  <TouchableOpacity
                    style={styles.privacyToggle}
                    onPress={() => setIsPublic(!isPublic)}
                  >
                    <View style={styles.toggleLeft}>
                      <Ionicons
                        name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                        size={20}
                        color={colors.text.primary}
                      />
                      <View>
                        <Text style={styles.toggleLabel}>
                          {isPublic ? 'Public' : 'Private'}
                        </Text>
                        <Text style={styles.toggleDescription}>
                          {isPublic ? 'Anyone can see this canvas' : 'Only you can see this canvas'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.switch, isPublic && styles.switchActive]}>
                      <View style={[styles.switchThumb, isPublic && styles.switchThumbActive]} />
                    </View>
                  </TouchableOpacity>

                  {/* Spacer */}
                  <View style={{ flex: 1 }} />

                  {/* Action Button */}
                  <View style={styles.footer}>
                    <TouchableOpacity
                      style={[styles.createButton, !canvasName.trim() && styles.createButtonDisabled]}
                      onPress={onCreateCanvas}
                      disabled={!canvasName.trim()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    height: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  preview: {
    alignSelf: 'center',
    marginBottom: spacing.xxl,
  },
  previewGrid: {
    width: 160,
    height: 160,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  previewItem: {
    width: '48%',
    height: '48%',
    backgroundColor: colors.border + '40',
    borderRadius: borderRadius.sm,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: 'transparent',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '600',
  },
  privacyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border + '60',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.background,
    ...shadows.small,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  footer: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  createButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});


