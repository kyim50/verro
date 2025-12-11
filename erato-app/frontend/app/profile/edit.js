import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function EditProfileScreen() {
  const { user, token, fetchUser, setUser } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const [loading, setLoading] = useState(false);

  // User fields
  const [avatarUrl, setAvatarUrl] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  // Social media fields (for artists only)
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');

  const navigation = useNavigation();

  useEffect(() => {
    // Disable swipe back gesture to prevent accidental logout
    navigation.setOptions({
      gestureEnabled: false,
    });

    return () => {
      // Re-enable gesture when component unmounts
      navigation.setOptions({
        gestureEnabled: true,
      });
    };
  }, [navigation]);

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatar_url || '');
      setUsername(user.username || '');
      setFullName(user.full_name || '');
      setBio(user.bio || '');

      // Load social media links if user is an artist
      if (user.artists) {
        setInstagramUrl(user.artists.instagram_url || '');
        setTwitterUrl(user.artists.twitter_url || '');
        setTiktokUrl(user.artists.tiktok_url || '');
      } else {
        setInstagramUrl('');
        setTwitterUrl('');
        setTiktokUrl('');
      }
    }
  }, [user?.id]);

  const pickProfileImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    // Validate username if provided
    if (username && username.trim() !== '') {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3) {
        Alert.alert('Error', 'Username must be at least 3 characters long');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
        return;
      }
    }

    setLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload new profile image if it's a local file
      if (avatarUrl && avatarUrl.startsWith('file://')) {
        const { uploadImage } = require('../../utils/imageUpload');
        finalAvatarUrl = await uploadImage(avatarUrl, 'profiles', '', token);
      }

      // Prepare update payload - only include fields that have values
      const updatePayload = {
        avatar_url: finalAvatarUrl || user?.avatar_url,
        full_name: fullName || '',
        bio: bio || '',
      };

      // Only include username if it's different from current username
      if (username && username.trim() !== '' && username.trim() !== user?.username) {
        updatePayload.username = username.trim();
      }

      // Update user profile
      const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.verrocio.com/api';
      console.log('📡 Updating profile at:', apiUrl.substring(0, 30) + '...');
      const userResponse = await fetch(
        `${apiUrl}/users/me`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        }
      );

      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to update profile (${userResponse.status})`;
        throw new Error(errorMessage);
      }

      const updatedUser = await userResponse.json();
      
      // Immediately update the user in auth store with all updated fields
      if (updatedUser) {
        const newUserData = { 
          ...user, 
          ...updatedUser, 
          avatar_url: finalAvatarUrl,
          username: username.trim(),
          full_name: fullName,
          bio: bio,
        };
        setUser(newUserData);
        // Update local state immediately
        setAvatarUrl(finalAvatarUrl);
      }

      // Update artist social media links if user is an artist
      if (user?.artists) {
        const artistData = {};
        if (instagramUrl) artistData.instagram_url = instagramUrl.trim();
        if (twitterUrl) artistData.twitter_url = twitterUrl.trim();
        if (tiktokUrl) artistData.tiktok_url = tiktokUrl.trim();

        if (Object.keys(artistData).length > 0) {
          console.log('📡 Updating artist profile at:', apiUrl.substring(0, 30) + '...');
          const artistResponse = await fetch(
            `${apiUrl}/users/me/artist`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(artistData),
            }
          );

          if (!artistResponse.ok) {
            throw new Error('Failed to update artist profile');
          }
        }
      }

      // Fetch updated user data (this will update auth store)
      await fetchUser();
      
      // Also refresh profile store if user is viewing their own profile - do this immediately
      if (user?.id) {
        // Force immediate update by clearing cache and re-fetching
        useProfileStore.getState().reset();
        await fetchProfile(user.id, token);
      }

      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Profile updated successfully',
        visibilityTime: 2000,
      });
      
      // Navigate back immediately - profile screen will refresh on focus
      router.back();
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.message || 'Failed to update profile. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              key={avatarUrl}
              source={{ uri: avatarUrl || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="none"
            />
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={pickProfileImage}
              activeOpacity={0.8}
            >
              <View style={styles.changePhotoIconContainer}>
                <Ionicons name="camera" size={18} color={colors.text.primary} />
              </View>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
          
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="none"
              maxLength={30}
            />
            {username && (
              <Text style={styles.hintText}>@{username.trim()}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={colors.text.disabled}
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself..."
              placeholderTextColor={colors.text.disabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={150}
            />
            <Text style={styles.characterCount}>{bio.length}/150</Text>
          </View>
        </View>

        {/* Social Media Links (for artists only) */}
        {user?.artists && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Media</Text>
            <Text style={styles.sublabel}>
              Link your social media accounts to get verified
            </Text>

            <View style={styles.inputGroup}>
              <View style={styles.socialInputContainer}>
                <Ionicons name="logo-instagram" size={20} color={colors.text.primary} style={styles.socialIcon} />
                <TextInput
                  style={styles.socialInput}
                  value={instagramUrl}
                  onChangeText={setInstagramUrl}
                  placeholder="Instagram username or URL"
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.socialInputContainer}>
                <Ionicons name="logo-twitter" size={20} color={colors.text.primary} style={styles.socialIcon} />
                <TextInput
                  style={styles.socialInput}
                  value={twitterUrl}
                  onChangeText={setTwitterUrl}
                  placeholder="Twitter username or URL"
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.socialInputContainer}>
                <Ionicons name="musical-notes" size={20} color={colors.text.primary} style={styles.socialIcon} />
                <TextInput
                  style={styles.socialInput}
                  value={tiktokUrl}
                  onChangeText={setTiktokUrl}
                  placeholder="TikTok username or URL"
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        )}
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
    borderBottomColor: colors.border + '40',
    backgroundColor: colors.background,
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
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  saveText: {
    ...typography.button,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    paddingBottom: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    marginBottom: spacing.xl,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.lg,
    fontSize: 18,
    fontWeight: '700',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changePhotoIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  username: {
    ...typography.h3,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
  hintText: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
  },
  sublabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
  },
  characterCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  halfWidth: {
    flex: 1,
    minWidth: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  switchLabel: {
    flex: 1,
    marginRight: spacing.md,
    justifyContent: 'center',
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  socialIcon: {
    marginRight: spacing.sm,
  },
  socialInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
});
