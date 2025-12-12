import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;

export default function ModalHeader({ title, onClose, rightAction }) {
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{title}</Text>
      <View style={styles.modalHeaderRight}>
        {rightAction}
        <TouchableOpacity
          onPress={onClose}
          style={styles.modalCloseButton}
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md + spacing.xs : spacing.lg,
    paddingTop: IS_SMALL_SCREEN ? spacing.md + spacing.xs : spacing.lg,
    paddingBottom: IS_SMALL_SCREEN ? spacing.md : spacing.md + spacing.xs,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
    fontWeight: '700',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
