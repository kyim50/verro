import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { uploadMultipleImages } from '../../utils/imageUpload';

const { width } = Dimensions.get('window');
const PORTFOLIO_SIZE = 6;

export default function PortfolioScreen() {
  const [portfolioImages, setPortfolioImages] = useState(Array(PORTFOLIO_SIZE).fill(null));
  const [loading, setLoading] = useState(false);

  const token = useAuthStore((state) => state.token);
  const completeOnboarding = useProfileStore((state) => state.completeArtistOnboarding);

  const pickImage = async (index) => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'info',
        text1: 'Permission needed',
        text2: 'Please grant permission to access your photos',
        visibilityTime: 3000,
      });
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const newImages = [...portfolioImages];
      newImages[index] = result.assets[0].uri;
      setPortfolioImages(newImages);
    }
  };

  const removeImage = (index) => {
    const newImages = [...portfolioImages];
    newImages[index] = null;
    setPortfolioImages(newImages);
  };

  const handleComplete = async () => {
    const filledImages = portfolioImages.filter((img) => img !== null);

    if (filledImages.length < 1) {
      Toast.show({
        type: 'info',
        text1: 'Portfolio Required',
        text2: 'Please upload at least one portfolio image to showcase your work.',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      // Upload portfolio images to Supabase Storage
      const uploadedUrls = await uploadMultipleImages(filledImages, 'portfolios', '', token);

      // Ensure we have at least 1 image and pad to 6 if needed (backend accepts 1-6)
      // But we'll send exactly what we have (1-6 images)
      const portfolioToSend = uploadedUrls.filter(url => url && url.trim() !== '');
      
      if (portfolioToSend.length < 1) {
        throw new Error('Failed to upload portfolio images');
      }

      // Complete onboarding with uploaded image URLs
      await completeOnboarding(portfolioToSend, token);

      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Your portfolio has been set up successfully!',
        visibilityTime: 2000,
      });
      // Navigate after toast
      setTimeout(() => router.replace('/(tabs)/home'), 1500);
    } catch (error) {
      console.error('Onboarding error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to complete onboarding. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const filledCount = portfolioImages.filter((img) => img !== null).length;
  const progress = (filledCount / PORTFOLIO_SIZE) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <View style={styles.badge}>
            <Ionicons name="images" size={14} color="#E60023" />
            <Text style={styles.badgeText}>Portfolio Setup</Text>
          </View>
          <Text style={styles.headerTitle}>Showcase Your Best Work</Text>
          <Text style={styles.headerSubtitle}>
            Add 1-{PORTFOLIO_SIZE} pieces that highlight your unique style
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <Text style={styles.progressCount}>
            {filledCount}/{PORTFOLIO_SIZE}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      {/* Portfolio Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {portfolioImages.map((image, index) => (
            <PortfolioSlot
              key={index}
              index={index}
              image={image}
              onPress={() => pickImage(index)}
              onRemove={() => removeImage(index)}
            />
          ))}
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color="#E60023" />
            <Text style={styles.tipsTitle}>Portfolio Tips</Text>
          </View>
          <View style={styles.tipsList}>
            <TipItem text="Show variety in your work" />
            <TipItem text="Use high-quality images" />
            <TipItem text="Highlight your unique style" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.completeButton, filledCount < 1 && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading || filledCount < 1}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.completeButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
        {filledCount < 1 && (
          <Text style={styles.requirementText}>
            Add at least 1 image to continue
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function PortfolioSlot({ index, image, onPress, onRemove }) {
  return (
    <TouchableOpacity
      style={styles.slot}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {image ? (
        <>
          <Image source={{ uri: image }} style={styles.slotImage} contentFit="cover" />
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptySlot}>
          <Ionicons name="add" size={40} color={colors.text.disabled} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function TipItem({ text }) {
  return (
    <View style={styles.tipItem}>
      <Ionicons name="checkmark-circle" size={16} color="#E60023" />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  backButton: {
    marginRight: spacing.md,
    marginTop: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.small,
    fontSize: 12,
    fontWeight: '700',
    color: '#E60023',
    letterSpacing: 0.3,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 34,
  },
  headerSubtitle: {
    ...typography.body,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.small,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  progressCount: {
    ...typography.small,
    fontSize: 13,
    fontWeight: '700',
    color: '#E60023',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  slot: {
    width: '48%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#000000',
    borderRadius: borderRadius.full,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tipsTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tipsList: {
    gap: spacing.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipText: {
    ...typography.body,
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  bottomActions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 0,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  completeButton: {
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    ...typography.button,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  requirementText: {
    ...typography.small,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
