import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const PRESET_TIPS = [5, 10, 20, 50];

export default function TipJar({ visible, onClose, onTip, commission }) {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  const handleTip = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    if (amount && amount > 0) {
      onTip(amount);
      setSelectedAmount(null);
      setCustomAmount('');
    }
  };

  const handlePresetSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text) => {
    setCustomAmount(text);
    setSelectedAmount(null);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="heart" size={32} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Tip the Artist</Text>
            <Text style={styles.modalDescription}>
              Show your appreciation for their amazing work!
            </Text>
          </View>

          <View style={styles.presetContainer}>
            <Text style={styles.sectionTitle}>Quick Tip</Text>
            <View style={styles.presetGrid}>
              {PRESET_TIPS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.presetButton,
                    selectedAmount === amount && styles.presetButtonSelected,
                  ]}
                  onPress={() => handlePresetSelect(amount)}
                >
                  <Text style={[
                    styles.presetText,
                    selectedAmount === amount && styles.presetTextSelected
                  ]}>
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.customContainer}>
            <Text style={styles.sectionTitle}>Custom Amount</Text>
            <View style={styles.customInputContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.customInput}
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                placeholder="0.00"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tipButton,
                (!selectedAmount && !customAmount) && styles.tipButtonDisabled
              ]}
              onPress={handleTip}
              disabled={!selectedAmount && !customAmount}
            >
              <Ionicons name="heart" size={18} color={colors.text.primary} />
              <Text style={styles.tipButtonText}>
                Tip ${selectedAmount || customAmount || '0.00'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  modalDescription: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  presetContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetButton: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  presetButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  presetText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  presetTextSelected: {
    color: colors.primary,
  },
  customContainer: {
    marginBottom: spacing.lg,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  customInput: {
    flex: 1,
    paddingVertical: spacing.md,
    ...typography.h3,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
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
  tipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  tipButtonDisabled: {
    opacity: 0.5,
  },
  tipButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});




