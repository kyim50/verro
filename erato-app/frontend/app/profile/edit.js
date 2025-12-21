import { useState, useEffect, useCallback } from 'react';
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
import { router, useNavigation, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import BannerImagePicker from '../../components/BannerImagePicker';

export default function EditProfileScreen() {
  const { user, token, fetchUser: fetchUserData, setUser } = useAuthStore();
  const { fetchProfile } = useProfileStore();
  const [loading, setLoading] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0); // For forcing avatar re-render
  const [bannerKey, setBannerKey] = useState(0); // For forcing banner re-render

  // User fields
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  // Social media fields
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');

  // Client-specific fields
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  // Modal states
  const [showBannerPicker, setShowBannerPicker] = useState(false);

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

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        // Fetch latest user data to ensure we have the most recent banner/avatar URLs
        fetchUserData();
      }
    }, [user?.id, fetchUserData])
  );

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatar_url || '');
      setBannerUrl(user.banner_url || '');
      setUsername(user.username || '');
      setFullName(user.full_name || '');
      setBio(user.bio || '');

      // Load social media links
      if (user.artists) {
        // For artists, load from artists table
        setInstagramUrl(user.artists.social_links?.instagram || user.artists.instagram_url || '');
        setTwitterUrl(user.artists.social_links?.twitter || user.artists.twitter_url || '');
        setTiktokUrl(user.artists.social_links?.tiktok || user.artists.tiktok_url || '');
      } else {
        // For clients, load from user metadata if available
        setInstagramUrl(user.social_links?.instagram || '');
        setTwitterUrl(user.social_links?.twitter || '');
        setTiktokUrl(user.social_links?.tiktok || '');
      }

      // Load client-specific fields
      setLocation(user.location || '');
      setWebsite(user.website || '');
    }
  }, [user?.id]);

  const pickProfileImage = async () => {
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
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
      setAvatarKey(prev => prev + 1); // Force re-render
    }
  };

  const pickBannerImage = () => {
    setShowBannerPicker(true);
  };

  const handleBannerSelected = (imageUri) => {
    setBannerUrl(imageUri);
    setBannerKey(prev => prev + 1); // Force re-render
    setShowBannerPicker(false);
  };

  const handleSave = async () => {
    // Validate username if provided
    if (username && username.trim() !== '') {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Username must be at least 3 characters long',
          visibilityTime: 2000,
        });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Username can only contain letters, numbers, and underscores',
          visibilityTime: 2000,
        });
        return;
      }
    }

    setLoading(true);

    try {
      let finalAvatarUrl = avatarUrl;
      let finalBannerUrl = bannerUrl;

      console.log('🔍 Banner URL before save:', bannerUrl);
      console.log('🔍 Avatar URL before save:', avatarUrl);

      // Upload new profile image if it's a local file
      if (avatarUrl && avatarUrl.startsWith('file://')) {
        const { uploadImage } = require('../../utils/imageUpload');
        finalAvatarUrl = await uploadImage(avatarUrl, 'profiles', '', token);
        console.log('✅ Uploaded avatar:', finalAvatarUrl);
      }

      // Upload new banner image if it's a local file
      if (bannerUrl && bannerUrl.startsWith('file://')) {
        const { uploadImage } = require('../../utils/imageUpload');
        finalBannerUrl = await uploadImage(bannerUrl, 'banners', '', token);
        console.log('✅ Uploaded banner:', finalBannerUrl);
      }

      // Prepare update payload - only include fields that have values
      const updatePayload = {
        avatar_url: finalAvatarUrl || user?.avatar_url,
        banner_url: finalBannerUrl || user?.banner_url || '',
        full_name: fullName || '',
        bio: bio || '',
        location: location || '',
        website: website || '',
      };

      console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));

      // Add social links for clients
      if (!user?.artists) {
        const socialLinks = {};
        if (instagramUrl) socialLinks.instagram = instagramUrl.trim();
        if (twitterUrl) socialLinks.twitter = twitterUrl.trim();
        if (tiktokUrl) socialLinks.tiktok = tiktokUrl.trim();
        if (Object.keys(socialLinks).length > 0) {
          updatePayload.social_links = socialLinks;
        }
      }

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
          banner_url: finalBannerUrl,
          username: username.trim(),
          full_name: fullName,
          bio: bio,
        };
        setUser(newUserData);
        // Update local state immediately
        setAvatarUrl(finalAvatarUrl);
        setBannerUrl(finalBannerUrl);
      }

      // Update artist social media links if user is an artist
      if (user?.artists) {
        const socialLinks = {};
        if (instagramUrl) socialLinks.instagram = instagramUrl.trim();
        if (twitterUrl) socialLinks.twitter = twitterUrl.trim();
        if (tiktokUrl) socialLinks.tiktok = tiktokUrl.trim();

        if (Object.keys(socialLinks).length > 0) {
          console.log('📡 Updating artist profile at:', apiUrl.substring(0, 30) + '...');
          const artistResponse = await fetch(
            `${apiUrl}/users/me/artist`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ social_links: socialLinks }),
            }
          );

          if (!artistResponse.ok) {
            const artistError = await artistResponse.json().catch(() => ({}));
            console.error('Artist update error:', artistError);
            throw new Error(artistError.error || 'Failed to update artist profile');
          }
        }
      }

      // Fetch updated user data (this will update auth store)
      await fetchUserData();

      // Also refresh profile store if user is viewing their own profile - do this immediately
      if (user?.id) {
        // Force immediate update by clearing cache and re-fetching
        useProfileStore.getState().reset();
        await fetchProfile(user.id, token);
      }

      console.log('✅ Profile update complete, banner URL should be:', finalBannerUrl);

      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Profile updated successfully',
        visibilityTime: 2000,
      });

      // Wait a bit for the profile to refresh before navigating back
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.message || 'Failed to update profile. Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
        visibilityTime: 3000,
      });
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
        {/* Banner Section with Overlapping Avatar */}
        <View style={styles.bannerSection}>
          <View style={styles.bannerImageContainer}>
            <Image
              key={bannerKey > 0 ? `banner-${bannerKey}` : 'banner-initial'}
              source={{
                uri: (() => {
                  const url = bannerUrl || 'https://via.placeholder.com/800x280';
                  // Only add cache-busting parameter if banner key changed (not on every render)
                  if (bannerKey > 0) {
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}_v=${bannerKey}`;
                  }
                  return url;
                })()
              }}
              style={styles.bannerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={300}
            />
            <TouchableOpacity
              style={styles.changeBannerButton}
              onPress={pickBannerImage}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.changeBannerText}>7:2</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar overlapping the banner */}
          <View style={styles.avatarContainer}>
            <Image
              key={avatarKey > 0 ? `avatar-${avatarKey}` : 'avatar-initial'}
              source={{
                uri: (() => {
                  const url = avatarUrl || 'https://via.placeholder.com/150';
                  // Only add cache-busting parameter if avatar key changed (not on every render)
                  if (avatarKey > 0) {
                    const separator = url.includes('?') ? '&' : '?';
                    return `${url}${separator}_v=${avatarKey}`;
                  }
                  return url;
                })()
              }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={300}
            />
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={pickProfileImage}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={16} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Header Section */}
        <View style={styles.profileHeader}>

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

        {/* Additional Info (for clients) */}
        {!user?.artists && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <View style={styles.iconInputContainer}>
                <Ionicons name="location-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.iconInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  placeholderTextColor={colors.text.disabled}
                  maxLength={100}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Website</Text>
              <View style={styles.iconInputContainer}>
                <Ionicons name="link-outline" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.iconInput}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="https://yourwebsite.com"
                  placeholderTextColor={colors.text.disabled}
                  autoCapitalize="none"
                  keyboardType="url"
                  maxLength={200}
                />
              </View>
            </View>
          </View>
        )}

        {/* Social Media Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Media</Text>
          <Text style={styles.sublabel}>
            {user?.artists
              ? 'Link your social media accounts to get verified'
              : 'Connect your social media accounts (optional)'}
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
      </ScrollView>

      {/* Banner Image Picker Modal */}
      <BannerImagePicker
        visible={showBannerPicker}
        onClose={() => setShowBannerPicker(false)}
        onImageSelected={handleBannerSelected}
        initialImage={bannerUrl}
      />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15',
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  saveText: {
    ...typography.button,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  bannerSection: {
    position: 'relative',
    marginBottom: 50, // Space for half of the overlapping avatar
  },
  bannerImageContainer: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surfaceLight,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  changeBannerButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  changeBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 0, // Remove top padding since avatar is now above
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
    position: 'absolute',
    bottom: -50, // Half of avatar height to overlap
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  changePhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 16,
    fontWeight: '600',
  },
  sublabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '400',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.border + '30',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
  iconInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  iconInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: spacing.xs,
  },
  socialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border + '30',
    paddingHorizontal: spacing.md + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
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
