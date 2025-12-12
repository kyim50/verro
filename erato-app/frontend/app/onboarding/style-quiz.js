import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useAuthStore } from '../../store';

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;

const BUDGET_RANGES = [
  { id: 'budget-1', label: 'Under $50', min: 0, max: 50 },
  { id: 'budget-2', label: '$50 - $150', min: 50, max: 150 },
  { id: 'budget-3', label: '$150 - $500', min: 150, max: 500 },
  { id: 'budget-4', label: '$500+', min: 500, max: null },
];

const COMMISSION_FREQUENCIES = [
  { id: 'rarely', label: 'Rarely', subtitle: 'Once a year or less' },
  { id: 'occasionally', label: 'Occasionally', subtitle: '2-4 times a year' },
  { id: 'frequently', label: 'Frequently', subtitle: '5+ times a year' },
];

const INTERESTS = [
  { id: 'fantasy', label: 'Fantasy', icon: 'sparkles' },
  { id: 'portraits', label: 'Portraits', icon: 'person' },
  { id: 'landscapes', label: 'Landscapes', icon: 'image' },
  { id: 'characters', label: 'Characters', icon: 'body' },
  { id: 'animals', label: 'Animals', icon: 'paw' },
  { id: 'sci-fi', label: 'Sci-Fi', icon: 'rocket' },
  { id: 'horror', label: 'Horror', icon: 'skull' },
  { id: 'cute', label: 'Cute/Chibi', icon: 'heart' },
];

export default function StyleQuizScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [styles, setStyles] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  const STEPS = [
    {
      id: 'styles',
      title: 'What art styles do you love?',
      subtitle: 'Select all that appeal to you',
      icon: 'brush',
    },
    {
      id: 'interests',
      title: 'What are your interests?',
      subtitle: 'Choose your favorite themes',
      icon: 'heart',
    },
    {
      id: 'budget',
      title: 'What\'s your budget?',
      subtitle: 'Typical price range per commission',
      icon: 'cash',
    },
    {
      id: 'frequency',
      title: 'How often do you commission?',
      subtitle: 'This helps us personalize your feed',
      icon: 'calendar',
    },
  ];

  useEffect(() => {
    fetchStyles();
  }, []);

  const fetchStyles = async () => {
    try {
      const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/artists/styles/list`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch styles');

      const data = await response.json();
      setStyles(data.styles || []);
    } catch (error) {
      console.error('Error fetching styles:', error);
      Alert.alert('Error', 'Failed to load art styles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStyle = (styleId) => {
    setSelectedStyles(prev =>
      prev.includes(styleId)
        ? prev.filter(id => id !== styleId)
        : [...prev, styleId]
    );
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedStyles.length > 0;
      case 1: return selectedInterests.length > 0;
      case 2: return selectedBudget !== null;
      case 3: return selectedFrequency !== null;
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Quiz?',
      'You can always set your preferences later in settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => router.replace('/(tabs)/home'),
        },
      ]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/user-preferences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferred_styles: selectedStyles,
          interests: selectedInterests,
          budget_range: selectedBudget,
          commission_frequency: selectedFrequency,
          completed_quiz: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      Alert.alert(
        'All Set!',
        'Your preferences have been saved. We\'ll personalize your feed based on your tastes.',
        [
          {
            text: 'Start Exploring',
            onPress: () => router.replace('/(tabs)/home'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert(
        'Error',
        'Failed to save preferences. Would you like to skip for now?',
        [
          { text: 'Try Again', style: 'cancel' },
          {
            text: 'Skip',
            onPress: () => router.replace('/(tabs)/home'),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStyleItem = ({ item }) => {
    const isSelected = selectedStyles.includes(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.styleCard,
          isSelected && styles.styleCardSelected,
        ]}
        onPress={() => toggleStyle(item.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.styleCardCheckbox,
          isSelected && styles.styleCardCheckboxSelected,
        ]}>
          {isSelected && (
            <Ionicons name="checkmark" size={16} color={colors.background} />
          )}
        </View>
        <Text style={[
          styles.styleCardText,
          isSelected && styles.styleCardTextSelected,
        ]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderInterestItem = ({ item }) => {
    const isSelected = selectedInterests.includes(item.id);
    return (
      <TouchableOpacity
        style={[
          styles.interestCard,
          isSelected && styles.interestCardSelected,
        ]}
        onPress={() => toggleInterest(item.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.interestIconContainer,
          isSelected && styles.interestIconContainerSelected,
        ]}>
          <Ionicons
            name={item.icon}
            size={24}
            color={isSelected ? colors.background : colors.text.secondary}
          />
        </View>
        <Text style={[
          styles.interestLabel,
          isSelected && styles.interestLabelSelected,
        ]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBudgetItem = ({ item }) => {
    const isSelected = selectedBudget?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.optionCard,
          isSelected && styles.optionCardSelected,
        ]}
        onPress={() => setSelectedBudget(item)}
        activeOpacity={0.7}
      >
        <View style={styles.optionCardContent}>
          <View style={[
            styles.radioButton,
            isSelected && styles.radioButtonSelected,
          ]}>
            {isSelected && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={[
            styles.optionLabel,
            isSelected && styles.optionLabelSelected,
          ]}>
            {item.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFrequencyItem = ({ item }) => {
    const isSelected = selectedFrequency === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.optionCard,
          isSelected && styles.optionCardSelected,
        ]}
        onPress={() => setSelectedFrequency(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.optionCardContent}>
          <View style={[
            styles.radioButton,
            isSelected && styles.radioButtonSelected,
          ]}>
            {isSelected && <View style={styles.radioButtonInner} />}
          </View>
          <View style={styles.optionTextContainer}>
            <Text style={[
              styles.optionLabel,
              isSelected && styles.optionLabelSelected,
            ]}>
              {item.label}
            </Text>
            <Text style={styles.optionSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStepContent = () => {
    const step = STEPS[currentStep];

    if (loading && currentStep === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading art styles...</Text>
        </View>
      );
    }

    switch (step.id) {
      case 'styles':
        return (
          <FlatList
            data={styles}
            renderItem={renderStyleItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.styleRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        );

      case 'interests':
        return (
          <FlatList
            data={INTERESTS}
            renderItem={renderInterestItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.interestRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        );

      case 'budget':
        return (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {BUDGET_RANGES.map((item) => (
              <View key={item.id}>
                {renderBudgetItem({ item })}
              </View>
            ))}
          </ScrollView>
        );

      case 'frequency':
        return (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {COMMISSION_FREQUENCIES.map((item) => (
              <View key={item.id}>
                {renderFrequencyItem({ item })}
              </View>
            ))}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  const currentStepData = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <LinearGradient
      colors={[colors.background, colors.surface]}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerContent}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name={currentStepData.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.stepIndicator}>
              Step {currentStep + 1} of {STEPS.length}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{currentStepData.title}</Text>
        <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderStepContent()}
      </View>

      {/* Bottom Actions */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.buttonRow}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
              currentStep === 0 && styles.nextButtonFull,
            ]}
            onPress={handleNext}
            disabled={!canProceed() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {currentStep === STEPS.length - 1 ? 'Complete' : 'Next'}
                </Text>
                <Ionicons
                  name={currentStep === STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
                  size={20}
                  color={colors.text.primary}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  stepIndicator: {
    ...typography.small,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  titleContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: IS_SMALL_SCREEN ? 22 : 26,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  styleRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  styleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  styleCardSelected: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  styleCardCheckbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  styleCardCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleCardText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
  },
  styleCardTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  interestRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  interestCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.small,
  },
  interestCardSelected: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  interestIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestIconContainerSelected: {
    backgroundColor: colors.primary,
  },
  interestLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 12 : 13,
  },
  interestLabelSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardSelected: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  optionCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    ...typography.button,
    color: colors.text.secondary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flex: 2,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
