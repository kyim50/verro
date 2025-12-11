import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

/**
 * Clean, minimal Toast component styled to match the app theme
 * Simple approach: render text directly without complex wrapping
 */
const toastConfig = {
  success: (props) => {
    const text1 = String(props?.text1 || 'Success');
    const text2 = String(props?.text2 || '');
    const fullText = text2 ? `${text1}: ${text2}` : text1;
    
    return (
      <View style={styles.toastContainer}>
        <View style={styles.toastContent}>
          <Ionicons name="checkmark-circle" size={20} color={colors.status.success} style={styles.icon} />
          <Text style={styles.toastText}>{fullText}</Text>
        </View>
      </View>
    );
  },

  error: (props) => {
    const text1 = String(props?.text1 || 'Error');
    const text2 = String(props?.text2 || '');
    const fullText = text2 ? `${text1}: ${text2}` : text1;
    
    return (
      <View style={styles.toastContainer}>
        <View style={styles.toastContent}>
          <Ionicons name="close-circle" size={20} color={colors.status.error} style={styles.icon} />
          <Text style={styles.toastText}>{fullText}</Text>
        </View>
      </View>
    );
  },

  info: (props) => {
    const text1 = String(props?.text1 || 'Info');
    const text2 = String(props?.text2 || '');
    const fullText = text2 ? `${text1}: ${text2}` : text1;
    
    return (
      <View style={styles.toastContainer}>
        <View style={styles.toastContent}>
          <Ionicons name="information-circle" size={20} color={colors.status.info} style={styles.icon} />
          <Text style={styles.toastText}>{fullText}</Text>
        </View>
      </View>
    );
  },
};

const styles = StyleSheet.create({
  toastContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    maxWidth: '100%',
    ...shadows.medium,
    elevation: 6,
  },
  icon: {
    marginRight: spacing.sm,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
});

export default toastConfig;
