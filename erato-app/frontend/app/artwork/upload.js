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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store';
import { uploadImage, validateImage } from '../../utils/imageUpload';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function UploadArtworkScreen() {
  const { token, user } = useAuthStore();
  const [imageUri, setImageUri] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState([4, 5]); // Default 4:5 ratio

  const aspectRatioOptions = [
    { label: '4:5 (Portrait)', value: [4, 5] },
    { label: '1:1 (Square)', value: [1, 1] },
    { label: '3:4 (Portrait)', value: [3, 4] },
    { label: '2:3 (Portrait)', value: [2, 3] },
  ];


  // Reset states when component mounts
  useEffect(() => {
    return () => {
      setLoading(false);
      setUploading(false);
    };
  }, []);

  const pickImage = async () => {
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
      aspect: aspectRatio,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    // Validation
    if (!imageUri) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please select an image',
        visibilityTime: 2000,
      });
      return;
    }
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a title',
        visibilityTime: 2000,
      });
      return;
    }

    // Validate tags (at least one tag required)
    const tagArray = tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    if (tagArray.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Tags Required',
        text2: 'Please add at least one tag to help people discover your work',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // Validate image
      await validateImage(imageUri);

      // Upload to Supabase Storage via backend API
      const imageUrl = await uploadImage(imageUri, 'artworks', '', token);

      // Parse tags
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Create artwork in database
      const apiUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.verrocio.com/api';
      console.log('📡 Creating artwork at:', apiUrl.substring(0, 30) + '...');
      const response = await fetch(
        `${apiUrl}/artworks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            imageUrl: imageUrl,
            thumbnailUrl: imageUrl, // Use same URL, or generate thumbnail
            tags: tagArray,
            isFeatured,
            aspectRatio: `${aspectRatio[0]}:${aspectRatio[1]}`, // Store aspect ratio
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload artwork');
      }

      // Navigate directly to home screen without alert
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Error uploading artwork:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to upload artwork. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setLoading(false);
            setUploading(false);
            // Use replace and navigate to dismiss upload and go to home tab
            if (router.canGoBack()) {
              router.dismissAll();
            }
            router.replace('/(tabs)/home');
          }}
        >
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Artwork</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUpload}
          disabled={loading || !imageUri || !title.trim() || !tags.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.uploadText,
                (!imageUri || !title.trim() || !tags.trim()) && styles.uploadTextDisabled,
              ]}
            >
              Post
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Aspect Ratio Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose Aspect Ratio</Text>
          <Text style={styles.sectionHint}>Select your preferred aspect ratio before choosing an image</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratioScroll}>
            {aspectRatioOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.ratioOption,
                  aspectRatio[0] === option.value[0] && aspectRatio[1] === option.value[1] && styles.ratioOptionActive
                ]}
                onPress={() => {
                  setAspectRatio(option.value);
                }}
                disabled={loading}
              >
                <View style={[
                  styles.ratioPreview,
                  { aspectRatio: option.value[0] / option.value[1] }
                ]} />
                <Text style={[
                  styles.ratioLabel,
                  aspectRatio[0] === option.value[0] && aspectRatio[1] === option.value[1] && styles.ratioLabelActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Image Picker */}
        <TouchableOpacity
          style={[
            styles.imagePickerContainer,
            { aspectRatio: aspectRatio[0] / aspectRatio[1] }
          ]}
          onPress={pickImage}
          disabled={loading}
        >
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
              <TouchableOpacity style={styles.changeImageButton} onPress={pickImage}>
                <Ionicons name="camera" size={20} color={colors.text.primary} />
                <Text style={styles.changeImageText}>Change Image</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.placeholderText}>Tap to select an image</Text>
              <Text style={styles.placeholderSubtext}>
                {aspectRatioOptions.find(opt => opt.value[0] === aspectRatio[0] && opt.value[1] === aspectRatio[1])?.label || 'Select ratio above'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {uploading && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.uploadingText}>Uploading image to cloud storage...</Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Give your artwork a title"
              placeholderTextColor={colors.text.disabled}
              maxLength={100}
              editable={!loading}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your artwork, process, or inspiration..."
              placeholderTextColor={colors.text.disabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
              editable={!loading}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Tags <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="digital art, portrait, fantasy (comma separated)"
              placeholderTextColor={colors.text.disabled}
              editable={!loading}
            />
            <Text style={styles.hint}>At least one tag is required to help people discover your work</Text>
            {tags.trim() && (
              <View style={styles.tagPreview}>
                {tags.split(',').map((tag, index) => {
                  const trimmedTag = tag.trim();
                  return trimmedTag ? (
                    <View key={index} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{trimmedTag}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </View>

          <View style={styles.switchContainer}>
            <View style={styles.switchLabel}>
              <Ionicons name="star" size={20} color={colors.primary} />
              <Text style={styles.switchText}>Feature on your profile</Text>
            </View>
            <TouchableOpacity
              style={[styles.switch, isFeatured && styles.switchActive]}
              onPress={() => setIsFeatured(!isFeatured)}
              disabled={loading}
            >
              <View style={[styles.switchThumb, isFeatured && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelines}>
          <Text style={styles.guidelinesTitle}>Upload Guidelines</Text>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.guidelineText}>High-quality images (max 10MB)</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.guidelineText}>Original artwork you created</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.guidelineText}>Appropriate content only</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 0,
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
  uploadButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    ...typography.button,
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  uploadTextDisabled: {
    color: colors.text.disabled,
  },
  content: {
    padding: spacing.lg,
  },
  imagePickerContainer: {
    width: '100%',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  changeImageButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  changeImageText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border + '30',
    borderStyle: 'dashed',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  placeholderSubtext: {
    ...typography.caption,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  uploadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    fontSize: 16,
    fontWeight: '600',
  },
  required: {
    color: colors.error,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    color: colors.text.primary,
    ...typography.body,
    fontSize: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.lg,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '400',
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontWeight: '400',
  },
  tagPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tagChip: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 0,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tagChipText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600',
    fontSize: 13,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text.primary,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  guidelines: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  guidelinesTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  guidelineText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontSize: 13,
    fontWeight: '400',
  },
  ratioScroll: {
    marginBottom: spacing.sm,
  },
  ratioOption: {
    alignItems: 'center',
    marginRight: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 16,
    borderWidth: 0,
    backgroundColor: colors.background,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  ratioOptionActive: {
    backgroundColor: colors.text.primary,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  ratioPreview: {
    width: 44,
    backgroundColor: colors.border + '30',
    borderRadius: 8,
    marginBottom: spacing.xs,
    borderWidth: 0,
  },
  ratioLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  ratioLabelActive: {
    color: colors.background,
    fontWeight: '700',
  },
});
