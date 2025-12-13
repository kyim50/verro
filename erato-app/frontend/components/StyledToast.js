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
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
          </View>
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
          <View style={styles.iconContainer}>
            <Ionicons name="close-circle" size={18} color={colors.status.error} />
          </View>
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
          <View style={styles.iconContainer}>
            <Ionicons name="information-circle" size={18} color={colors.status.info} />
          </View>
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
    justifyContent: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    maxWidth: '100%',
    ...shadows.small,
    elevation: 4,
  },
  iconContainer: {
    width: 18,
    height: 18,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 18,
    alignSelf: 'center',
  },
});

export default toastConfig;
