import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../constants/theme';
import { uploadImage } from '../utils/imageUpload';
import { showAlert } from '../components/StyledAlert';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function CommissionRequestsScreen() {
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const isArtist = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [artStyles, setArtStyles] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    budget_min: '',
    budget_max: '',
    sort_by: 'recent',
    styles: []
  });
  
  // Create request form
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget_min: '',
    budget_max: '',
    deadline: '',
    preferred_styles: [],
    reference_images: [],
  });
  const [creating, setCreating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // Bid form
  const [bidData, setBidData] = useState({
    bid_amount: '',
    estimated_delivery_days: '',
    message: '',
    portfolio_samples: [],
  });
  const [submittingBid, setSubmittingBid] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadRequests();
        loadArtStyles();
      }
    }, [token, filters])
  );

  const loadRequests = async () => {
    try {
      // Build query string with filters
      const params = new URLSearchParams({
        status: 'open',
        limit: '50',
        sort_by: filters.sort_by || 'recent'
      });

      if (filters.budget_min) params.append('budget_min', filters.budget_min);
      if (filters.budget_max) params.append('budget_max', filters.budget_max);
      if (filters.styles && filters.styles.length > 0) {
        params.append('styles', filters.styles.join(','));
      }

      const response = await axios.get(
        `${API_URL}/commission-requests?${params.toString()}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load commission requests',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadArtStyles = async () => {
    try {
      const response = await axios.get(`${API_URL}/artists/styles/list`);
      setArtStyles(response.data.styles || []);
    } catch (error) {
      console.error('Error loading art styles:', error);
    }
  };

  const handleCreateRequest = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in all required fields',
      });
      return;
    }

    setCreating(true);
    try {
      await axios.post(
        `${API_URL}/commission-requests`,
        {
          title: formData.title,
          description: formData.description,
          budget_min: formData.budget_min ? parseFloat(formData.budget_min) : undefined,
          budget_max: formData.budget_max ? parseFloat(formData.budget_max) : undefined,
          deadline: formData.deadline || undefined,
          preferred_styles: formData.preferred_styles,
          reference_images: formData.reference_images,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Request posted!',
        text2: 'Artists will be notified',
      });

      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        budget_min: '',
        budget_max: '',
        deadline: '',
        preferred_styles: [],
        reference_images: [],
      });
      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to create request',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleAddReferenceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'info',
        text1: 'Permission needed',
        text2: 'Please allow access to your photos',
      });
      return;
    }

    setUploadingImages(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUrl = await uploadImage(result.assets[0].uri, 'commission-requests', '', token);
        if (imageUrl) {
          setFormData({
            ...formData,
            reference_images: [...formData.reference_images, imageUrl]
          });
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload image',
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmitBid = async () => {
    if (!bidData.bid_amount || !selectedRequest) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a bid amount',
      });
      return;
    }

    setSubmittingBid(true);
    try {
      await axios.post(
        `${API_URL}/commission-requests/${selectedRequest.id}/bids`,
        {
          bid_amount: parseFloat(bidData.bid_amount),
          estimated_delivery_days: bidData.estimated_delivery_days ? parseInt(bidData.estimated_delivery_days) : undefined,
          message: bidData.message || undefined,
          portfolio_samples: bidData.portfolio_samples,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Bid submitted!',
        text2: 'The client will be notified',
      });

      setShowBidModal(false);
      setBidData({
        bid_amount: '',
        estimated_delivery_days: '',
        message: '',
        portfolio_samples: [],
      });
      loadRequests();
    } catch (error) {
      console.error('Error submitting bid:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to submit bid',
      });
    } finally {
      setSubmittingBid(false);
    }
  };

  const toggleStyle = (styleId) => {
    const current = formData.preferred_styles || [];
    if (current.includes(styleId)) {
      setFormData({
        ...formData,
        preferred_styles: current.filter(id => id !== styleId)
      });
    } else {
      setFormData({
        ...formData,
        preferred_styles: [...current, styleId]
      });
    }
  };

  const renderRequest = ({ item }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => {
        setSelectedRequest(item);
        if (isArtist && !item.has_applied) {
          setShowBidModal(true);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.requestHeader}>
        <View style={styles.requestClientInfo}>
          <ExpoImage
            source={{ uri: item.client?.avatar_url || DEFAULT_AVATAR }}
            style={styles.clientAvatar}
            contentFit="cover"
          />
          <View>
            <Text style={styles.clientName}>{item.client?.username || 'Anonymous'}</Text>
            <Text style={styles.requestDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {item.has_applied && (
            <View style={[styles.bidBadge, { backgroundColor: colors.status.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={[styles.bidCount, { color: colors.status.success }]}>Applied</Text>
            </View>
          )}
          <View style={styles.bidBadge}>
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={styles.bidCount}>{item.bid_count || 0} bids</Text>
          </View>
        </View>
      </View>

      <Text style={styles.requestTitle}>{item.title}</Text>
      <Text style={styles.requestDescription} numberOfLines={3}>
        {item.description}
      </Text>

      <View style={styles.requestMeta}>
        {item.budget_min && item.budget_max && (
          <View style={styles.metaItem}>
            <Ionicons name="cash-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.metaText}>
              ${item.budget_min} - ${item.budget_max}
            </Text>
          </View>
        )}
        {item.deadline && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.metaText}>
              {new Date(item.deadline).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {item.reference_images?.length > 0 && (
        <View style={styles.referenceImages}>
          {item.reference_images.slice(0, 3).map((url, idx) => (
            <ExpoImage
              key={idx}
              source={{ uri: url }}
              style={styles.referenceImage}
              contentFit="cover"
            />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission Requests</Text>
        <View style={styles.headerActions}>
          {isArtist && (
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFiltersModal(true)}
            >
              <Ionicons name="filter" size={22} color={colors.primary} />
              {(filters.budget_min || filters.budget_max || filters.styles.length > 0) && (
                <View style={styles.filterBadge} />
              )}
            </TouchableOpacity>
          )}
          {!isArtist && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active Filters Display */}
      {isArtist && (filters.budget_min || filters.budget_max || filters.styles.length > 0) && (
        <View style={styles.activeFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            {filters.budget_min && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>Min: ${filters.budget_min}</Text>
                <TouchableOpacity onPress={() => setFilters({ ...filters, budget_min: '' })}>
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {filters.budget_max && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>Max: ${filters.budget_max}</Text>
                <TouchableOpacity onPress={() => setFilters({ ...filters, budget_max: '' })}>
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            {filters.styles.length > 0 && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>{filters.styles.length} styles</Text>
                <TouchableOpacity onPress={() => setFilters({ ...filters, styles: [] })}>
                  <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => setFilters({ budget_min: '', budget_max: '', sort_by: 'recent', styles: [] })}
            >
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Requests List */}
      <FlatList
        data={requests}
        renderItem={renderRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.text.disabled} />
            <Text style={styles.emptyText}>No requests yet</Text>
            {!isArtist && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.emptyButtonText}>Post First Request</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Create Request Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Commission Request</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="e.g., Character design for game"
                placeholderTextColor={colors.text.disabled}
              />

              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Describe what you're looking for..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={6}
              />

              <View style={styles.priceRow}>
                <View style={styles.priceInputGroup}>
                  <Text style={styles.inputLabel}>Min Budget ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.budget_min}
                    onChangeText={(text) => setFormData({ ...formData, budget_min: text })}
                    placeholder="0"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceInputGroup}>
                  <Text style={styles.inputLabel}>Max Budget ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.budget_max}
                    onChangeText={(text) => setFormData({ ...formData, budget_max: text })}
                    placeholder="1000"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Preferred Styles</Text>
              <View style={styles.stylesContainer}>
                {artStyles.map((style) => {
                  const isSelected = formData.preferred_styles?.includes(style.id);
                  return (
                    <TouchableOpacity
                      key={style.id}
                      style={[
                        styles.styleChip,
                        isSelected && styles.styleChipSelected
                      ]}
                      onPress={() => toggleStyle(style.id)}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          isSelected && styles.styleChipTextSelected
                        ]}
                      >
                        {style.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Reference Images</Text>
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={handleAddReferenceImage}
                disabled={uploadingImages}
              >
                {uploadingImages ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={20} color={colors.primary} />
                    <Text style={styles.addImageText}>Add Reference Image</Text>
                  </>
                )}
              </TouchableOpacity>

              {formData.reference_images.length > 0 && (
                <View style={styles.referenceImagesGrid}>
                  {formData.reference_images.map((url, idx) => (
                    <View key={idx} style={styles.referenceImageContainer}>
                      <ExpoImage source={{ uri: url }} style={styles.referenceImagePreview} contentFit="cover" />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => {
                          setFormData({
                            ...formData,
                            reference_images: formData.reference_images.filter((_, i) => i !== idx)
                          });
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, creating && styles.submitButtonDisabled]}
                onPress={handleCreateRequest}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>Post Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bid Modal */}
      <Modal
        visible={showBidModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBidModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Bid</Text>
              <TouchableOpacity onPress={() => setShowBidModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedRequest && (
                <>
                  <Text style={styles.requestPreviewTitle}>{selectedRequest.title}</Text>
                  <Text style={styles.requestPreviewDescription}>{selectedRequest.description}</Text>
                </>
              )}

              <Text style={styles.inputLabel}>Bid Amount ($) *</Text>
              <TextInput
                style={styles.input}
                value={bidData.bid_amount}
                onChangeText={(text) => setBidData({ ...bidData, bid_amount: text })}
                placeholder="0.00"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Estimated Delivery (days)</Text>
              <TextInput
                style={styles.input}
                value={bidData.estimated_delivery_days}
                onChangeText={(text) => setBidData({ ...bidData, estimated_delivery_days: text })}
                placeholder="e.g., 14"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Message (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bidData.message}
                onChangeText={(text) => setBidData({ ...bidData, message: text })}
                placeholder="Add a message to the client..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.submitButton, submittingBid && styles.submitButtonDisabled]}
                onPress={handleSubmitBid}
                disabled={submittingBid}
              >
                {submittingBid ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Bid</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Filters Modal (Artists Only) */}
      <Modal
        visible={showFiltersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFiltersModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Requests</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.inputLabel}>Sort By</Text>
              <View style={styles.sortOptions}>
                {[
                  { value: 'recent', label: 'Most Recent' },
                  { value: 'budget_high', label: 'Highest Budget' },
                  { value: 'budget_low', label: 'Lowest Budget' },
                  { value: 'bids_low', label: 'Fewest Bids' },
                  { value: 'deadline_soon', label: 'Deadline Soon' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sortOption,
                      filters.sort_by === option.value && styles.sortOptionSelected
                    ]}
                    onPress={() => setFilters({ ...filters, sort_by: option.value })}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        filters.sort_by === option.value && styles.sortOptionTextSelected
                      ]}
                    >
                      {option.label}
                    </Text>
                    {filters.sort_by === option.value && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Budget Range</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceInputGroup}>
                  <Text style={styles.inputSubLabel}>Min Budget ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={filters.budget_min}
                    onChangeText={(text) => setFilters({ ...filters, budget_min: text })}
                    placeholder="0"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.priceInputGroup}>
                  <Text style={styles.inputSubLabel}>Max Budget ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={filters.budget_max}
                    onChangeText={(text) => setFilters({ ...filters, budget_max: text })}
                    placeholder="1000"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Preferred Styles</Text>
              <View style={styles.stylesContainer}>
                {artStyles.map((style) => {
                  const isSelected = filters.styles?.includes(style.id);
                  return (
                    <TouchableOpacity
                      key={style.id}
                      style={[
                        styles.styleChip,
                        isSelected && styles.styleChipSelected
                      ]}
                      onPress={() => {
                        const current = filters.styles || [];
                        if (isSelected) {
                          setFilters({
                            ...filters,
                            styles: current.filter(id => id !== style.id)
                          });
                        } else {
                          setFilters({
                            ...filters,
                            styles: [...current, style.id]
                          });
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          isSelected && styles.styleChipTextSelected
                        ]}
                      >
                        {style.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterModalButtons}>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setFilters({ budget_min: '', budget_max: '', sort_by: 'recent', styles: [] })}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => {
                    setShowFiltersModal(false);
                    loadRequests();
                  }}
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  createButton: {
    padding: spacing.xs,
  },
  filterButton: {
    padding: spacing.xs,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeFilters: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChips: {
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  filterChipText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  clearFiltersButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearFiltersText: {
    ...typography.small,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  sortOptions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  sortOptionText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  sortOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  inputSubLabel: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  filterModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  clearButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  listContent: {
    padding: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  requestClientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
  },
  clientName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  requestDate: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
  },
  bidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.sm,
  },
  bidCount: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  requestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  requestDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  requestMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  referenceImages: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  referenceImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: '75%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
  },
  modalBody: {
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priceInputGroup: {
    flex: 1,
  },
  stylesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  styleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  styleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleChipText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  styleChipTextSelected: {
    color: colors.text.primary,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  addImageText: {
    ...typography.body,
    color: colors.primary,
  },
  referenceImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  referenceImageContainer: {
    position: 'relative',
  },
  referenceImagePreview: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  requestPreviewTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requestPreviewDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
});




