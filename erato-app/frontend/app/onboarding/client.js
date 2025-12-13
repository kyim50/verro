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
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { useAuthStore } from '../../store';

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;

const QUIZ_STEPS = [
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
  { id: 'nature', label: 'Nature', icon: 'leaf' },
  { id: 'abstract', label: 'Abstract', icon: 'color-palette' },
  { id: 'realistic', label: 'Realistic', icon: 'camera' },
  { id: 'anime', label: 'Anime', icon: 'tv' },
  { id: 'comics', label: 'Comics', icon: 'book' },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt' },
  { id: 'architecture', label: 'Architecture', icon: 'business' },
];

export default function ClientOnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [artStyles, setArtStyles] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all'); // Category filter for styles
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();

  const currentStepData = QUIZ_STEPS[currentStep];
  const progress = ((currentStep + 1) / QUIZ_STEPS.length) * 100;

  useEffect(() => {
    if (currentStep === 0) {
      fetchArtStyles();
    }
  }, [currentStep]);

  const fetchArtStyles = async () => {
    try {
      setLoading(true);
      const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${API_URL}/artists/styles/list`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch styles: ${response.status}`);
      }

      const data = await response.json();
      const stylesList = data.styles || data.data || [];
      
      if (stylesList.length === 0) {
        const fallbackStyles = [
          { id: '1', name: 'Anime', slug: 'anime' },
          { id: '2', name: 'Realism', slug: 'realism' },
          { id: '3', name: 'Cartoon', slug: 'cartoon' },
          { id: '4', name: 'Fantasy', slug: 'fantasy' },
          { id: '5', name: 'Digital Art', slug: 'digital-art' },
        ];
        setArtStyles(fallbackStyles);
        return;
      }
      setArtStyles(stylesList);
    } catch (error) {
      console.error('Error fetching styles:', error);
      const fallbackStyles = [
        { id: '1', name: 'Anime', slug: 'anime' },
        { id: '2', name: 'Realism', slug: 'realism' },
        { id: '3', name: 'Cartoon', slug: 'cartoon' },
        { id: '4', name: 'Fantasy', slug: 'fantasy' },
        { id: '5', name: 'Digital Art', slug: 'digital-art' },
      ];
      setArtStyles(fallbackStyles);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < QUIZ_STEPS.length - 1) {
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
        { text: 'Skip', onPress: () => router.replace('/(tabs)/home') },
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

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'All Set!',
        text2: 'Your preferences have been saved. We\'ll personalize your feed based on your tastes.',
        visibilityTime: 2500,
        onHide: () => {
          router.replace('/(tabs)/home');
        },
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert(
        'Error',
        'Failed to save preferences. Would you like to skip for now?',
        [
          { text: 'Try Again', style: 'cancel' },
          { text: 'Skip', onPress: () => router.replace('/(tabs)/home') },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Categorize styles into sections
  const categorizeStyles = (styles) => {
    const categories = {
      all: { label: 'All', styles: styles },
      mediums: { 
        label: 'Mediums', 
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
        label: 'Themes',
        styles: styles.filter(s =>
          ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Horror', 'Space', 'Nature', 'Animal',
           'Pet Portrait', 'Portrait', 'Landscape', 'Still Life', 'Botanical',
           'Post-Apocalyptic', 'Steampunk', 'Cyberpunk', 'Western', 'Medieval',
           'Victorian', 'Gothic', 'Japanese', 'Korean', 'Chinese', 'American',
           'European'].includes(s.name)
        )
      },
      character: {
        label: 'Design',
        styles: styles.filter(s =>
          ['Character Design', 'Concept Art', 'Illustration', 'Comic Book',
           'Logo Design', 'Tattoo Design', 'Architectural', 'Medical Illustration',
           'Furry', 'Kemono', 'SFW', 'NSFW'].includes(s.name)
        )
      },
    };
    return categories;
  };

  const toggleStyle = (styleId) => {
    setSelectedStyles(prev =>
      prev.includes(styleId) ? prev.filter(id => id !== styleId) : [...prev, styleId]
    );
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId) ? prev.filter(id => id !== interestId) : [...prev, interestId]
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

  const renderStyleItem = ({ item }) => {
    if (!item || !item.id) return null;
    const isSelected = selectedStyles.includes(item.id);
    return (
      <TouchableOpacity
        style={[componentStyles.styleCard, isSelected && componentStyles.styleCardSelected]}
        onPress={() => toggleStyle(item.id)}
        activeOpacity={0.7}
      >
        <View style={[componentStyles.checkbox, isSelected && componentStyles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={colors.background} />}
        </View>
        <Text 
          style={[componentStyles.styleCardText, isSelected && componentStyles.styleCardTextSelected]}
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.8}
        >
          {item.name || 'Unknown Style'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderInterestItem = ({ item }) => {
    const isSelected = selectedInterests.includes(item.id);
    return (
      <TouchableOpacity
        style={[componentStyles.interestCard, isSelected && componentStyles.interestCardSelected]}
        onPress={() => toggleInterest(item.id)}
        activeOpacity={0.7}
      >
        <View style={[componentStyles.interestIcon, isSelected && componentStyles.interestIconSelected]}>
          <Ionicons
            name={item.icon}
            size={24}
            color={isSelected ? colors.text.primary : colors.text.secondary}
          />
        </View>
        <Text style={[componentStyles.interestLabel, isSelected && componentStyles.interestLabelSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBudgetItem = ({ item }) => {
    const isSelected = selectedBudget?.id === item.id;
    return (
      <TouchableOpacity
        style={[componentStyles.optionCard, isSelected && componentStyles.optionCardSelected]}
        onPress={() => setSelectedBudget(item)}
        activeOpacity={0.7}
      >
        <View style={[componentStyles.radioButton, isSelected && componentStyles.radioButtonSelected]}>
          {isSelected && <View style={componentStyles.radioButtonInner} />}
        </View>
        <Text style={[componentStyles.optionLabel, isSelected && componentStyles.optionLabelSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFrequencyItem = ({ item }) => {
    const isSelected = selectedFrequency === item.id;
    return (
      <TouchableOpacity
        style={[componentStyles.optionCard, isSelected && componentStyles.optionCardSelected]}
        onPress={() => setSelectedFrequency(item.id)}
        activeOpacity={0.7}
      >
        <View style={[componentStyles.radioButton, isSelected && componentStyles.radioButtonSelected]}>
          {isSelected && <View style={componentStyles.radioButtonInner} />}
        </View>
        <View style={componentStyles.optionTextContainer}>
          <Text style={[componentStyles.optionLabel, isSelected && componentStyles.optionLabelSelected]}>
            {item.label}
          </Text>
          <Text style={componentStyles.optionSubtitle}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStepContent = () => {
    if (loading && currentStep === 0) {
      return (
        <View style={componentStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={componentStyles.loadingText}>Loading art styles...</Text>
        </View>
      );
    }

    switch (currentStepData.id) {
      case 'styles':
        if (artStyles.length === 0 && !loading) {
          return (
            <View style={componentStyles.emptyContainer}>
              <Ionicons name="brush-outline" size={64} color={colors.text.secondary} />
              <Text style={componentStyles.emptyText}>No styles available</Text>
            </View>
          );
        }
        
        const categories = categorizeStyles(artStyles);
        const currentCategory = categories[activeCategory] || categories.all;
        const displayedStyles = currentCategory.styles;
        
        return (
          <View style={componentStyles.stylesContainer}>
            {/* Category Tabs - Filter Style with Red Underline */}
            <View style={componentStyles.filterBar}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={componentStyles.filterContent}
              >
                {Object.entries(categories).map(([key, category]) => {
                  const isSelected = activeCategory === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={componentStyles.filterItem}
                      onPress={() => setActiveCategory(key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          componentStyles.filterText,
                          isSelected && componentStyles.filterTextActive
                        ]}
                      >
                        {category.label}
                        {category.styles.length > 0 && ` (${category.styles.length})`}
                      </Text>
                      {isSelected && <View style={componentStyles.filterUnderline} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            
            {/* Styles List */}
            {displayedStyles.length === 0 ? (
              <View style={componentStyles.emptyCategory}>
                <Text style={componentStyles.emptyCategoryText}>
                  No styles in this category
                </Text>
              </View>
            ) : (
              <FlatList
                data={displayedStyles}
                renderItem={renderStyleItem}
                keyExtractor={(item) => String(item.id)}
                numColumns={2}
                columnWrapperStyle={componentStyles.styleRow}
                contentContainerStyle={componentStyles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        );

      case 'interests':
        return (
          <FlatList
            data={INTERESTS}
            renderItem={renderInterestItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={componentStyles.interestRow}
            contentContainerStyle={componentStyles.listContent}
            showsVerticalScrollIndicator={false}
          />
        );

      case 'budget':
        return (
          <ScrollView contentContainerStyle={componentStyles.listContent} showsVerticalScrollIndicator={false}>
            {BUDGET_RANGES.map((item) => (
              <View key={item.id}>{renderBudgetItem({ item })}</View>
            ))}
          </ScrollView>
        );

      case 'frequency':
        return (
          <ScrollView contentContainerStyle={componentStyles.listContent} showsVerticalScrollIndicator={false}>
            {COMMISSION_FREQUENCIES.map((item) => (
              <View key={item.id}>{renderFrequencyItem({ item })}</View>
            ))}
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <LinearGradient colors={[colors.background, colors.surface]} style={componentStyles.container}>
      {/* Header */}
      <View style={[componentStyles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={componentStyles.headerContent}>
          <View style={[componentStyles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name={currentStepData.icon} size={20} color={colors.primary} />
          </View>
          <Text style={componentStyles.stepIndicator}>Step {currentStep + 1} of {QUIZ_STEPS.length}</Text>
        </View>
        <TouchableOpacity style={componentStyles.skipButton} onPress={handleSkip}>
          <Text style={componentStyles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={componentStyles.progressContainer}>
        <View style={componentStyles.progressBar}>
          <View style={[componentStyles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Title */}
      <View style={componentStyles.titleContainer}>
        <Text style={componentStyles.title}>{currentStepData.title}</Text>
        <Text style={componentStyles.subtitle}>{currentStepData.subtitle}</Text>
      </View>

      {/* Content */}
      <View style={componentStyles.content}>
        {renderStepContent()}
      </View>

      {/* Bottom Actions */}
      <View style={[componentStyles.bottomSection, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={componentStyles.buttonRow}>
          {currentStep > 0 && (
            <TouchableOpacity style={componentStyles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
              <Text style={componentStyles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              componentStyles.nextButton,
              (!canProceed() || submitting) && componentStyles.nextButtonDisabled,
              currentStep === 0 && componentStyles.nextButtonFull,
            ]}
            onPress={handleNext}
            disabled={!canProceed() || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text.primary} />
            ) : (
              <>
                <Text style={componentStyles.nextButtonText}>
                  {currentStep === QUIZ_STEPS.length - 1 ? 'Complete' : 'Next'}
                </Text>
                <Ionicons
                  name={currentStep === QUIZ_STEPS.length - 1 ? 'checkmark' : 'arrow-forward'}
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

const componentStyles = StyleSheet.create({
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
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '700',
  },
  skipButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
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
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  stylesContainer: {
    flex: 1,
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
  emptyCategory: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyCategoryText: {
    ...typography.body,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
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
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    flexGrow: 1,
  },
  styleRow: {
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  styleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
    minHeight: 56,
    ...shadows.small,
  },
  styleCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.medium,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    borderColor: colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  styleCardText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    flexShrink: 1,
  },
  styleCardTextSelected: {
    fontWeight: '700',
    color: colors.background,
  },
  interestRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  interestCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 120,
  },
  interestCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  interestIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  interestIconSelected: {
    backgroundColor: colors.background,
    borderColor: colors.background,
  },
  interestLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  interestLabelSelected: {
    fontWeight: '700',
    color: colors.background,
  },
  optionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  radioButtonSelected: {
    borderColor: colors.background,
  },
  radioButtonInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.background,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  optionLabelSelected: {
    color: colors.background,
    fontWeight: '700',
  },
  optionSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
    fontSize: 13,
  },
  bottomSection: {
    paddingHorizontal: spacing.xl,
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
    borderRadius: borderRadius.lg,
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
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flex: 2,
    minHeight: 52,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.4,
    backgroundColor: colors.surface,
  },
  nextButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});

