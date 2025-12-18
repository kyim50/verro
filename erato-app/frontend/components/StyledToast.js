import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

/**
 * Pinterest-style Toast component - Clean, rounded, with soft shadows
 * Content-first design with subtle colors and clear hierarchy
 */
const toastConfig = {
  success: (props) => {
    const text1 = String(props?.text1 || 'Success');
    const text2 = String(props?.text2 || '');

    return (
      <View style={styles.pinterestToastContainer}>
        <View style={[styles.pinterestToast, styles.pinterestToastSuccess]}>
          <View style={styles.pinterestIconBg}>
            <Ionicons name="checkmark-circle" size={20} color="#00A36C" />
          </View>
          <View style={styles.pinterestTextContainer}>
            <Text style={styles.pinterestToastTitle}>{text1}</Text>
            {text2 ? <Text style={styles.pinterestToastMessage}>{text2}</Text> : null}
          </View>
        </View>
      </View>
    );
  },

  error: (props) => {
    const text1 = String(props?.text1 || 'Error');
    const text2 = String(props?.text2 || '');

    return (
      <View style={styles.pinterestToastContainer}>
        <View style={[styles.pinterestToast, styles.pinterestToastError]}>
          <View style={styles.pinterestIconBg}>
            <Ionicons name="close-circle" size={20} color="#E60023" />
          </View>
          <View style={styles.pinterestTextContainer}>
            <Text style={styles.pinterestToastTitle}>{text1}</Text>
            {text2 ? <Text style={styles.pinterestToastMessage}>{text2}</Text> : null}
          </View>
        </View>
      </View>
    );
  },

  info: (props) => {
    const text1 = String(props?.text1 || 'Info');
    const text2 = String(props?.text2 || '');

    return (
      <View style={styles.pinterestToastContainer}>
        <View style={[styles.pinterestToast, styles.pinterestToastInfo]}>
          <View style={styles.pinterestIconBg}>
            <Ionicons name="information-circle" size={20} color="#0095F6" />
          </View>
          <View style={styles.pinterestTextContainer}>
            <Text style={styles.pinterestToastTitle}>{text1}</Text>
            {text2 ? <Text style={styles.pinterestToastMessage}>{text2}</Text> : null}
          </View>
        </View>
      </View>
    );
  },
};

const styles = StyleSheet.create({
  // Pinterest-style Toast Styles
  pinterestToastContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  pinterestToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 380,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pinterestToastSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: '#00A36C',
  },
  pinterestToastError: {
    borderLeftWidth: 4,
    borderLeftColor: '#E60023',
  },
  pinterestToastInfo: {
    borderLeftWidth: 4,
    borderLeftColor: '#0095F6',
  },
  pinterestIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  pinterestTextContainer: {
    flex: 1,
    gap: spacing.xs - 2,
  },
  pinterestToastTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    lineHeight: 20,
  },
  pinterestToastMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5F5F5F',
    lineHeight: 18,
  },
});

export default toastConfig;
