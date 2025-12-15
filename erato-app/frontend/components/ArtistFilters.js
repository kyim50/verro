import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ArtistFilters({ visible, onClose, filters, onApplyFilters, token }) {
  const insets = useSafeAreaInsets();
  const [localFilters, setLocalFilters] = useState(filters || {});
  const [artStyles, setArtStyles] = useState([]);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    styles: true,
    price: false,
    turnaround: false,
    language: false,
  });

  useEffect(() => {
    if (visible) {
      loadArtStyles();
      setLocalFilters(filters || {});
    }
  }, [visible]);

  const loadArtStyles = async () => {
    setLoadingStyles(true);
    try {
      const response = await axios.get(`${API_URL}/artists/styles/list`);
      setArtStyles(response.data.styles || []);
    } catch (error) {
      console.error('Error loading art styles:', error);
    } finally {
      setLoadingStyles(false);
    }
  };

  const toggleStyle = (styleId) => {
    const currentStyles = localFilters.styles || [];
    if (currentStyles.includes(styleId)) {
      setLocalFilters({
        ...localFilters,
        styles: currentStyles.filter(id => id !== styleId)
      });
    } else {
      setLocalFilters({
        ...localFilters,
        styles: [...currentStyles, styleId]
      });
    }
  };

  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({});
    onApplyFilters({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filter Artists</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Art Styles */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('styles')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Art Styles</Text>
                </View>
                <Ionicons
                  name={expandedSections.styles ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {expandedSections.styles && (
                <View style={styles.sectionBody}>
                  {loadingStyles ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={styles.chipContainer}>
                      {artStyles.map((style) => {
                        const isSelected = localFilters.styles?.includes(style.id);
                        return (
                          <TouchableOpacity
                            key={style.id}
                            style={[
                              styles.chip,
                              isSelected && styles.chipSelected
                            ]}
                            onPress={() => toggleStyle(style.id)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                isSelected && styles.chipTextSelected
                              ]}
                            >
                              {style.name}
                            </Text>
                            {isSelected && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color={colors.text.primary}
                                style={styles.chipIcon}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Price Range */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('price')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="cash-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Price Range</Text>
                </View>
                <Ionicons
                  name={expandedSections.price ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {expandedSections.price && (
                <View style={styles.sectionBody}>
                  <View style={styles.priceInputs}>
                    <View style={styles.priceInputGroup}>
                      <Text style={styles.priceLabel}>Min ($)</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localFilters.price_min?.toString() || ''}
                        onChangeText={(text) => {
                          const num = text === '' ? undefined : parseFloat(text);
                          setLocalFilters({
                            ...localFilters,
                            price_min: isNaN(num) ? undefined : num
                          });
                        }}
                        placeholder="0"
                        placeholderTextColor={colors.text.disabled}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.priceSeparator}>
                      <Text style={styles.priceSeparatorText}>to</Text>
                    </View>
                    <View style={styles.priceInputGroup}>
                      <Text style={styles.priceLabel}>Max ($)</Text>
                      <TextInput
                        style={styles.priceInput}
                        value={localFilters.price_max?.toString() || ''}
                        onChangeText={(text) => {
                          const num = text === '' ? undefined : parseFloat(text);
                          setLocalFilters({
                            ...localFilters,
                            price_max: isNaN(num) ? undefined : num
                          });
                        }}
                        placeholder="1000"
                        placeholderTextColor={colors.text.disabled}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Turnaround Time */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('turnaround')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="time-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Max Turnaround</Text>
                </View>
                <Ionicons
                  name={expandedSections.turnaround ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {expandedSections.turnaround && (
                <View style={styles.sectionBody}>
                  <TextInput
                    style={styles.turnaroundInput}
                    value={localFilters.turnaround_max?.toString() || ''}
                    onChangeText={(text) => {
                      const num = text === '' ? undefined : parseInt(text);
                      setLocalFilters({
                        ...localFilters,
                        turnaround_max: isNaN(num) ? undefined : num
                      });
                    }}
                    placeholder="e.g., 14 (days)"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                  <Text style={styles.turnaroundHint}>
                    Show artists who deliver within this many days
                  </Text>
                </View>
              )}
            </View>

            {/* Language */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('language')}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="language-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Language</Text>
                </View>
                <Ionicons
                  name={expandedSections.language ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>

              {expandedSections.language && (
                <View style={styles.sectionBody}>
                  <TextInput
                    style={styles.languageInput}
                    value={localFilters.language || ''}
                    onChangeText={(text) => {
                      setLocalFilters({
                        ...localFilters,
                        language: text || undefined
                      });
                    }}
                    placeholder="e.g., English, Spanish, Japanese"
                    placeholderTextColor={colors.text.disabled}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.7}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: '90%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  section: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    minHeight: 36,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.text.primary,
  },
  chipIcon: {
    marginLeft: spacing.xs,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  priceInputGroup: {
    flex: 1,
  },
  priceLabel: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: '600',
  },
  priceInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    fontSize: 16,
    minHeight: 48,
  },
  priceSeparator: {
    paddingBottom: spacing.md,
  },
  priceSeparatorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  turnaroundInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontSize: 16,
    minHeight: 48,
  },
  turnaroundHint: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 11,
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  languageInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
    fontSize: 16,
    minHeight: 48,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});









