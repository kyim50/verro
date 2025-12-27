import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Top Section */}
          <View style={styles.topSection}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={16} color="#E60023" />
              <Text style={styles.badgeText}>Artist Onboarding</Text>
            </View>

            <Text style={styles.mainTitle}>Let's Get You Set Up</Text>
            <Text style={styles.mainSubtitle}>
              Your creative journey starts here
            </Text>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>10K+</Text>
              <Text style={styles.statLabel}>Artists</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>50K+</Text>
              <Text style={styles.statLabel}>Clients</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>$2M+</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>

          {/* Feature Cards */}
          <View style={styles.cardsContainer}>
            <FeatureCard
              icon="images"
              title="Portfolio"
              description="Showcase your best work"
              color="#E60023"
            />
            <FeatureCard
              icon="cash"
              title="Commissions"
              description="Set your rates & terms"
              color="#E60023"
            />
            <FeatureCard
              icon="trending-up"
              title="Get Discovered"
              description="Connect with clients"
              color="#E60023"
            />
          </View>

          {/* Bottom Button */}
          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push('/onboarding/portfolio')}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>Start Building</Text>
              <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.estimateText}>Takes less than 2 minutes</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureCard({ icon, title, description, color }) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.cardTextContainer}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  topSection: {
    paddingTop: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  badgeText: {
    ...typography.small,
    fontSize: 13,
    fontWeight: '700',
    color: '#E60023',
    letterSpacing: 0.5,
  },
  mainTitle: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 38,
  },
  mainSubtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: spacing.md,
  },
  cardIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h3,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardDescription: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  bottomSection: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  button: {
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.button,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  estimateText: {
    ...typography.small,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#E60023',
    marginBottom: 2,
  },
  statLabel: {
    ...typography.small,
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
});
