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
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [artStyles, setArtStyles] = useState([]);
  
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
        if (!isArtist) {
          loadArtStyles();
        }
      }
    }, [token, isArtist])
  );

  const loadRequests = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/commission-requests?status=open&limit=50`,
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
        if (isArtist) {
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
        <View style={styles.bidBadge}>
          <Ionicons name="people-outline" size={14} color={colors.primary} />
          <Text style={styles.bidCount}>{item.bid_count || 0} bids</Text>
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
        {!isArtist && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

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
  createButton: {
    padding: spacing.xs,
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



