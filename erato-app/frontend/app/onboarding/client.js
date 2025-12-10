import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;

const STEPS = [
  {
    id: '1',
    icon: 'search-outline',
    title: 'Explore Artworks',
    description: 'Browse through a beautiful feed of artworks and discover artists whose style resonates with you.',
    tips: [
      'Save artworks to boards for inspiration',
      'Tap on any artwork to see more details',
      'Use the search to find specific styles or artists',
    ],
    color: colors.primary,
  },
  {
    id: '2',
    icon: 'shuffle-outline',
    title: 'Swipe to Discover',
    description: 'Use the Explore tab to swipe through artist profiles, Tinder-style. Swipe right when you find an artist you like!',
    tips: [
      'Swipe left to pass on an artist',
      'Swipe right to save or message them',
      'Tap the profile to see their full portfolio',
    ],
    color: '#E91E63',
  },
  {
    id: '3',
    icon: 'chatbubble-ellipses-outline',
    title: 'Message Artists',
    description: 'Found the perfect artist? Send them a message to discuss your ideas and start the commission process.',
    tips: [
      'Be specific about what you want',
      'Share reference images if you have them',
      'Ask about pricing and timeline',
    ],
    color: '#9C27B0',
  },
  {
    id: '4',
    icon: 'brush-outline',
    title: 'Request Commissions',
    description: 'When you\'re ready, request a custom commission from your chosen artist and bring your vision to life.',
    tips: [
      'Check if commissions are open first',
      'Provide detailed descriptions',
      'Be patient - great art takes time!',
    ],
    color: '#FF9800',
  },
];

export default function ClientOnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (currentIndex < STEPS.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    Alert.alert(
      'You\'re all set!',
      'Start exploring artworks and discovering amazing artists.',
      [
        {
          text: 'Start Exploring',
          onPress: () => router.replace('/(tabs)/home'),
        },
      ]
    );
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderStep = ({ item }) => (
    <View style={styles.slide}>
      <ScrollView 
        contentContainerStyle={styles.slideContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
          <Ionicons name={item.icon} size={IS_SMALL_SCREEN ? 70 : 80} color={item.color} />
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips:</Text>
          {item.tips.map((tip, index) => (
            <View key={index} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={18} color={item.color} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.background, colors.surface]}
      style={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerTitle}>Welcome to Verro</Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / STEPS.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Step {currentIndex + 1} of {STEPS.length}
        </Text>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={32}
        style={styles.flatList}
      />

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next/Complete Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === STEPS.length - 1 ? 'Start Exploring' : 'Next'}
          </Text>
          <Ionicons
            name={currentIndex === STEPS.length - 1 ? 'rocket' : 'arrow-forward'}
            size={20}
            color={colors.text.primary}
          />
        </TouchableOpacity>
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
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressText: {
    ...typography.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
  },
  slideContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height * 0.6,
  },
  iconContainer: {
    width: IS_SMALL_SCREEN ? 120 : 140,
    height: IS_SMALL_SCREEN ? 120 : 140,
    borderRadius: IS_SMALL_SCREEN ? 60 : 70,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  tipsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  tipsTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    marginLeft: spacing.sm,
    lineHeight: 20,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
  },
  bottomSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  nextButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
  },
});
