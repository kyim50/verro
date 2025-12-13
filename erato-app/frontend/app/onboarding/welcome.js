import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <LinearGradient
      colors={[colors.background, colors.surface, colors.surfaceLight]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.content}>
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="brush-outline" size={80} color={colors.primary} />
        </View>

        {/* Welcome Message */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>Welcome to Verro!</Text>
          <Text style={styles.subtitle}>
            Let's set up your artist profile and showcase your amazing work to potential clients.
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresList}>
          <FeatureItem
            icon="images-outline"
            title="Showcase Your Portfolio"
            description="Upload 6 of your best works to attract clients"
          />
          <FeatureItem
            icon="people-outline"
            title="Connect with Clients"
            description="Get discovered through our Tinder-style explore feature"
          />
          <FeatureItem
            icon="cash-outline"
            title="Manage Commissions"
            description="Set your prices and manage your commission workflow"
          />
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/onboarding/portfolio')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresList: {
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    ...typography.small,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    minWidth: width * 0.7, // 70% of screen width for smaller screens
    maxWidth: 320, // Cap maximum width for larger screens
    alignSelf: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
