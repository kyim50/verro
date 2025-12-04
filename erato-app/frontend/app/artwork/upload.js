import { useState } from 'react';
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
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

      // Upload to Supabase Storage
      const imageUrl = await uploadImage(imageUri, 'artworks');

      // Parse tags
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      // Create artwork in database
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}/artworks`,
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
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload artwork');
      }

      Alert.alert('Success!', 'Artwork uploaded successfully', [
        {
          text: 'Upload Another',
          onPress: () => {
            setImageUri('');
            setTitle('');
            setDescription('');
            setTags('');
            setIsFeatured(false);
          },
        },
        {
          text: 'Go to Profile',
          onPress: () => router.replace('/(tabs)/profile'),
        },
      ]);
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
          onPress={() => router.back()}
          disabled={loading}
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
        {/* Image Picker */}
        <TouchableOpacity
          style={styles.imagePickerContainer}
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
              <Text style={styles.placeholderSubtext}>Recommended: 4:5 ratio</Text>
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
    aspectRatio: 4 / 5,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    position: 'relative',
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
});
