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
      Alert.alert('Permission needed', 'Please allow access to your photos');
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
      Alert.alert('Error', 'Please select an image');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
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
      Alert.alert('Error', error.message || 'Failed to upload artwork. Please try again.');
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
          disabled={loading || !imageUri || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.uploadText,
                (!imageUri || !title.trim()) && styles.uploadTextDisabled,
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
            <Text style={styles.label}>Tags</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="digital art, portrait, fantasy (comma separated)"
              placeholderTextColor={colors.text.disabled}
              editable={!loading}
            />
            <Text style={styles.hint}>Add tags to help people discover your work</Text>
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
  uploadButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  uploadText: {
    ...typography.button,
    color: colors.primary,
    fontWeight: '600',
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  changeImageText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  imagePlaceholder: {
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
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  uploadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  form: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  charCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
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
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guidelinesTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  guidelineText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: 16,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  ratioScroll: {
    marginBottom: spacing.sm,
  },
  ratioOption: {
    alignItems: 'center',
    marginRight: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 80,
  },
  ratioOptionActive: {
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: `${colors.primary}15`,
  },
  ratioPreview: {
    width: 44,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: colors.border,
  },
  ratioLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    textAlign: 'center',
  },
  ratioLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
