import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';
import { uploadImage } from '../../utils/imageUpload';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ProfilePictureScreen() {
  const { userType } = useLocalSearchParams();
  const { token, user, fetchUser } = useAuthStore();
  const [avatarUri, setAvatarUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'info',
          text1: 'Permission Required',
          text2: 'Please grant camera roll permissions to upload a profile picture',
          visibilityTime: 3000,
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick image',
        visibilityTime: 2000,
      });
    }
  };

  const handleContinue = async () => {
    if (!avatarUri) {
      Toast.show({
        type: 'info',
        text1: 'Profile Picture Required',
        text2: 'Please upload a profile picture to continue',
        visibilityTime: 3000,
      });
      return;
    }

    if (!token) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please log in again',
        visibilityTime: 3000,
      });
      router.replace('/auth/login');
      return;
    }

    setUploading(true);

    try {
      // Upload profile picture
      const uploadedUrl = await uploadImage(avatarUri, 'profiles', '', token, false);

      if (!uploadedUrl) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to upload profile picture. Please try again.',
          visibilityTime: 3000,
        });
        setUploading(false);
        return;
      }

      // Update user profile with avatar URL
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_url: uploadedUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Refresh user data
      await fetchUser();

      // Navigate to onboarding based on user type
      if (userType === 'artist') {
        router.replace('/onboarding/welcome');
      } else {
        router.replace('/onboarding/client');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to upload profile picture. Please try again.',
        visibilityTime: 3000,
      });
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Add Your Profile Picture</Text>
        <Text style={styles.subtitle}>
          Show the community who you are
        </Text>
      </View>

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={pickImage}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {avatarUri ? (
            <>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.overlay}>
                <View style={styles.editIconContainer}>
                  <Text style={styles.editText}>Change Photo</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-outline" size={60} color={colors.text.disabled} />
              <Text style={styles.placeholderText}>Tap to upload</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Info Text */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Your profile picture helps others recognize you and builds trust in the community.
        </Text>
        <Text style={styles.infoTextSecondary}>
          You can always change this later in your profile settings.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.continueButton, uploading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={uploading || !avatarUri}
        >
          {uploading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl * 2,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  avatarContainer: {
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: (width * 0.45) / 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.primary,
    ...shadows.large,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    alignItems: 'center',
  },
  editText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  infoText: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  infoTextSecondary: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: spacing.md,
    marginTop: 'auto',
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md + 4,
    alignItems: 'center',
    ...shadows.medium,
  },
  continueButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  skipButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  skipButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

