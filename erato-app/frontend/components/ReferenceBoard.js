import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { uploadImage } from '../utils/imageUpload';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const ITEM_SPACING = spacing.sm;
const ITEM_WIDTH = (width - spacing.md * 2 - ITEM_SPACING) / NUM_COLUMNS;

const REFERENCE_TYPES = [
  { id: 'image', label: 'Image', icon: 'image-outline' },
  { id: 'mood_board', label: 'Mood Board', icon: 'grid-outline' },
  { id: 'color_palette', label: 'Color Palette', icon: 'color-palette-outline' },
  { id: 'character_sheet', label: 'Character Sheet', icon: 'person-outline' },
  { id: 'link', label: 'Link', icon: 'link-outline' },
];

export default function ReferenceBoard({ commissionId, onReferenceAdded, onReferenceRemoved, onClose }) {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [references, setReferences] = useState([]);
  const [groupedReferences, setGroupedReferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState('image');
  const [uploading, setUploading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    colors: [],
  });

  useEffect(() => {
    fetchReferences();
  }, [commissionId]);

  const fetchReferences = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/references/commission/${commissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data.data || {};
      setReferences(data.all || []);
      setGroupedReferences(data.grouped || {});
    } catch (error) {
      console.error('Error fetching references:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load references',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddReference = () => {
    setFormData({ title: '', description: '', url: '', colors: [] });
    setSelectedType('image');
    setShowAddModal(true);
  };

  const handleImageUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Please allow photo access',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets) return;

      setUploading(true);

      // Upload each image as a separate reference
      for (const asset of result.assets) {
        try {
          // Upload image using the utility function first
          const imageUrl = await uploadImage(asset.uri, 'artworks', '', token);
          
          if (imageUrl) {
            // Create reference with the uploaded image URL
            await axios.post(
              `${API_URL}/references/commission/${commissionId}`,
              {
                file_url: imageUrl,
                reference_type: selectedType,
                title: formData.title || 'Reference Image',
                description: formData.description || '',
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );
          }
        } catch (error) {
          console.error('Error uploading reference image:', error);
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: error.response?.data?.error || 'Failed to upload image',
            visibilityTime: 3000,
          });
          // Continue with other images even if one fails
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Uploaded',
        text2: `${result.assets.length} image(s) added`,
      });

      setShowAddModal(false);
      await fetchReferences();
      if (onReferenceAdded) onReferenceAdded();
    } catch (error) {
      console.error('Error uploading reference:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: error.response?.data?.error || 'Failed to upload images',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!formData.url || !formData.url.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Please enter a URL',
      });
      return;
    }

    try {
      await axios.post(
        `${API_URL}/references/link`,
        {
          commissionId,
          title: formData.title || 'Reference Link',
          url: formData.url,
          description: formData.description,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Added',
        text2: 'Link reference added',
      });

      setShowAddModal(false);
      await fetchReferences();
      if (onReferenceAdded) onReferenceAdded();
    } catch (error) {
      console.error('Error adding link:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add link',
      });
    }
  };

  const handleAddColorPalette = async () => {
    if (formData.colors.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Please add at least one color',
      });
      return;
    }

    try {
      await axios.post(
        `${API_URL}/references/color-palette`,
        {
          commissionId,
          title: formData.title || 'Color Palette',
          colors: formData.colors,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Added',
        text2: 'Color palette added',
      });

      setShowAddModal(false);
      await fetchReferences();
      if (onReferenceAdded) onReferenceAdded();
    } catch (error) {
      console.error('Error adding color palette:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to add color palette',
      });
    }
  };

  const handleDeleteReference = async (referenceId) => {
    Alert.alert(
      'Delete Reference',
      'Are you sure you want to delete this reference?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${API_URL}/references/${referenceId}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              await fetchReferences();
              if (onReferenceRemoved) onReferenceRemoved();
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Reference removed',
              });
            } catch (error) {
              console.error('Error deleting reference:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to delete reference',
              });
            }
          },
        },
      ]
    );
  };

  const handleSubmit = () => {
    if (selectedType === 'link') {
      handleAddLink();
    } else if (selectedType === 'color_palette') {
      handleAddColorPalette();
    } else {
      handleImageUpload();
    }
  };

  const getFilteredReferences = () => {
    if (activeFilter === 'all') return references;
    return references.filter(ref => ref.reference_type === activeFilter);
  };

  const renderReference = ({ item }) => {
    if (item.reference_type === 'color_palette') {
      return <ColorPaletteCard reference={item} onDelete={handleDeleteReference} />;
    }
    if (item.reference_type === 'link') {
      return <LinkCard reference={item} onDelete={handleDeleteReference} />;
    }
    return <ImageCard reference={item} onDelete={handleDeleteReference} />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const filteredRefs = getFilteredReferences();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>References</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddReference}>
          <Ionicons name="add" size={20} color={colors.text.primary} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Pinterest-style Filter Bar */}
      <View style={styles.pinterestFilterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pinterestFilterContent}
        >
          <TouchableOpacity
            style={styles.pinterestFilterItem}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.pinterestFilterText,
              activeFilter === 'all' && styles.pinterestFilterTextActive
            ]}>
              All
            </Text>
            {activeFilter === 'all' && <View style={styles.pinterestFilterUnderline} />}
          </TouchableOpacity>
          {REFERENCE_TYPES.map(type => {
            const isSelected = activeFilter === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={styles.pinterestFilterItem}
                onPress={() => setActiveFilter(type.id)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.pinterestFilterText,
                  isSelected && styles.pinterestFilterTextActive
                ]}>
                  {type.label}
                </Text>
                {isSelected && <View style={styles.pinterestFilterUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* References Grid */}
      {filteredRefs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyText}>No references yet</Text>
          <Text style={styles.emptySubtext}>Add images, links, or color palettes</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRefs}
          renderItem={renderReference}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add Reference Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Reference</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Type Selection */}
              <Text style={styles.inputLabel}>Reference Type</Text>
              <View style={styles.typeGrid}>
                {REFERENCE_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeCard,
                      selectedType === type.id && styles.typeCardActive
                    ]}
                    onPress={() => setSelectedType(type.id)}
                  >
                    <Ionicons
                      name={type.icon}
                      size={28}
                      color={selectedType === type.id ? colors.primary : colors.text.secondary}
                    />
                    <Text style={[
                      styles.typeLabel,
                      selectedType === type.id && styles.typeLabelActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Enter title (optional)"
                placeholderTextColor={colors.text.disabled}
              />

              {/* Description */}
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter description (optional)"
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={3}
              />

              {/* Type-specific fields */}
              {selectedType === 'link' && (
                <>
                  <Text style={styles.inputLabel}>URL *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.url}
                    onChangeText={(text) => setFormData({ ...formData, url: text })}
                    placeholder="https://..."
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </>
              )}

              {selectedType === 'color_palette' && (
                <ColorPaletteBuilder
                  colors={formData.colors}
                  onChange={(colors) => setFormData({ ...formData, colors })}
                />
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {selectedType === 'link' ? 'Add Link' : selectedType === 'color_palette' ? 'Add Palette' : 'Upload'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


function ImageCard({ reference, onDelete }) {
  return (
    <View style={styles.imageCard}>
      <ExpoImage
        source={{ uri: reference.file_url || reference.thumbnail_url }}
        style={styles.image}
        contentFit="cover"
      />
      {reference.title && (
        <View style={styles.imageOverlay}>
          <Text style={styles.imageTitle} numberOfLines={1}>
            {reference.title}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(reference.id)}
      >
        <Ionicons name="close-circle" size={24} color={colors.status.error} />
      </TouchableOpacity>
    </View>
  );
}

function ColorPaletteCard({ reference, onDelete }) {
  const colors = reference.metadata?.colors || [];
  
  return (
    <View style={styles.paletteCard}>
      <View style={styles.paletteColors}>
        {colors.map((color, index) => (
          <View
            key={index}
            style={[styles.colorSwatch, { backgroundColor: color.hex || color }]}
          />
        ))}
      </View>
      {reference.title && (
        <Text style={styles.paletteTitle} numberOfLines={1}>
          {reference.title}
        </Text>
      )}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(reference.id)}
      >
        <Ionicons name="close-circle" size={24} color={colors.status.error} />
      </TouchableOpacity>
    </View>
  );
}

function LinkCard({ reference, onDelete }) {
  return (
    <View style={styles.linkCard}>
      <Ionicons name="link" size={32} color={colors.primary} />
      {reference.title && (
        <Text style={styles.linkTitle} numberOfLines={2}>
          {reference.title}
        </Text>
      )}
      {reference.description && (
        <Text style={styles.linkDescription} numberOfLines={2}>
          {reference.description}
        </Text>
      )}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(reference.id)}
      >
        <Ionicons name="close-circle" size={24} color={colors.status.error} />
      </TouchableOpacity>
    </View>
  );
}

function ColorPaletteBuilder({ colors: paletteColors, onChange }) {
  const [colorInput, setColorInput] = useState('');

  const addColor = () => {
    const hex = colorInput.trim();
    if (!hex) return;

    // Validate hex color
    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Color',
        text2: 'Please enter a valid hex color (e.g., #FF5733)',
      });
      return;
    }

    onChange([...paletteColors, { hex, name: hex }]);
    setColorInput('');
  };

  const removeColor = (index) => {
    onChange(paletteColors.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.paletteBuilder}>
      <Text style={styles.inputLabel}>Colors</Text>
      <View style={styles.colorInputRow}>
        <View style={styles.colorPreviewContainer}>
          {colorInput && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorInput.trim()) && (
            <View style={[styles.colorPreview, { backgroundColor: colorInput.trim() }]} />
          )}
        </View>
        <TextInput
          style={[styles.input, styles.colorInput]}
          value={colorInput}
          onChangeText={setColorInput}
          placeholder="#FF5733"
          placeholderTextColor={colors.text.disabled}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.addColorButton} onPress={addColor}>
          <Ionicons name="add" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {paletteColors.length > 0 && (
        <View style={styles.colorList}>
          {paletteColors.map((color, index) => (
            <View key={index} style={styles.colorItem}>
              {(() => {
                const colorValue = color.hex || color || '';
                const hexColor = colorValue.startsWith('#') ? colorValue : `#${colorValue}`;
                return (
                  <>
                    <View style={[styles.colorSwatch, { backgroundColor: hexColor }]} />
                    <Text style={styles.colorText}>{colorValue}</Text>
                    <TouchableOpacity onPress={() => removeColor(index)} style={styles.removeColorButton}>
                      <Ionicons name="close-circle" size={20} color={colors.status.error} />
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    minHeight: 50,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  pinterestFilterBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  pinterestFilterContent: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  pinterestFilterItem: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  pinterestFilterText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pinterestFilterTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  pinterestFilterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.text.primary,
    borderRadius: 1,
  },
  grid: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: ITEM_SPACING,
  },
  imageCard: {
    width: ITEM_WIDTH,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: {
    width: '100%',
    height: ITEM_WIDTH * 1.2,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.overlay,
    padding: spacing.xs,
  },
  imageTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  deleteButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.background + 'CC',
    borderRadius: borderRadius.full,
  },
  paletteCard: {
    width: ITEM_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  paletteColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  paletteTitle: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  linkCard: {
    width: ITEM_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ITEM_WIDTH,
  },
  linkTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  linkDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.md,
    maxHeight: '70%',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeCard: {
    width: (width - spacing.md * 2 - spacing.sm * 2) / 3,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  typeLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  typeLabelActive: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  inputLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  paletteBuilder: {
    marginTop: spacing.md,
  },
  colorInputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  colorPreviewContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPreview: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorInput: {
    flex: 1,
    minHeight: 44,
  },
  addColorButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  colorList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  colorText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
  },
  removeColorButton: {
    padding: spacing.xs,
  },
});



