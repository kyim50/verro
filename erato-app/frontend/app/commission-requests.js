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
      let response;

      if (isArtist) {
        // Artists see the quest board (all open requests)
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

        response = await axios.get(
          `${API_URL}/commission-requests?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRequests(response.data.requests || []);
      } else {
        // Clients see their own posted requests
        response = await axios.get(
          `${API_URL}/commission-requests/my-requests`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRequests(response.data.requests || []);
      }
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

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const uploadedUrls = [];
      for (const asset of result.assets) {
        try {
          const url = await uploadImage(asset.uri, token);
          uploadedUrls.push(url);
        } catch (error) {
          console.error('Error uploading image:', error);
        }
      }
      setFormData({ ...formData, reference_images: [...formData.reference_images, ...uploadedUrls] });
    }
  };

  const handleCreateRequest = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill in title and description',
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
        text1: 'Success',
        text2: 'Commission request posted',
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

  const handleSubmitBid = async () => {
    if (!bidData.bid_amount) {
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
        text1: 'Success',
        text2: 'Bid submitted successfully',
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

  const renderRequest = ({ item }) => {
    // For clients: show their posted requests with bid info
    if (!isArtist) {
      const pendingBidsCount = item.pending_bids_count || 0;
      const statusColor =
        item.status === 'open' ? colors.status.pending :
        item.status === 'awarded' ? colors.status.success :
        colors.text.secondary;

      return (
        <View style={styles.requestCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.requestTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.requestDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.clientRequestFooter}>
            <View style={styles.bidsSummary}>
              <Ionicons name="people" size={16} color={colors.primary} />
              <Text style={styles.bidsSummaryText}>
                {item.bid_count || 0} {item.bid_count === 1 ? 'bid' : 'bids'}
                {pendingBidsCount > 0 && ` (${pendingBidsCount} pending)`}
              </Text>
            </View>
            {item.budget_min || item.budget_max ? (
              <View style={styles.budgetContainer}>
                <Ionicons name="cash-outline" size={14} color={colors.text.secondary} />
                <Text style={styles.budgetText}>
                  {item.budget_min && item.budget_max
                    ? `$${item.budget_min} - $${item.budget_max}`
                    : item.budget_min
                    ? `From $${item.budget_min}`
                    : `Up to $${item.budget_max}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    }

    // For artists: show quest board with apply functionality
    return (
      <TouchableOpacity
        style={styles.requestCard}
        onPress={() => {
          setSelectedRequest(item);
          if (!item.has_applied) {
            setShowBidModal(true);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.clientInfo}>
            <ExpoImage
              source={{ uri: item.client?.avatar_url || DEFAULT_AVATAR }}
              style={styles.clientAvatar}
              contentFit="cover"
            />
            <View>
              <Text style={styles.clientName}>{item.client?.username || 'Anonymous'}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            {item.has_applied && (
              <View style={styles.appliedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
                <Text style={styles.appliedText}>Applied</Text>
              </View>
            )}
            <View style={styles.bidsBadge}>
              <Ionicons name="people" size={12} color={colors.text.secondary} />
              <Text style={styles.bidsText}>{item.bid_count || 0}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.requestTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.requestDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.cardFooter}>
          {item.budget_min || item.budget_max ? (
            <View style={styles.budgetContainer}>
              <Ionicons name="cash-outline" size={14} color={colors.primary} />
              <Text style={styles.budgetText}>
                {item.budget_min && item.budget_max
                  ? `$${item.budget_min} - $${item.budget_max}`
                  : item.budget_min
                  ? `From $${item.budget_min}`
                  : `Up to $${item.budget_max}`}
              </Text>
            </View>
          ) : null}
          {item.deadline && (
            <View style={styles.deadlineContainer}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.deadlineText}>
                {new Date(item.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
          )}
        </View>

        {item.preferred_styles && item.preferred_styles.length > 0 && (
          <View style={styles.stylesRow}>
            {artStyles
              .filter(s => item.preferred_styles.includes(s.id))
              .slice(0, 3)
              .map(style => (
                <View key={style.id} style={styles.styleTag}>
                  <Text style={styles.styleTagText}>{style.name}</Text>
                </View>
              ))}
            {item.preferred_styles.length > 3 && (
              <Text style={styles.moreStyles}>+{item.preferred_styles.length - 3}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isArtist ? 'Quest Board' : 'My Requests'}</Text>
          <View style={styles.headerRight}>
            {isArtist && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowFiltersModal(true)}
              >
                <Ionicons name="options-outline" size={22} color={colors.text.primary} />
                {(filters.budget_min || filters.budget_max || filters.styles.length > 0) && (
                  <View style={styles.filterIndicator} />
                )}
              </TouchableOpacity>
            )}
            {!isArtist && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add" size={20} color={colors.text.primary} />
                <Text style={styles.primaryButtonText}>Post</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Active Filters */}
      {isArtist && (filters.budget_min || filters.budget_max || filters.styles.length > 0) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.budget_min && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>Min: ${filters.budget_min}</Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, budget_min: '' })}>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filters.budget_max && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>Max: ${filters.budget_max}</Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, budget_max: '' })}>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {filters.styles.length > 0 && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{filters.styles.length} styles</Text>
              <TouchableOpacity onPress={() => setFilters({ ...filters, styles: [] })}>
                <Ionicons name="close-circle" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.clearFilters}
            onPress={() => setFilters({ budget_min: '', budget_max: '', sort_by: 'recent', styles: [] })}
          >
            <Text style={styles.clearFiltersText}>Clear All</Text>
          </TouchableOpacity>
        </ScrollView>
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
            <Text style={styles.emptyTitle}>No Requests Found</Text>
            <Text style={styles.emptyText}>
              {isArtist
                ? 'Check back later for new commission opportunities'
                : 'Post your first commission request to find artists'}
            </Text>
          </View>
        }
      />

      {/* Create Request Modal (Clients) */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCreateModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Commission Request</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + spacing.xl }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="e.g., Character design for my game"
                placeholderTextColor={colors.text.disabled}
                maxLength={200}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Describe what you're looking for..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Budget Range</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={formData.budget_min}
                    onChangeText={(text) => setFormData({ ...formData, budget_min: text })}
                    placeholder="Min ($)"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.separator}>—</Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={formData.budget_max}
                    onChangeText={(text) => setFormData({ ...formData, budget_max: text })}
                    placeholder="Max ($)"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.label}>Preferred Styles (optional)</Text>
              <View style={styles.stylesList}>
                {artStyles.map((style) => {
                  const isSelected = formData.preferred_styles.includes(style.id);
                  return (
                    <TouchableOpacity
                      key={style.id}
                      style={[styles.styleOption, isSelected && styles.styleOptionSelected]}
                      onPress={() => {
                        if (isSelected) {
                          setFormData({
                            ...formData,
                            preferred_styles: formData.preferred_styles.filter(id => id !== style.id)
                          });
                        } else {
                          setFormData({
                            ...formData,
                            preferred_styles: [...formData.preferred_styles, style.id]
                          });
                        }
                      }}
                    >
                      <Text style={[styles.styleOptionText, isSelected && styles.styleOptionTextSelected]}>
                        {style.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateRequest}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>Post Request</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bid Modal (Artists) */}
      <Modal
        visible={showBidModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBidModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBidModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Your Bid</Text>
              <TouchableOpacity onPress={() => setShowBidModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + spacing.xl }]}
              showsVerticalScrollIndicator={false}
            >
              {selectedRequest && (
                <View style={styles.requestPreview}>
                  <Text style={styles.requestPreviewTitle}>{selectedRequest.title}</Text>
                  <Text style={styles.requestPreviewBudget}>
                    Budget: ${selectedRequest.budget_min} - ${selectedRequest.budget_max}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>Your Bid Amount *</Text>
              <TextInput
                style={styles.input}
                value={bidData.bid_amount}
                onChangeText={(text) => setBidData({ ...bidData, bid_amount: text })}
                placeholder="Enter amount ($)"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Estimated Delivery (Days)</Text>
              <TextInput
                style={styles.input}
                value={bidData.estimated_delivery_days}
                onChangeText={(text) => setBidData({ ...bidData, estimated_delivery_days: text })}
                placeholder="e.g., 14"
                placeholderTextColor={colors.text.disabled}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Message to Client (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bidData.message}
                onChangeText={(text) => setBidData({ ...bidData, message: text })}
                placeholder="Tell them why you're perfect for this project..."
                placeholderTextColor={colors.text.disabled}
                multiline
                numberOfLines={4}
                maxLength={1000}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitBid}
                disabled={submittingBid}
              >
                {submittingBid ? (
                  <ActivityIndicator color={colors.text.primary} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Bid</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Filters Modal (Artists) */}
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
              <Text style={styles.modalTitle}>Filter & Sort</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={[styles.modalBodyContent, { paddingBottom: insets.bottom + spacing.md }]}
              showsVerticalScrollIndicator={false}
            >
              {/* SORT SECTION */}
              <View style={styles.filterSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="swap-vertical" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Sort By</Text>
                </View>
                <View style={styles.sortOptions}>
                  {[
                    { value: 'recent', label: 'Most Recent', icon: 'time-outline' },
                    { value: 'budget_high', label: 'Highest Budget', icon: 'trending-up' },
                    { value: 'budget_low', label: 'Lowest Budget', icon: 'trending-down' },
                    { value: 'bids_low', label: 'Fewest Bids', icon: 'people-outline' },
                    { value: 'deadline_soon', label: 'Deadline Soon', icon: 'alarm-outline' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.sortOption,
                        filters.sort_by === option.value && styles.sortOptionActive
                      ]}
                      onPress={() => setFilters({ ...filters, sort_by: option.value })}
                    >
                      <View style={styles.sortOptionLeft}>
                        <Ionicons
                          name={option.icon}
                          size={20}
                          color={filters.sort_by === option.value ? colors.primary : colors.text.secondary}
                        />
                        <Text
                          style={[
                            styles.sortOptionText,
                            filters.sort_by === option.value && styles.sortOptionTextActive
                          ]}
                        >
                          {option.label}
                        </Text>
                      </View>
                      {filters.sort_by === option.value && (
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* BUDGET SECTION */}
              <View style={styles.filterSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="cash-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Budget Range</Text>
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={filters.budget_min}
                      onChangeText={(text) => setFilters({ ...filters, budget_min: text })}
                      placeholder="Min ($)"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.separator}>—</Text>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={filters.budget_max}
                      onChangeText={(text) => setFilters({ ...filters, budget_max: text })}
                      placeholder="Max ($)"
                      placeholderTextColor={colors.text.disabled}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* STYLES SECTION */}
              <View style={styles.filterSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="brush-outline" size={20} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Art Styles</Text>
                </View>
                <View style={styles.stylesList}>
                  {artStyles.map((style) => {
                    const isSelected = filters.styles?.includes(style.id);
                    return (
                      <TouchableOpacity
                        key={style.id}
                        style={[styles.styleOption, isSelected && styles.styleOptionSelected]}
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
                        <Text style={[styles.styleOptionText, isSelected && styles.styleOptionTextSelected]}>
                          {style.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setFilters({ budget_min: '', budget_max: '', sort_by: 'recent', styles: [] })}
                >
                  <Text style={styles.secondaryButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => {
                    setShowFiltersModal(false);
                    loadRequests();
                  }}
                >
                  <Text style={styles.submitButtonText}>Apply</Text>
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
  },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
    position: 'relative',
  },
  filterIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  filtersScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.full,
  },
  activeFilterText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  clearFilters: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
  },
  clearFiltersText: {
    ...typography.small,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  clientName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  timestamp: {
    ...typography.small,
    color: colors.text.secondary,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.status.success + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  appliedText: {
    ...typography.small,
    color: colors.status.success,
    fontWeight: '600',
    fontSize: 11,
  },
  bidsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bidsText: {
    ...typography.small,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 11,
  },
  requestTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requestDescription: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  budgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadlineText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  stylesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  styleTag: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  styleTagText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
  },
  moreStyles: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.small,
    fontWeight: '600',
    fontSize: 11,
  },
  clientRequestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bidsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bidsSummaryText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    overflow: 'hidden',
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
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
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
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  separator: {
    ...typography.body,
    color: colors.text.disabled,
  },
  filterSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  sortOptions: {
    gap: spacing.xs,
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
  sortOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sortOptionText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  stylesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  styleOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  styleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleOptionText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  styleOptionTextSelected: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  requestPreview: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestPreviewTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requestPreviewBudget: {
    ...typography.small,
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});
