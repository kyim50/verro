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
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
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
  const [activeCategory, setActiveCategory] = useState('all'); // Category filter

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
      // Collect additional data for better matching
      const preferencesData = {
        preferred_styles: selectedStyles,
        price_range_min: priceRange.min ? parseFloat(priceRange.min) : undefined,
        price_range_max: priceRange.max ? parseFloat(priceRange.max) : undefined,
        preferred_turnaround_days: turnaroundDays ? parseInt(turnaroundDays) : undefined,
        match_algorithm: 'weighted',
        // Additional metadata for better data collection
        quiz_completed_at: new Date().toISOString(),
        styles_count: selectedStyles.length,
        has_price_preference: !!(priceRange.min || priceRange.max),
        has_turnaround_preference: !!turnaroundDays,
      };
      
      await axios.post(
        `${API_URL}/artists/preferences/quiz`,
        preferencesData,
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
    setActiveCategory('all'); // Reset category filter
    onClose();
  };

  // Categorize styles into sections
  const categorizeStyles = (styles) => {
    const categories = {
      all: { label: 'All Styles', styles: styles },
      mediums: { 
        label: 'Mediums & Techniques', 
        styles: styles.filter(s => 
          ['Watercolor', 'Oil Painting', 'Acrylic', 'Digital Painting', 'Digital Art', 
           'Vector', 'Pixel Art', '3D Rendering', '3D Modeling', '3D Character', 
           'Sculpture', 'ZBrush', 'Blender', 'Pen & Ink', 'Ink', 'Pencil', 'Charcoal', 
           'Marker', 'Colored Pencil', 'Pastel', 'Gouache', 'Calligraphy', 'Typography',
           'Hard Shading', 'Soft Shading', 'Cell Shading', 'Painterly', 'Rendered',
           'Low Poly', 'Isometric', 'Technical Drawing', 'Concept Art'].includes(s.name)
        )
      },
      artStyles: {
        label: 'Art Styles',
        styles: styles.filter(s =>
          ['Anime', 'Manga', 'Manhwa', 'Manhua', 'Webtoon', 'Cartoon', 'Western Cartoon',
           'Disney Style', 'Pixar Style', 'Chibi', 'Kawaii', 'Moe', 'Anime Realistic',
           'Realism', 'Semi-Realistic', 'Abstract', 'Minimalist',
           'Impressionism', 'Expressionism', 'Surrealism', 'Cubism', 'Pop Art',
           'Art Deco', 'Art Nouveau', 'Contemporary', 'Modern Art', 'Gothic',
           'Victorian', 'Medieval', 'Steampunk', 'Cyberpunk', 'Synthwave', 'Vaporwave',
           'Glitch Art', 'Gradient Art', 'Flat Design', 'Monochrome', 'Full Color'].includes(s.name)
        )
      },
      themes: {
        label: 'Themes & Genres',
        styles: styles.filter(s =>
          ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Horror', 'Space', 'Nature', 'Animal',
           'Pet Portrait', 'Portrait', 'Landscape', 'Still Life', 'Botanical',
           'Post-Apocalyptic', 'Steampunk', 'Cyberpunk', 'Western', 'Medieval',
           'Victorian', 'Gothic', 'Japanese', 'Korean', 'Chinese', 'American',
           'European'].includes(s.name)
        )
      },
      character: {
        label: 'Character & Design',
        styles: styles.filter(s =>
          ['Character Design', 'Concept Art', 'Illustration', 'Comic Book',
           'Logo Design', 'Tattoo Design', 'Architectural', 'Medical Illustration',
           'Furry', 'Kemono', 'SFW', 'NSFW'].includes(s.name)
        )
      },
    };
    return categories;
  };

  const renderStep1 = () => {
    const categories = categorizeStyles(artStyles);
    const currentCategory = categories[activeCategory] || categories.all;
    const displayedStyles = currentCategory.styles;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>What art styles do you like?</Text>
        <Text style={styles.stepDescription}>
          Select all styles you're interested in. You can prioritize them later.
          {artStyles.length > 0 && ` (${artStyles.length} styles available)`}
        </Text>

        {/* Category Tabs - Filter Style with Red Underline */}
        {!loading && artStyles.length > 0 && (
          <View style={styles.filterBar}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {Object.entries(categories).map(([key, category]) => {
                const isSelected = activeCategory === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.filterItem}
                    onPress={() => setActiveCategory(key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        isSelected && styles.filterTextActive
                      ]}
                    >
                      {category.label}
                      {category.styles.length > 0 && ` (${category.styles.length})`}
                    </Text>
                    {isSelected && <View style={styles.filterUnderline} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <ScrollView 
            style={styles.stylesScrollView}
            contentContainerStyle={styles.stylesGrid}
            showsVerticalScrollIndicator={false}
          >
            {displayedStyles.length === 0 ? (
              <View style={styles.emptyCategory}>
                <Text style={styles.emptyCategoryText}>
                  No styles in this category
                </Text>
              </View>
            ) : (
              displayedStyles.map((style) => {
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
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {style.name}
                </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.background}
                        style={styles.styleCheckIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    );
  };

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
  // Filter Bar Style (matching app's Pinterest filter tabs)
  filterBar: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  filterItem: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  filterText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  filterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  stylesScrollView: {
    flex: 1,
    maxHeight: 450, // Limit height so it scrolls
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.xl, // Extra padding for scroll
  },
  emptyCategory: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCategoryText: {
    ...typography.body,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  styleCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.small,
  },
  styleCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  styleCardText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 16,
    flex: 1,
  },
  styleCardTextSelected: {
    color: colors.background, // Use background color for better contrast on primary background
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





