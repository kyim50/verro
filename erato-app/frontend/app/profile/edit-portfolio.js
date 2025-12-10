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
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuthStore, useProfileStore } from '../../store';

// Get store reference for direct state updates
const useProfileStoreRef = useProfileStore;
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

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
    // Load existing portfolio images
    if (profile?.artist?.portfolio_images && profile.artist.portfolio_images.length > 0) {
      const existing = profile.artist.portfolio_images.filter(img => img && img.trim() !== '');
      // Fill remaining slots with empty strings up to 6
      const filled = [...existing];
      while (filled.length < 6) {
        filled.push('');
      }
      setPortfolioImages(filled.slice(0, 6));
    } else if (profile?.artist) {
      // Artist exists but no portfolio images - start with one empty slot
      setPortfolioImages(['']);
    }
  }, [profile]);

  const pickImage = async (index) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
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
    // Remove empty slots from the end, but keep at least one slot
    const filledImages = newImages.filter(img => img && img.trim() !== '');
    // If we have filled images, show only those (minimum 1 slot for adding)
    if (filledImages.length > 0) {
      // Add empty slots up to 6, but remove trailing empty slots
      const filtered = newImages.filter((img, i) => {
        if (i === index) return false; // Remove the deleted one
        return true;
      });
      // Remove trailing empty slots
      while (filtered.length > 0 && !filtered[filtered.length - 1]) {
        filtered.pop();
      }
      // Ensure at least 1 slot remains (or up to 6)
      while (filtered.length < 6) {
        filtered.push('');
      }
      setPortfolioImages(filtered.slice(0, 6));
    } else {
      // If all images removed, keep just one empty slot
      setPortfolioImages(['']);
    }
  };

  const handleSave = async () => {
    // Filter out empty slots
    const filledImages = portfolioImages.filter((img) => img && img.trim() !== '');

    if (filledImages.length === 0) {
      Alert.alert('Error', 'Please add at least one portfolio image');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://3.18.213.189:3000/api'}/users/me/artist`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            portfolio_images: filledImages,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update portfolio');
      }

      const responseData = await response.json();
      
      // Optimistically update profile store immediately with new portfolio
      useProfileStoreRef.setState((state) => {
        if (state.profile && state.profile.artist) {
          return {
            profile: {
              ...state.profile,
              artist: {
                ...state.profile.artist,
                portfolio_images: responseData.portfolio_images || filledImages,
              },
            },
          };
        }
        return state;
      });

      // Force refresh to bypass cache and get fresh data
      await fetchProfile(user.id, token, true);
      
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
      Alert.alert('Error', 'Failed to update portfolio. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filledCount = portfolioImages.filter((img) => img && img.trim() !== '').length;

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Portfolio</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Portfolio</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.title}>Portfolio Images</Text>
          <Text style={styles.subtitle}>
            Showcase your best work ({filledCount}/6 images)
          </Text>
          <Text style={styles.description}>
            Add up to 6 images that represent your artistic style. These will be shown when people explore your profile.
          </Text>
        </View>

        <View style={styles.grid}>
          {portfolioImages.map((imageUri, index) => (
            <View key={index} style={styles.imageContainer}>
              {imageUri ? (
                <>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={28} color={colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.replaceButton}
                    onPress={() => pickImage(index)}
                  >
                    <Ionicons name="camera" size={20} color={colors.text.primary} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.emptySlot}
                  onPress={() => pickImage(index)}
                >
                  <Ionicons name="add-circle-outline" size={48} color={colors.text.disabled} />
                  <Text style={styles.emptyText}>Add Image {index + 1}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || filledCount === 0}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Portfolio</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
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
  content: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.h3,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  imageContainer: {
    width: '47%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
  },
  replaceButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptySlot: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
