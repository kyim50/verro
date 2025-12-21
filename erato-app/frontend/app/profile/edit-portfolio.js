import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import { uploadImage, uploadMultipleImages } from '../../utils/imageUpload';

// Get store reference for direct state updates
const useProfileStoreRef = useProfileStore;

export default function EditPortfolioScreen() {
  const { token, user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const [portfolioImages, setPortfolioImages] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    // Fetch fresh profile data when component mounts
    const loadProfile = async () => {
      if (user && token) {
        await fetchProfile(user.id, token);
      }
      setInitialLoading(false);
    };
    loadProfile();
  }, []);

  useEffect(() => {
    // Load existing portfolio images - always show 6 slots
    if (profile?.artist?.portfolio_images && profile.artist.portfolio_images.length > 0) {
      const existing = profile.artist.portfolio_images.filter(img => img && img.trim() !== '');
      // Fill remaining slots with empty strings up to 6
      const filled = [...existing];
      while (filled.length < 6) {
        filled.push('');
      }
      setPortfolioImages(filled.slice(0, 6));
    } else if (profile?.artist) {
      // Artist exists but no portfolio images - show all 6 empty slots
      setPortfolioImages(['', '', '', '', '', '']);
    } else {
      // No artist yet - show all 6 empty slots
      setPortfolioImages(['', '', '', '', '', '']);
    }
  }, [profile]);

  const pickImage = async (index) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'info',
        text1: 'Permission needed',
        text2: 'Please allow access to your photos',
        visibilityTime: 3000,
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = [...portfolioImages];
      newImages[index] = result.assets[0].uri;
      setPortfolioImages(newImages);
    }
  };

  const removeImage = (index) => {
    const newImages = [...portfolioImages];
    newImages[index] = '';
    // Always keep 6 slots - just clear the one at this index
    setPortfolioImages(newImages);
  };

  const handleSave = async () => {
    // Filter out empty slots
    const filledImages = portfolioImages.filter((img) => img && img.trim() !== '');

    if (filledImages.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please add at least one portfolio image',
        visibilityTime: 2000,
      });
      return;
    }

    setLoading(true);

    try {
      // Separate local files (need uploading) from existing URLs (already uploaded)
      const localFiles = [];
      const existingUrls = [];
      const imageMap = new Map(); // Track original order

      filledImages.forEach((img, index) => {
        if (img.startsWith('file://')) {
          localFiles.push({ uri: img, originalIndex: index });
          imageMap.set(index, null); // Will be set after upload
        } else if (img.startsWith('http://') || img.startsWith('https://')) {
          existingUrls.push(img);
          imageMap.set(index, img);
        }
      });

      // Upload local files to cloud storage
      let uploadedUrls = [];
      if (localFiles.length > 0) {
        Toast.show({
          type: 'info',
          text1: 'Uploading images...',
          text2: `Uploading ${localFiles.length} image${localFiles.length > 1 ? 's' : ''}`,
          visibilityTime: 2000,
        });

        try {
          // Use multi-file upload for portfolios (more efficient)
          const fileUris = localFiles.map(f => f.uri);
          console.log('Uploading portfolio images:', fileUris.length);
          uploadedUrls = await uploadMultipleImages(fileUris, 'portfolios', '', token);
          console.log('Uploaded URLs received:', uploadedUrls);
          
          // Map uploaded URLs back to their original indices
          localFiles.forEach((file, idx) => {
            if (uploadedUrls[idx]) {
              imageMap.set(file.originalIndex, uploadedUrls[idx]);
            }
          });
          
          if (uploadedUrls.length !== localFiles.length) {
            console.warn('Upload count mismatch:', uploadedUrls.length, 'expected', localFiles.length);
          }
        } catch (uploadError) {
          console.error('Error uploading portfolio images:', uploadError);
          throw new Error(`Failed to upload images: ${uploadError.message}`);
        }
      }

      // Combine existing URLs and newly uploaded URLs in the correct order
      const allImages = filledImages.map((img, index) => {
        if (img.startsWith('file://')) {
          const uploadedUrl = imageMap.get(index);
          if (!uploadedUrl) {
            console.error('No uploaded URL found for index:', index);
            throw new Error('Image upload failed - no URL returned');
          }
          return uploadedUrl;
        }
        return img; // Already a URL
      }).filter(Boolean); // Remove any nulls (shouldn't happen, but safety check)

      console.log('Saving portfolio images to backend:', allImages);

      // Save to backend
      const response = await fetch(
        `${Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.verrocio.com/api'}/users/me/artist`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            portfolio_images: allImages,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Backend error response:', errorData);
        throw new Error(errorData.error || `Failed to update portfolio (${response.status})`);
      }

      const responseData = await response.json();
      console.log('Backend response data:', responseData);
      
      // Verify the response contains portfolio_images and it's a valid array
      if (!responseData.portfolio_images) {
        console.error('Backend response missing portfolio_images:', responseData);
        throw new Error('Backend did not return portfolio images');
      }

      // Ensure portfolio_images is an array and filter out invalid entries
      const validatedPortfolio = Array.isArray(responseData.portfolio_images)
        ? responseData.portfolio_images.filter(img => 
            img && 
            typeof img === 'string' && 
            img.trim() !== '' && 
            (img.startsWith('http://') || img.startsWith('https://'))
          )
        : [];

      if (validatedPortfolio.length !== allImages.length) {
        console.warn('Portfolio count mismatch. Sent:', allImages.length, 'Received:', validatedPortfolio.length);
        console.warn('Sent images:', allImages);
        console.warn('Received images:', validatedPortfolio);
      }

      console.log('Validated portfolio images:', validatedPortfolio);

      // Optimistically update profile store immediately with validated portfolio
      useProfileStoreRef.setState((state) => {
        if (state.profile && state.profile.artist) {
          console.log('Updating profile store with portfolio (count:', validatedPortfolio.length, '):', validatedPortfolio);
          return {
            profile: {
              ...state.profile,
              artist: {
                ...state.profile.artist,
                portfolio_images: validatedPortfolio, // Use validated portfolio from server
              },
            },
          };
        }
        return state;
      });

      // Force refresh to bypass cache and get fresh data from server
      // This ensures everything is in sync
      const refreshedProfile = await fetchProfile(user.id, token, true);
      console.log('Refreshed profile portfolio:', refreshedProfile?.artist?.portfolio_images);
      
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Portfolio updated successfully',
        visibilityTime: 2000,
      });
      
      // Navigate back immediately - profile screen will refresh on focus
      router.back();
    } catch (error) {
      console.error('Error updating portfolio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update portfolio. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const filledCount = portfolioImages.filter((img) => img && img.trim() !== '').length;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <View style={styles.badge}>
              <Ionicons name="images" size={14} color="#E60023" />
              <Text style={styles.badgeText}>Edit Portfolio</Text>
            </View>
            <Text style={styles.headerTitle}>Update Your Portfolio</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E60023" />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = (filledCount / 6) * 100;

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
            <Text style={styles.badgeText}>Edit Portfolio</Text>
          </View>
          <Text style={styles.headerTitle}>Update Your Portfolio</Text>
          <Text style={styles.headerSubtitle}>
            Keep your work fresh and showcase your best pieces
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Your Progress</Text>
          <Text style={styles.progressCount}>
            {filledCount}/6
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.grid}>
          {portfolioImages.map((imageUri, index) => (
            <TouchableOpacity
              key={index}
              style={styles.slot}
              onPress={() => pickImage(index)}
              activeOpacity={0.8}
            >
              {imageUri ? (
                <>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.slotImage}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.emptySlot}>
                  <Ionicons name="add" size={40} color={colors.text.disabled} />
                </View>
              )}
            </TouchableOpacity>
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
          style={[styles.saveButton, (loading || filledCount === 0) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading || filledCount === 0}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
        {filledCount === 0 && (
          <Text style={styles.requirementText}>
            Add at least 1 image to save
          </Text>
        )}
      </View>
    </SafeAreaView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
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
  saveButton: {
    backgroundColor: '#E60023',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
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
