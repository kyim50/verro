import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function StylePreferenceQuiz({ visible, onClose, token, onComplete }) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [artStyles, setArtStyles] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]); // Array of { style_id, weight }
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [turnaroundDays, setTurnaroundDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadArtStyles();
      loadExistingPreferences();
    }
  }, [visible]);

  const loadArtStyles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/artists/styles/list`);
      setArtStyles(response.data.styles || []);
    } catch (error) {
      console.error('Error loading art styles:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load art styles',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPreferences = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/artists/preferences/quiz`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        const prefs = response.data;
        if (prefs.preferred_styles) {
          setSelectedStyles(prefs.preferred_styles);
        }
        if (prefs.price_range_min) {
          setPriceRange(prev => ({ ...prev, min: prefs.price_range_min.toString() }));
        }
        if (prefs.price_range_max) {
          setPriceRange(prev => ({ ...prev, max: prefs.price_range_max.toString() }));
        }
        if (prefs.preferred_turnaround_days) {
          setTurnaroundDays(prefs.preferred_turnaround_days.toString());
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const toggleStyle = (styleId) => {
    const existing = selectedStyles.find(s => s.style_id === styleId);
    if (existing) {
      setSelectedStyles(selectedStyles.filter(s => s.style_id !== styleId));
    } else {
      setSelectedStyles([...selectedStyles, { style_id: styleId, weight: 1 }]);
    }
  };

  const updateStyleWeight = (styleId, weight) => {
    setSelectedStyles(selectedStyles.map(s =>
      s.style_id === styleId ? { ...s, weight: Math.max(1, Math.min(5, weight)) } : s
    ));
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedStyles.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'Select at least one style',
        text2: 'Please select your preferred art styles',
      });
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!token) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please log in to save preferences',
      });
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/artists/preferences/quiz`,
        {
          preferred_styles: selectedStyles,
          price_range_min: priceRange.min ? parseFloat(priceRange.min) : undefined,
          price_range_max: priceRange.max ? parseFloat(priceRange.max) : undefined,
          preferred_turnaround_days: turnaroundDays ? parseInt(turnaroundDays) : undefined,
          match_algorithm: 'weighted',
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      Toast.show({
        type: 'success',
        text1: 'Preferences saved!',
        text2: 'We\'ll use these to find perfect artists for you',
      });

      if (onComplete) {
        onComplete();
      }
      handleClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to save preferences',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setSelectedStyles([]);
    setPriceRange({ min: '', max: '' });
    setTurnaroundDays('');
    onClose();
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What art styles do you like?</Text>
      <Text style={styles.stepDescription}>
        Select all styles you're interested in. You can prioritize them later.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <View style={styles.stylesGrid}>
          {artStyles.map((style) => {
            const isSelected = selectedStyles.some(s => s.style_id === style.id);
            return (
              <TouchableOpacity
                key={style.id}
                style={[
                  styles.styleCard,
                  isSelected && styles.styleCardSelected
                ]}
                onPress={() => toggleStyle(style.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.styleCardText,
                    isSelected && styles.styleCardTextSelected
                  ]}
                >
                  {style.name}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.text.primary}
                    style={styles.styleCheckIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Prioritize your styles</Text>
      <Text style={styles.stepDescription}>
        Rate how important each style is to you (1-5)
      </Text>

      <ScrollView style={styles.priorityList}>
        {selectedStyles.map((selected, index) => {
          const style = artStyles.find(s => s.id === selected.style_id);
          if (!style) return null;

          return (
            <View key={selected.style_id} style={styles.priorityItem}>
              <Text style={styles.priorityLabel}>{style.name}</Text>
              <View style={styles.priorityControls}>
                <TouchableOpacity
                  style={styles.priorityButton}
                  onPress={() => updateStyleWeight(selected.style_id, selected.weight - 1)}
                  disabled={selected.weight <= 1}
                >
                  <Ionicons
                    name="remove-circle-outline"
                    size={24}
                    color={selected.weight <= 1 ? colors.text.disabled : colors.primary}
                  />
                </TouchableOpacity>
                <Text style={styles.priorityValue}>{selected.weight}</Text>
                <TouchableOpacity
                  style={styles.priorityButton}
                  onPress={() => updateStyleWeight(selected.style_id, selected.weight + 1)}
                  disabled={selected.weight >= 5}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={selected.weight >= 5 ? colors.text.disabled : colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Budget & Timeline</Text>
      <Text style={styles.stepDescription}>
        Help us find artists that fit your needs
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Price Range (optional)</Text>
        <View style={styles.priceInputs}>
          <View style={styles.priceInputGroup}>
            <TextInput
              style={styles.priceInput}
              value={priceRange.min}
              onChangeText={(text) => setPriceRange(prev => ({ ...prev, min: text }))}
              placeholder="Min $"
              placeholderTextColor={colors.text.disabled}
              keyboardType="numeric"
            />
          </View>
          <Text style={styles.priceSeparator}>to</Text>
          <View style={styles.priceInputGroup}>
            <TextInput
              style={styles.priceInput}
              value={priceRange.max}
              onChangeText={(text) => setPriceRange(prev => ({ ...prev, max: text }))}
              placeholder="Max $"
              placeholderTextColor={colors.text.disabled}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Preferred Turnaround (days, optional)</Text>
        <TextInput
          style={styles.turnaroundInput}
          value={turnaroundDays}
          onChangeText={setTurnaroundDays}
          placeholder="e.g., 14"
          placeholderTextColor={colors.text.disabled}
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  const steps = [
    { title: 'Select Styles', component: renderStep1 },
    { title: 'Prioritize', component: renderStep2 },
    { title: 'Preferences', component: renderStep3 },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Style Preference Quiz</Text>
            <Text style={styles.headerSubtitle}>
              Step {currentStep + 1} of {steps.length}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentStep + 1) / steps.length) * 100}%` }
            ]}
          />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {steps[currentStep].component()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {currentStep < steps.length - 1 ? (
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, saving && styles.nextButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.primary} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>Save Preferences</Text>
                  <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.surface,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  loader: {
    marginTop: spacing.xl,
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  styleCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  styleCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleCardText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 16,
  },
  styleCardTextSelected: {
    color: colors.text.primary,
  },
  styleCheckIcon: {
    marginLeft: spacing.xs,
  },
  priorityList: {
    marginTop: spacing.md,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  priorityLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    flex: 1,
  },
  priorityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priorityButton: {
    padding: spacing.xs,
  },
  priorityValue: {
    ...typography.h3,
    color: colors.primary,
    fontSize: 20,
    minWidth: 30,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priceInputGroup: {
    flex: 1,
  },
  priceInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceSeparator: {
    ...typography.body,
    color: colors.text.secondary,
  },
  turnaroundInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
});




