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

      // Complete onboarding with uploaded image URLs
      await completeOnboarding(uploadedUrls, token);

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Build Your Portfolio</Text>
          <Text style={styles.headerSubtitle}>
            Upload up to {PORTFOLIO_SIZE} of your best works (min. 1)
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {filledCount} / {PORTFOLIO_SIZE} images
        </Text>
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

        <Text style={styles.helpText}>
          Upload at least 1 image to continue. Choose images that best represent your artistic
          style and skills - these will be the first things potential clients see.
        </Text>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.completeButton, filledCount < 1 && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading || filledCount < 1}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.completeButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
            <Ionicons name="close-circle" size={28} color={colors.status.error} />
          </TouchableOpacity>
          <View style={styles.imageNumber}>
            <Text style={styles.imageNumberText}>{index + 1}</Text>
          </View>
        </>
      ) : (
        <View style={styles.emptySlot}>
          <Ionicons name="add-circle-outline" size={40} color={colors.text.disabled} />
          <Text style={styles.emptyText}>Add Image {index + 1}</Text>
        </View>
      )}
    </TouchableOpacity>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
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
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  emptySlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
  },
  emptyText: {
    ...typography.small,
    color: colors.text.disabled,
    marginTop: spacing.sm,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageNumber: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  imageNumberText: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '700',
  },
  helpText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  bottomActions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.text.secondary,
  },
});
