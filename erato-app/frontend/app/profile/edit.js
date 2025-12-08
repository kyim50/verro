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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function EditProfileScreen() {
  const { user, token, fetchUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // User fields
  const [avatarUrl, setAvatarUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  // Social media fields (for artists only)
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatar_url || '');
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
    setLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // Upload new profile image if it's a local file
      if (avatarUrl && avatarUrl.startsWith('file://')) {
        const { uploadImage } = require('../../utils/imageUpload');
        finalAvatarUrl = await uploadImage(avatarUrl, 'profiles', '', token);
      }

      // Update user profile
      const userResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}/users/me`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            avatar_url: finalAvatarUrl,
            full_name: fullName,
            bio: bio,
          }),
        }
      );

      if (!userResponse.ok) {
        throw new Error('Failed to update profile');
      }

      // Update artist social media links if user is an artist
      if (user?.artists) {
        const artistData = {};
        if (instagramUrl) artistData.instagram_url = instagramUrl.trim();
        if (twitterUrl) artistData.twitter_url = twitterUrl.trim();
        if (tiktokUrl) artistData.tiktok_url = tiktokUrl.trim();

        if (Object.keys(artistData).length > 0) {
          const artistResponse = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}/users/me/artist`,
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

      await fetchUser();
      // Update local state with the uploaded avatar URL
      setAvatarUrl(finalAvatarUrl);

      Alert.alert('Success!', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Picture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
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
            >
              <Ionicons name="camera" size={20} color={colors.text.primary} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={colors.text.disabled}
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
            />
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
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl + spacing.sm,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  changePhotoText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: 15,
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
    paddingVertical: spacing.sm + 2,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
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
