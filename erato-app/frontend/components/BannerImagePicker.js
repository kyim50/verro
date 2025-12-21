import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BannerImagePicker({
  visible,
  onClose,
  onImageSelected,
  initialImage = null,
}) {
  const [selectedImage, setSelectedImage] = useState(initialImage);

  React.useEffect(() => {
    if (visible) {
      setSelectedImage(initialImage);
    }
  }, [visible, initialImage]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [16, 9], // Banner aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setSelectedImage(imageUri);
        onImageSelected(imageUri);
        onClose();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleCancel = () => {
    setSelectedImage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose Banner</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {selectedImage ? (
            <View style={styles.imagePreview}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.previewImage}
                contentFit="cover"
              />
              <Text style={styles.previewText}>Banner selected!</Text>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.placeholderText}>Select a banner image</Text>
            </View>
          )}

          <TouchableOpacity onPress={pickImage} style={styles.pickButton}>
            <Ionicons name="images" size={24} color={colors.text.primary} />
            <Text style={styles.pickButtonText}>
              {selectedImage ? 'Change Photo' : 'Choose Photo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15',
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    alignItems: 'center',
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.md,
    fontSize: 16,
    marginBottom: spacing.xl,
  },
  imagePreview: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  previewImage: {
    width: SCREEN_WIDTH - (spacing.xl * 2),
    height: 200,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  previewText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pickButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
