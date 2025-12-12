import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { showAlert } from '../components/StyledAlert';
import { uploadImage, validateImage } from '../utils/imageUpload';
import FormBuilder from '../components/FormBuilder';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;

export default function CommissionPackagesScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [addonForm, setAddonForm] = useState({ name: '', price: '', description: '' });
  const [savingAddon, setSavingAddon] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [customFormFields, setCustomFormFields] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: '',
    estimated_delivery_days: '',
    revision_count: '2',
    is_active: true,
    example_image_urls: [],
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      base_price: '',
      estimated_delivery_days: '',
      revision_count: '2',
      is_active: true,
      example_image_urls: [],
    });
    setCustomFormFields([]);
    setEditingPackage(null);
  };

  const fetchPackages = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/commission-packages/my-packages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPackages(response.data || []);
    } catch (error) {
      console.error('Error fetching packages:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load packages',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        fetchPackages();
      }
    }, [user, token, fetchPackages])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPackages();
  };

  const handleSavePackage = async () => {
    // Validation
    if (!formData.name || !formData.base_price) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Name and base price are required',
        visibilityTime: 3000,
      });
      return;
    }

    const parsedPrice = parseFloat(formData.base_price);
    const parsedDelivery = formData.estimated_delivery_days ? parseInt(formData.estimated_delivery_days, 10) : null;
    const parsedRevisions = formData.revision_count ? parseInt(formData.revision_count, 10) : 2;

    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Price must be greater than 0',
        visibilityTime: 3000,
      });
      return;
    }

    if (parsedDelivery !== null && (Number.isNaN(parsedDelivery) || parsedDelivery < 0)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Delivery days must be 0 or more',
        visibilityTime: 3000,
      });
      return;
    }

    if (parsedRevisions !== null && (Number.isNaN(parsedRevisions) || parsedRevisions < 0)) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Revisions must be 0 or more',
        visibilityTime: 3000,
      });
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        base_price: parsedPrice,
        estimated_delivery_days: parsedDelivery,
        revision_count: parsedRevisions,
        is_active: formData.is_active,
        example_image_urls: formData.example_image_urls,
        custom_form_fields: customFormFields.length > 0 ? customFormFields : null,
      };

      if (editingPackage) {
        // Update
        await axios.put(
          `${API_URL}/commission-packages/${editingPackage.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Package updated successfully',
          visibilityTime: 2000,
        });
      } else {
        // Create
        await axios.post(
          `${API_URL}/commission-packages/create`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        Toast.show({
          type: 'success',
          text1: 'Created',
          text2: 'Package created successfully',
          visibilityTime: 2000,
        });
      }

      setShowCreateModal(false);
      resetForm();
      await fetchPackages();
    } catch (error) {
      console.error('Error saving package:', error);
      const msg = error.response?.data?.error || 'Failed to save package';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: msg,
        visibilityTime: 3000,
      });
    }
  };

  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      base_price: pkg.base_price.toString(),
      estimated_delivery_days: pkg.estimated_delivery_days?.toString() || '',
      revision_count: pkg.revision_count?.toString() || '2',
      is_active: pkg.is_active,
      example_image_urls: pkg.example_image_urls || [],
    });
    setCustomFormFields(pkg.custom_form_fields || []);
    setAddonForm({ name: '', price: '', description: '' });
    setShowCreateModal(true);
  };

  const handleDeletePackage = (pkg) => {
    showAlert({
      title: 'Delete Package',
      message: `Are you sure you want to delete "${pkg.name}"? This cannot be undone.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/commission-packages/${pkg.id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              await fetchPackages();
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Package deleted successfully',
                visibilityTime: 2000,
              });
            } catch (error) {
              console.error('Error deleting package:', error);
              const msg = error.response?.data?.error || 'Failed to delete package';
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: msg,
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
    });
  };

  const handleToggleActive = async (pkg) => {
    try {
      await axios.put(
        `${API_URL}/commission-packages/${pkg.id}`,
        { is_active: !pkg.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchPackages();
      Toast.show({
        type: 'success',
        text1: pkg.is_active ? 'Deactivated' : 'Activated',
        text2: `Package ${pkg.is_active ? 'hidden' : 'visible'} to clients`,
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error toggling package:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update package',
        visibilityTime: 3000,
      });
    }
  };

  const handleAddImage = async () => {
    try {
      if (formData.example_image_urls.length >= 3) {
        Toast.show({
          type: 'info',
          text1: 'Limit reached',
          text2: 'You can add up to 3 preview images',
          visibilityTime: 2500,
        });
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission required',
          text2: 'Allow photo access to upload images.',
          visibilityTime: 3000,
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;

      await validateImage(uri);
      setUploadingImage(true);
      const url = await uploadImage(uri, 'artworks', '', token);
      setFormData((prev) => ({
        ...prev,
        example_image_urls: [...prev.example_image_urls, url],
      }));
    } catch (error) {
      console.error('Error adding package image:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: error.message || 'Could not upload image',
        visibilityTime: 3000,
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddAddon = async () => {
    if (!editingPackage) {
      Toast.show({
        type: 'info',
        text1: 'Save package first',
        text2: 'Create the package, then add add-ons.',
        visibilityTime: 2500,
      });
      return;
    }

    if (!addonForm.name.trim() || !addonForm.price.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Add-on name and price are required',
        visibilityTime: 2500,
      });
      return;
    }

    const priceValue = parseFloat(addonForm.price);
    if (Number.isNaN(priceValue) || priceValue < 0) {
      Toast.show({
        type: 'error',
        text1: 'Validation',
        text2: 'Price must be 0 or more',
        visibilityTime: 2500,
      });
      return;
    }

    try {
      setSavingAddon(true);
      await axios.post(
        `${API_URL}/commission-packages/${editingPackage.id}/addons`,
        {
          name: addonForm.name.trim(),
          description: addonForm.description.trim() || null,
          price: priceValue,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchPackages();
      const fresh = (packages || []).find((p) => p.id === editingPackage.id);
      if (fresh) {
        setEditingPackage(fresh);
      }
      setAddonForm({ name: '', price: '', description: '' });
      Toast.show({
        type: 'success',
        text1: 'Add-on added',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error adding add-on:', error);
      const msg = error.response?.data?.error || 'Failed to add add-on';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: msg,
        visibilityTime: 2500,
      });
    } finally {
      setSavingAddon(false);
    }
  };

  const handleDeleteAddon = async (addonId) => {
    try {
      await axios.delete(`${API_URL}/commission-packages/addons/${addonId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchPackages();
      const fresh = (packages || []).find((p) => p.id === editingPackage?.id);
      if (fresh) setEditingPackage(fresh);
      Toast.show({
        type: 'success',
        text1: 'Add-on removed',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error deleting add-on:', error);
      const msg = error.response?.data?.error || 'Failed to delete add-on';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: msg,
        visibilityTime: 2500,
      });
    }
  };

  const renderPackage = ({ item }) => (
    <View style={[styles.packageCard, !item.is_active && styles.packageCardInactive]}>
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleRow}>
          <Text style={styles.packageName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
            <View style={[styles.statusDot, item.is_active ? styles.activeDot : styles.inactiveDot]} />
            <Text style={[styles.statusBadgeText, item.is_active ? styles.activeBadgeText : styles.inactiveBadgeText]}>
              {item.is_active ? 'ACTIVE' : 'HIDDEN'}
            </Text>
          </View>
        </View>
        <Text style={styles.packagePrice}>${item.base_price}</Text>
      </View>

      {item.description && (
        <Text style={styles.packageDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.packageMeta}>
        {item.estimated_delivery_days && (
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.metaText}>{item.estimated_delivery_days} days</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="refresh-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.metaText}>{item.revision_count || 0} revisions</Text>
        </View>
      </View>

      <View style={styles.packageActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleActive(item)}
        >
          <Ionicons
            name={item.is_active ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.text.secondary}
          />
          <Text style={styles.actionButtonText}>
            {item.is_active ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditPackage(item)}
        >
          <Ionicons name="pencil-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeletePackage(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.status.error} />
          <Text style={[styles.actionButtonText, { color: colors.status.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission Packages</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={packages}
        renderItem={renderPackage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          packages.length === 0 && styles.emptyStateContainer,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyTitle}>No packages yet</Text>
            <Text style={styles.emptySubtitle}>
              Create commission packages to let clients know what you offer and your pricing
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, { bottom: insets.bottom + 20 }]}
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color={colors.text.primary} />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPackage ? 'Edit Package' : 'New Package'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Package Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g. Full Body Character"
                placeholderTextColor={colors.text.disabled}
              />

              <Text style={styles.inputLabel}>Base Price ($) *</Text>
              <TextInput
                style={styles.input}
                value={formData.base_price}
                onChangeText={(text) => setFormData({ ...formData, base_price: text })}
                placeholder="e.g. 150"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Describe what's included in this package..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
              />

              <View style={styles.imagesHeader}>
                <Text style={styles.inputLabel}>Preview Images</Text>
                <TouchableOpacity
                  style={[styles.addImageButton, uploadingImage && styles.addImageButtonDisabled]}
                  onPress={handleAddImage}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={18} color={colors.text.primary} />
                      <Text style={styles.addImageButtonText}>Add image</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {formData.example_image_urls.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageList}
                >
                  {formData.example_image_urls.map((url, idx) => (
                    <View key={url} style={styles.imageThumb}>
                      <Image source={{ uri: url }} style={styles.imageThumbImg} />
                      <TouchableOpacity
                        style={styles.removeImage}
                        onPress={() => {
                          setFormData((prev) => ({
                            ...prev,
                            example_image_urls: prev.example_image_urls.filter((_, i) => i !== idx),
                          }));
                        }}
                      >
                        <Ionicons name="close" size={14} color={colors.text.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {editingPackage && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Add-ons</Text>
                  <View style={styles.addonList}>
                    {(editingPackage.addons || []).length === 0 ? (
                      <Text style={styles.addonEmpty}>No add-ons yet</Text>
                    ) : (
                      editingPackage.addons.map((addon) => (
                        <View key={addon.id} style={styles.addonRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.addonName}>{addon.name}</Text>
                            {addon.description ? (
                              <Text style={styles.addonDesc} numberOfLines={2}>{addon.description}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.addonPrice}>${addon.price}</Text>
                          <TouchableOpacity style={styles.addonDelete} onPress={() => handleDeleteAddon(addon.id)}>
                            <Ionicons name="trash-outline" size={18} color={colors.status.error} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.addonForm}>
                    <TextInput
                      style={[styles.input, styles.addonInput]}
                      value={addonForm.name}
                      onChangeText={(text) => setAddonForm({ ...addonForm, name: text })}
                      placeholder="Add-on name (e.g., Background)"
                      placeholderTextColor={colors.text.disabled}
                    />
                    <TextInput
                      style={[styles.input, styles.addonInput]}
                      value={addonForm.price}
                      onChangeText={(text) => setAddonForm({ ...addonForm, price: text })}
                      placeholder="Price (e.g., 20)"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.input, styles.textArea, styles.addonInput]}
                      value={addonForm.description}
                      onChangeText={(text) => setAddonForm({ ...addonForm, description: text })}
                      placeholder="Short description (optional)"
                      placeholderTextColor={colors.text.disabled}
                      multiline
                      numberOfLines={2}
                    />
                    <TouchableOpacity
                      style={[styles.saveButton, savingAddon && styles.saveButtonDisabled, { marginTop: spacing.sm }]}
                      onPress={handleAddAddon}
                      disabled={savingAddon}
                    >
                      {savingAddon ? (
                        <ActivityIndicator color={colors.text.primary} />
                      ) : (
                        <Text style={styles.saveButtonText}>Add add-on</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Estimated Delivery (days)</Text>
              <TextInput
                style={styles.input}
                value={formData.estimated_delivery_days}
                onChangeText={(text) => setFormData({ ...formData, estimated_delivery_days: text })}
                placeholder="e.g. 7"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>Revisions Included</Text>
              <TextInput
                style={styles.input}
                value={formData.revision_count}
                onChangeText={(text) => setFormData({ ...formData, revision_count: text })}
                placeholder="e.g. 2"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                <View style={[styles.checkbox, formData.is_active && styles.checkboxChecked]}>
                  {formData.is_active && (
                    <Ionicons name="checkmark" size={16} color={colors.text.primary} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Visible to clients</Text>
              </TouchableOpacity>

              {/* Custom Form Builder Section */}
              <View style={styles.formBuilderSection}>
                <View style={styles.formBuilderHeader}>
                  <Text style={styles.inputLabel}>Custom Form Fields</Text>
                  <TouchableOpacity
                    style={styles.formBuilderButton}
                    onPress={() => setShowFormBuilder(true)}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                    <Text style={styles.formBuilderButtonText}>
                      {customFormFields.length > 0 ? 'Edit Form' : 'Build Form'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {customFormFields.length > 0 && (
                  <View style={styles.formFieldsPreview}>
                    <Text style={styles.formFieldsCount}>
                      {customFormFields.length} field{customFormFields.length !== 1 ? 's' : ''} configured
                    </Text>
                    <Text style={styles.formFieldsHint}>
                      Clients will see these fields when requesting this package
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSavePackage}>
                <Text style={styles.saveButtonText}>
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Form Builder Modal */}
      <Modal
        visible={showFormBuilder}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowFormBuilder(false)}
      >
        <FormBuilder
          formFields={customFormFields}
          onSave={(fields) => {
            setCustomFormFields(fields);
            setShowFormBuilder(false);
            Toast.show({
              type: 'success',
              text1: 'Form Saved',
              text2: `${fields.length} field${fields.length !== 1 ? 's' : ''} configured`,
            });
          }}
          onCancel={() => setShowFormBuilder(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  packageCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  packageCardInactive: {
    opacity: 0.6,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  packageTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.sm,
  },
  packageName: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.text.disabled + '20',
  },
  activeBadge: {
    backgroundColor: colors.status.success + '20',
  },
  inactiveBadge: {
    backgroundColor: colors.text.disabled + '20',
  },
  statusBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeBadgeText: {
    color: colors.status.success,
  },
  inactiveBadgeText: {
    color: colors.text.disabled,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  activeDot: {
    backgroundColor: colors.status.success,
  },
  inactiveDot: {
    backgroundColor: colors.text.disabled,
  },
  packagePrice: {
    ...typography.h2,
    color: colors.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  packageDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  packageMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  packageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  createButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.large,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addImageButtonDisabled: {
    opacity: 0.6,
  },
  addImageButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  imageList: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  imageThumb: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
  },
  imageThumbImg: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.overlay,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
  },
  formBuilderSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formBuilderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  formBuilderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.md,
  },
  formBuilderButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  formFieldsPreview: {
    marginTop: spacing.sm,
  },
  formFieldsCount: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  formFieldsHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.medium,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  addonList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  addonEmpty: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addonName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  addonDesc: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  addonPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  addonDelete: {
    padding: spacing.xs,
  },
  addonForm: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  addonInput: {
    minHeight: 44,
  },
});
