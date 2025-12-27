import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows, components } from '../constants/theme';
import { showAlert } from '../components/StyledAlert';
import { uploadImage, validateImage } from '../utils/imageUpload';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;

export default function CommissionManagement() {
  const { token, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' or 'packages'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Settings State
  const [queueSlots, setQueueSlots] = useState('3');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [autoPromoteWaitlist, setAutoPromoteWaitlist] = useState(false);
  const [commissionsPaused, setCommissionsPaused] = useState(false);
  const [willDraw, setWillDraw] = useState('');
  const [wontDraw, setWontDraw] = useState('');
  const [termsOfService, setTermsOfService] = useState('');

  // Packages State
  const [packages, setPackages] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [addonForm, setAddonForm] = useState({ name: '', price: '', description: '' });
  const [savingAddon, setSavingAddon] = useState(false);

  // Package Form State
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
    setEditingPackage(null);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSettings(), fetchPackages()]);
    setLoading(false);
  }, [loadSettings, fetchPackages]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_URL}/artists/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const settings = response.data.settings || {};

      setQueueSlots(settings.max_queue_slots?.toString() || settings.queue_slots?.toString() || '5');
      setWaitlistEnabled(settings.allow_waitlist || settings.waitlist_enabled || false);
      setAutoPromoteWaitlist(settings.auto_promote_waitlist || false);
      setCommissionsPaused(!settings.is_open || settings.commissions_paused || false);
      setWillDraw(Array.isArray(settings.will_draw) ? settings.will_draw.join(', ') : (settings.will_draw || ''));
      setWontDraw(Array.isArray(settings.wont_draw) ? settings.wont_draw.join(', ') : (settings.wont_draw || ''));
      setTermsOfService(settings.terms_of_service || '');
    } catch (error) {
      console.error('Error loading settings:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to load commission settings',
        type: 'error',
        duration: 2000,
      });
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const saveSettings = async (showToast = true) => {
    if (saving) return;

    try {
      setSaving(true);

      const settings = {
        max_queue_slots: parseInt(queueSlots) || 5,
        allow_waitlist: waitlistEnabled,
        auto_promote_waitlist: autoPromoteWaitlist,
        is_open: !commissionsPaused,
        will_draw: willDraw.trim() ? willDraw.split(',').map(s => s.trim()).filter(Boolean) : [],
        wont_draw: wontDraw.trim() ? wontDraw.split(',').map(s => s.trim()).filter(Boolean) : [],
        terms_of_service: termsOfService.trim() || null,
        status_message: null,
        avg_response_hours: null,
      };

      await axios.put(
        `${API_URL}/artists/settings`,
        { settings },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (showToast) {
        showAlert({
          title: 'Saved',
          message: 'Commission settings updated',
          type: 'success',
          duration: 1500,
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save settings',
        type: 'error',
        duration: 2000,
      });
    } finally {
      setSaving(false);
    }
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
    }
  }, [token]);

  const handleSavePackage = async () => {
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

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        base_price: parsedPrice,
        estimated_delivery_days: parsedDelivery,
        revision_count: parsedRevisions,
        is_active: formData.is_active,
        example_image_urls: formData.example_image_urls,
      };

      if (editingPackage) {
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
        mediaTypes: ["images"],
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
            <Text style={styles.metaText}><Text style={{ fontWeight: '700' }}>{item.estimated_delivery_days}</Text> days</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="refresh-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.metaText}><Text style={{ fontWeight: '700' }}>{item.revision_count || 0}</Text> revisions</Text>
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commission Management</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission Management</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={activeTab === 'settings' ? colors.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'packages' && styles.tabActive]}
          onPress={() => setActiveTab('packages')}
        >
          <Ionicons
            name="pricetag-outline"
            size={20}
            color={activeTab === 'packages' ? colors.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>
            Packages ({packages.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'settings' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Commission Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Commission Status</Text>
            </View>

            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Commissions Paused</Text>
                  <Text style={styles.settingDescription}>
                    Temporarily stop accepting new commissions
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, commissionsPaused && styles.switchActive]}
                  onPress={() => {
                    setCommissionsPaused(!commissionsPaused);
                    setTimeout(() => {
                      saveSettings(false);
                    }, 300);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.switchThumb, commissionsPaused && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Queue Settings */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="albums" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Queue Management</Text>
            </View>

            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Queue Slots</Text>
                  <Text style={styles.settingDescription}>
                    Max active commissions at once
                  </Text>
                </View>
                <TextInput
                  style={styles.numberInput}
                  value={queueSlots}
                  onChangeText={setQueueSlots}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlignVertical="center"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Enable Waitlist</Text>
                  <Text style={styles.settingDescription}>
                    Allow clients to join waitlist when full
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.switch, waitlistEnabled && styles.switchActive]}
                  onPress={() => {
                    setWaitlistEnabled(!waitlistEnabled);
                    setTimeout(() => {
                      saveSettings(false);
                    }, 300);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.switchThumb, waitlistEnabled && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>

              {/* Auto-Promote Waitlist */}
              {waitlistEnabled && (
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Auto-Promote from Waitlist</Text>
                    <Text style={styles.settingDescription}>
                      Automatically move waitlisted commissions to active when slots open
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switch, autoPromoteWaitlist && styles.switchActive]}
                    onPress={() => {
                      setAutoPromoteWaitlist(!autoPromoteWaitlist);
                      setTimeout(() => {
                        saveSettings(false);
                      }, 300);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.switchThumb, autoPromoteWaitlist && styles.switchThumbActive]} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Will/Won't Draw */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="brush" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Content Preferences</Text>
            </View>

            <View style={styles.settingCard}>
              <Text style={styles.inputLabel}>What I Will Draw</Text>
              <Text style={styles.inputHint}>
                Separate items with commas
              </Text>
              <TextInput
                style={styles.multilineInput}
                placeholder="e.g., Fantasy characters, Portraits, Landscapes"
                placeholderTextColor={colors.text.disabled}
                value={willDraw}
                onChangeText={setWillDraw}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.settingCard, styles.marginTop]}>
              <Text style={styles.inputLabel}>What I Won't Draw</Text>
              <Text style={styles.inputHint}>
                Separate items with commas
              </Text>
              <TextInput
                style={styles.multilineInput}
                placeholder="e.g., NSFW content, Mecha, Political themes"
                placeholderTextColor={colors.text.disabled}
                value={wontDraw}
                onChangeText={setWontDraw}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Terms & Policies */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Terms & Policies</Text>
            </View>

            <View style={styles.settingCard}>
              <Text style={styles.inputLabel}>Terms of Service</Text>
              <Text style={styles.inputHint}>
                Custom terms and conditions for your commissions
              </Text>
              <TextInput
                style={styles.largeMultilineInput}
                placeholder="- Payment upfront required&#10;- No refunds after work begins&#10;- Commercial use requires additional fee&#10;- Final files delivered via email..."
                placeholderTextColor={colors.text.disabled}
                value={termsOfService}
                onChangeText={setTermsOfService}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={colors.text.primary} />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        <View style={styles.packagesContainer}>
          <FlatList
            data={packages}
            renderItem={renderPackage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              packages.length === 0 && styles.emptyStateContainer,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="pricetag-outline" size={64} color={colors.text.disabled} />
                <Text style={styles.emptyTitle}>No packages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first commission package to let clients know what you offer and your pricing
                </Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity
                style={styles.createPackageButton}
                onPress={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.text.primary} />
                <Text style={styles.createPackageButtonText}>Create New Package</Text>
              </TouchableOpacity>
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
        </View>
      )}

      {/* Create/Edit Package Modal */}
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
              <Text style={styles.inputLabel}>
                Package Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g. Full Body Character"
                placeholderTextColor={colors.text.disabled}
              />

              <Text style={styles.inputLabel}>
                Base Price ($) <Text style={styles.required}>*</Text>
              </Text>
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

              {formData.example_image_urls.length > 0 ? (
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
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="images-outline" size={32} color={colors.text.disabled} />
                  <Text style={styles.imagePlaceholderText}>Add preview images to showcase your work</Text>
                </View>
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

              <Text style={[styles.inputLabel, { marginTop: spacing.xxl }]}>Estimated Delivery (days)</Text>
              <TextInput
                style={styles.input}
                value={formData.estimated_delivery_days}
                onChangeText={(text) => setFormData({ ...formData, estimated_delivery_days: text })}
                placeholder="e.g. 7"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
                textAlignVertical="center"
              />

              <Text style={styles.inputLabel}>Revisions Included</Text>
              <TextInput
                style={styles.input}
                value={formData.revision_count}
                onChangeText={(text) => setFormData({ ...formData, revision_count: text })}
                placeholder="e.g. 2"
                placeholderTextColor={colors.text.disabled}
                keyboardType="number-pad"
                textAlignVertical="center"
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

              <TouchableOpacity style={styles.saveButton} onPress={handleSavePackage}>
                <Text style={styles.saveButtonText}>
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Constants.statusBarHeight + spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: IS_SMALL_SCREEN ? 18 : 22,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xxl + spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  settingCard: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border + '30',
  },
  marginTop: {
    marginTop: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
    justifyContent: 'center',
    minWidth: 0,
  },
  settingLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border + '30',
    marginVertical: spacing.md,
  },
  numberInput: {
    ...components.input,
    width: 70,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.primary,
  },
  inputHint: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  multilineInput: {
    ...components.input,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    maxHeight: 140,
    textAlignVertical: 'top',
    paddingTop: spacing.lg,
  },
  largeMultilineInput: {
    ...components.input,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 140,
    maxHeight: 200,
    textAlignVertical: 'top',
    paddingTop: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border + '60',
    justifyContent: 'center',
    padding: 2,
    flexShrink: 0,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  packagesContainer: {
    flex: 1,
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
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 0,
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
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
    fontSize: 22,
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
    borderTopWidth: 0,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  createPackageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  createPackageButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '90%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomWidth: 0,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  modalBody: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  input: {
    ...components.input,
    color: colors.text.primary,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 100,
    maxHeight: 140,
    textAlignVertical: 'top',
    paddingTop: spacing.lg,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 0,
  },
  addImageButtonDisabled: {
    opacity: 0.6,
  },
  addImageButtonText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  imageList: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  imageThumb: {
    width: 90,
    height: 90,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
    borderRadius: 8,
    borderWidth: 0,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    shadowOpacity: 0.2,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  addonList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 0,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  addonEmpty: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background + '40',
    padding: spacing.sm,
    borderRadius: 12,
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
  imagePlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontSize: 13,
  },
});
