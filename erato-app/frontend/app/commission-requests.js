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
  KeyboardAvoidingView,
  Platform,
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
  const [showBidsModal, setShowBidsModal] = useState(false);
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

  // Categorize art styles
  const categorizedStyles = React.useMemo(() => {
    if (!artStyles.length) return {};

    const categories = {
      'Character Art': [
        'Anime', 'Manga', 'Chibi', 'Kemono', 'Furry', 'Cartoon', 'Disney Style',
        'Pixar Style', 'Western Cartoon', 'Anime Realistic', 'Kawaii', 'Moe'
      ],
      'Traditional Mediums': [
        'Watercolor', 'Oil Painting', 'Acrylic', 'Gouache', 'Pastel', 'Charcoal',
        'Pencil', 'Ink', 'Pen & Ink', 'Marker', 'Colored Pencil'
      ],
      'Digital Art': [
        'Digital Painting', 'Digital Art', 'Vector', 'Pixel Art', 'Low Poly',
        'Isometric', 'Flat Design', 'Gradient Art', 'Glitch Art', 'Vaporwave', 'Synthwave'
      ],
      '3D Art': [
        '3D Modeling', '3D Rendering', '3D Character', 'Sculpture', 'Blender', 'ZBrush'
      ],
      'Illustration': [
        'Illustration', 'Concept Art', 'Character Design', 'Portrait', 'Landscape',
        'Still Life', 'Architectural', 'Technical Drawing', 'Medical Illustration', 'Botanical'
      ],
      'Genres & Themes': [
        'Fantasy', 'Sci-Fi', 'Horror', 'Cyberpunk', 'Steampunk', 'Medieval',
        'Victorian', 'Gothic', 'Dark Fantasy', 'Post-Apocalyptic', 'Space',
        'Nature', 'Animal', 'Pet Portrait', 'Realism', 'Semi-Realistic'
      ],
      'Modern & Abstract': [
        'Abstract', 'Minimalist', 'Surrealism', 'Impressionism', 'Expressionism',
        'Pop Art', 'Art Deco', 'Art Nouveau', 'Cubism', 'Modern Art', 'Contemporary'
      ],
      'Specialized': [
        'Logo Design', 'Typography', 'Calligraphy', 'Graffiti', 'Tattoo Design',
        'Comic Book', 'Webtoon', 'Manhwa', 'Manhua', 'NSFW', 'SFW'
      ],
      'Techniques': [
        'Cell Shading', 'Soft Shading', 'Hard Shading', 'Painterly', 'Sketch',
        'Rendered', 'Monochrome', 'Full Color'
      ],
      'Cultural & Regional': [
        'Japanese', 'Chinese', 'Korean', 'Western', 'European', 'American'
      ]
    };

    const result = {};
    Object.keys(categories).forEach(category => {
      result[category] = artStyles.filter(style =>
        categories[category].includes(style.name)
      );
    });

    return result;
  }, [artStyles]);

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
    // Check if user is an artist
    if (isArtist) {
      Toast.show({
        type: 'error',
        text1: 'Not Allowed',
        text2: 'Artists cannot create commission requests',
      });
      return;
    }

    // Validate title length
    if (!formData.title.trim() || formData.title.trim().length < 5) {
      setCreating(true); // Set loading state before showing error
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Title must be at least 5 characters long',
      });
      setCreating(false); // Reset loading state
      return;
    }

    // Validate description length
    if (!formData.description.trim() || formData.description.trim().length < 20) {
      setCreating(true); // Set loading state before showing error
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Description must be at least 20 characters long',
      });
      setCreating(false); // Reset loading state
      return;
    }

    setCreating(true);
    try {
      // Build request payload, only including fields that have values
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        preferred_styles: formData.preferred_styles,
        reference_images: formData.reference_images,
      };

      // Only add budget fields if they have valid values
      if (formData.budget_min && formData.budget_min.trim()) {
        payload.budget_min = parseFloat(formData.budget_min.trim());
      }
      if (formData.budget_max && formData.budget_max.trim()) {
        payload.budget_max = parseFloat(formData.budget_max.trim());
      }

      console.log('Sending payload:', payload);

      const response = await axios.post(
        `${API_URL}/commission-requests`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Success response:', response.data);

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
        preferred_styles: [],
        reference_images: [],
      });
      loadRequests();
    } catch (error) {
      console.error('Error creating request:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create request',
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
        <TouchableOpacity
          style={styles.requestCard}
          onPress={() => {
            setSelectedRequest(item);
            setShowBidsModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
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

          <Text style={styles.requestDescription} numberOfLines={3}>
            {item.description}
          </Text>

          <View style={styles.clientRequestFooter}>
            <View style={styles.bidsSummary}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={styles.bidsSummaryText}>
                {item.bid_count || 0} {item.bid_count === 1 ? 'bid' : 'bids'}
              </Text>
              {pendingBidsCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingBidsCount} pending</Text>
                </View>
              )}
            </View>
            {item.budget_min || item.budget_max ? (
              <View style={styles.budgetContainer}>
                <Ionicons name="cash-outline" size={14} color={colors.primary} />
                <Text style={styles.budgetText}>
                  {item.budget_min && item.budget_max
                    ? `$${item.budget_min}-$${item.budget_max}`
                    : item.budget_min
                    ? `$${item.budget_min}+`
                    : `$${item.budget_max}`}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    }

    // For artists: Pinterest-style quest board with reference images
    const hasReferenceImages = item.reference_images && item.reference_images.length > 0;

    return (
      <TouchableOpacity
        style={styles.pinterestQuestCard}
        onPress={() => {
          setSelectedRequest(item);
          if (!item.has_applied) {
            setShowBidModal(true);
          }
        }}
        activeOpacity={0.9}
      >
        {/* Reference Images Preview - Pinterest Style */}
        {hasReferenceImages && (
          <View style={styles.questImagePreview}>
            {item.reference_images.slice(0, 3).map((imageUrl, index) => (
              <ExpoImage
                key={index}
                source={{ uri: imageUrl }}
                style={[
                  styles.questImage,
                  item.reference_images.length === 1 && styles.questImageSingle,
                  item.reference_images.length === 2 && styles.questImageDouble,
                  item.reference_images.length >= 3 && styles.questImageTriple,
                ]}
                contentFit="cover"
              />
            ))}
            {item.reference_images.length > 3 && (
              <View style={styles.questImageMore}>
                <Text style={styles.questImageMoreText}>+{item.reference_images.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Client Info Header */}
        <View style={styles.questCardHeader}>
          <ExpoImage
            source={{ uri: item.client?.avatar_url || DEFAULT_AVATAR }}
            style={styles.questAvatar}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.questClientName}>{item.client?.username || 'Anonymous'}</Text>
            <View style={styles.questMeta}>
              <Text style={styles.questMetaText}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
              <View style={styles.questMetaDot} />
              <Text style={styles.questMetaText}>
                {item.bid_count || 0} {item.bid_count === 1 ? 'bid' : 'bids'}
              </Text>
            </View>
          </View>
          {item.has_applied && (
            <View style={styles.questAppliedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.questAppliedText}>Applied</Text>
            </View>
          )}
        </View>

        {/* Title & Description */}
        <View style={styles.questCardBody}>
          <Text style={styles.questTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.questDescription} numberOfLines={hasReferenceImages ? 2 : 3}>
            {item.description}
          </Text>
        </View>

        {/* Budget & Info Pills */}
        <View style={styles.questInfoRow}>
          {item.budget_min || item.budget_max ? (
            <View style={styles.questBudgetPill}>
              <Ionicons name="cash" size={14} color={colors.primary} />
              <Text style={styles.questBudgetText}>
                {item.budget_min && item.budget_max
                  ? `$${item.budget_min}-$${item.budget_max}`
                  : item.budget_min
                  ? `$${item.budget_min}+`
                  : `$${item.budget_max}`}
              </Text>
            </View>
          ) : null}
          {item.deadline && (
            <View style={styles.questDeadlinePill}>
              <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.questDeadlineText}>
                {new Date(item.deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
          )}
        </View>

        {/* Style Tags - Minimal */}
        {item.preferred_styles && item.preferred_styles.length > 0 && (
          <View style={styles.questStylesRow}>
            {artStyles
              .filter(s => item.preferred_styles.includes(s.id))
              .slice(0, 3)
              .map(style => (
                <View key={style.id} style={styles.questStyleTag}>
                  <Text style={styles.questStyleText}>{style.name}</Text>
                </View>
              ))}
            {item.preferred_styles.length > 3 && (
              <Text style={styles.questMoreStyles}>+{item.preferred_styles.length - 3}</Text>
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
        <View style={styles.pinterestModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.pinterestModalContent}>
              {/* Header */}
              <View style={styles.pinterestHeader}>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.pinterestTitle}>Post request</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView
                style={styles.pinterestBody}
                contentContainerStyle={styles.pinterestBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
              {/* Title Section */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="e.g., Character design for my game"
                placeholderTextColor={colors.text.disabled}
                maxLength={200}
              />
              </View>

              {/* Description Section */}
              <View style={styles.formSection}>
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
              </View>

              {/* Budget Section */}
              <View style={styles.formSection}>
              <Text style={styles.label}>Budget Range (optional)</Text>
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
              </View>

              {/* Styles Section */}
              <View style={styles.formSection}>
              <Text style={styles.label}>Preferred Styles (optional)</Text>
              <ScrollView
                style={styles.stylesContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.stylesContent}
              >
                {Object.keys(categorizedStyles).map((category) => {
                  const categoryStyles = categorizedStyles[category];
                  if (categoryStyles.length === 0) return null;

                  return (
                    <View key={category} style={styles.styleCategory}>
                      <Text style={styles.categoryTitle}>{category}</Text>
                      <View style={styles.categoryStylesList}>
                        {categoryStyles.map((style) => {
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
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.styleOptionText, isSelected && styles.styleOptionTextSelected]}>
                                {style.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              </View>
              </ScrollView>

              {/* Footer with Submit Button */}
              <View style={styles.pinterestFooter}>
                <TouchableOpacity
                  style={[styles.pinterestSubmitButton, creating && styles.pinterestSubmitButtonDisabled]}
                  onPress={handleCreateRequest}
                  disabled={creating}
                  activeOpacity={0.8}
                >
                  {creating ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <Text style={styles.pinterestSubmitButtonText}>Post Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bid Modal (Artists) */}
      <Modal
        visible={showBidModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBidModal(false)}
      >
        <View style={styles.pinterestModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.pinterestModalContent}>
              {/* Header */}
              <View style={styles.pinterestHeader}>
                <TouchableOpacity
                  onPress={() => setShowBidModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.pinterestTitle}>Submit bid</Text>
                  {selectedRequest && (
                    <Text style={styles.pinterestSubtitle} numberOfLines={1}>{selectedRequest.title}</Text>
                  )}
                </View>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView
                style={styles.pinterestBody}
                contentContainerStyle={styles.pinterestBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
              {/* Request Preview Card */}
              {selectedRequest && (
                <View style={styles.bidRequestPreview}>
                  <View style={styles.previewRow}>
                    <View style={styles.previewItem}>
                      <Ionicons name="cash-outline" size={20} color={colors.primary} />
                      <View>
                        <Text style={styles.previewLabel}>Budget Range</Text>
                        <Text style={styles.previewValue}>
                          {selectedRequest.budget_min && selectedRequest.budget_max
                            ? `$${selectedRequest.budget_min} - $${selectedRequest.budget_max}`
                            : selectedRequest.budget_min
                            ? `From $${selectedRequest.budget_min}`
                            : selectedRequest.budget_max
                            ? `Up to $${selectedRequest.budget_max}`
                            : 'Not specified'}
                        </Text>
                      </View>
                    </View>
                    {selectedRequest.deadline && (
                      <View style={styles.previewItem}>
                        <Ionicons name="time-outline" size={20} color={colors.primary} />
                        <View>
                          <Text style={styles.previewLabel}>Deadline</Text>
                          <Text style={styles.previewValue}>
                            {new Date(selectedRequest.deadline).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Text style={styles.previewDescription} numberOfLines={3}>
                    {selectedRequest.description}
                  </Text>
                </View>
              )}

              {/* Bid Form */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Your Bid Amount *</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="cash" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputWithPadding]}
                    value={bidData.bid_amount}
                    onChangeText={(text) => setBidData({ ...bidData, bid_amount: text })}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Estimated Delivery</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="calendar" size={20} color={colors.text.secondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputWithPadding]}
                    value={bidData.estimated_delivery_days}
                    onChangeText={(text) => setBidData({ ...bidData, estimated_delivery_days: text })}
                    placeholder="Days to complete"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.label}>Your Pitch (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bidData.message}
                  onChangeText={(text) => setBidData({ ...bidData, message: text })}
                  placeholder="Why you're the perfect artist for this project..."
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  numberOfLines={5}
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
              </ScrollView>

              {/* Footer with Submit Button */}
              <View style={styles.pinterestFooter}>
                <TouchableOpacity
                  style={[styles.pinterestSubmitButton, submittingBid && styles.pinterestSubmitButtonDisabled]}
                  onPress={handleSubmitBid}
                  disabled={submittingBid}
                  activeOpacity={0.8}
                >
                  {submittingBid ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <Text style={styles.pinterestSubmitButtonText}>Submit Bid</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Filters Modal (Artists) */}
      <Modal
        visible={showFiltersModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.pinterestModalOverlay}>
          <View style={styles.pinterestModalContent}>
            {/* Header */}
            <View style={styles.pinterestHeader}>
              <TouchableOpacity
                onPress={() => setShowFiltersModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.pinterestTitle}>Sort & Filter</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView
              style={styles.pinterestBody}
              contentContainerStyle={[styles.pinterestBodyContent, { paddingBottom: insets.bottom + spacing.xxl }]}
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

            </ScrollView>

            {/* Footer with Actions */}
            <View style={styles.pinterestFooter}>
              <View style={styles.pinterestFooterActions}>
                <TouchableOpacity
                  style={styles.pinterestSecondaryButton}
                  onPress={() => setFilters({ budget_min: '', budget_max: '', sort_by: 'recent', styles: [] })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pinterestSecondaryButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pinterestPrimaryButton}
                  onPress={() => {
                    setShowFiltersModal(false);
                    loadRequests();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pinterestPrimaryButtonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Bids Modal (Clients) */}
      <Modal
        visible={showBidsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBidsModal(false)}
      >
        <View style={styles.pinterestModalOverlay}>
          <View style={styles.pinterestModalContent}>
            {/* Header */}
            <View style={styles.pinterestHeader}>
              <TouchableOpacity
                onPress={() => setShowBidsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.pinterestTitle}>Bids received</Text>
                {selectedRequest && (
                  <Text style={styles.pinterestSubtitle} numberOfLines={1}>{selectedRequest.title}</Text>
                )}
              </View>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView
              style={styles.pinterestBody}
              contentContainerStyle={[styles.pinterestBodyContent, { paddingBottom: spacing.xxl }]}
              showsVerticalScrollIndicator={false}
            >
              {selectedRequest?.bids && selectedRequest.bids.length > 0 ? (
                selectedRequest.bids.map((bid, index) => (
                  <View key={bid.id} style={styles.bidCard}>
                    <View style={styles.bidHeader}>
                      <View style={styles.artistInfo}>
                        <ExpoImage
                          source={{ uri: bid.artist?.avatar_url || DEFAULT_AVATAR }}
                          style={styles.bidAvatar}
                          contentFit="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.artistName}>{bid.artist?.username || 'Artist'}</Text>
                          <Text style={styles.bidTimestamp}>
                            {new Date(bid.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.bidStatusBadge, { backgroundColor: bid.status === 'pending' ? colors.status.pending + '15' : bid.status === 'accepted' ? colors.status.success + '15' : colors.text.secondary + '15' }]}>
                        <Text style={[styles.bidStatusText, { color: bid.status === 'pending' ? colors.status.pending : bid.status === 'accepted' ? colors.status.success : colors.text.secondary }]}>
                          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.bidDetails}>
                      <View style={styles.bidDetailRow}>
                        <View style={styles.bidDetailItem}>
                          <Ionicons name="cash-outline" size={16} color={colors.primary} />
                          <Text style={styles.bidDetailLabel}>Offer</Text>
                          <Text style={styles.bidDetailValue}>${bid.bid_amount}</Text>
                        </View>
                        {bid.estimated_delivery_days && (
                          <View style={styles.bidDetailItem}>
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <Text style={styles.bidDetailLabel}>Delivery</Text>
                            <Text style={styles.bidDetailValue}>{bid.estimated_delivery_days} days</Text>
                          </View>
                        )}
                      </View>

                      {bid.message && (
                        <View style={styles.bidMessage}>
                          <Text style={styles.bidMessageLabel}>Message</Text>
                          <Text style={styles.bidMessageText}>{bid.message}</Text>
                        </View>
                      )}

                      {bid.status === 'pending' && selectedRequest.status === 'open' && (
                        <TouchableOpacity
                          style={styles.acceptBidButton}
                          onPress={async () => {
                            try {
                              await axios.patch(
                                `${API_URL}/commission-requests/${selectedRequest.id}/bids/${bid.id}/accept`,
                                {},
                                { headers: { Authorization: `Bearer ${token}` } }
                              );
                              Toast.show({
                                type: 'success',
                                text1: 'Success',
                                text2: 'Bid accepted and commission created',
                              });
                              setShowBidsModal(false);
                              loadRequests();
                            } catch (error) {
                              Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: error.response?.data?.error || 'Failed to accept bid',
                              });
                            }
                          }}
                        >
                          <Text style={styles.acceptBidButtonText}>Accept Bid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noBidsState}>
                  <Ionicons name="people-outline" size={64} color={colors.text.disabled} />
                  <Text style={styles.noBidsTitle}>No bids yet</Text>
                  <Text style={styles.noBidsText}>Artists will see your request and can submit bids</Text>
                </View>
              )}
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
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.border + '30',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    maxHeight: '95%',
    minHeight: '80%',
    width: '100%',
    ...shadows.large,
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
    minHeight: 0, // Allow shrinking
  },
  modalBodyContent: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  modalFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
    backgroundColor: colors.background,
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
  formSection: {
    marginBottom: spacing.md,
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
  stylesContainer: {
    maxHeight: 280,
  },
  stylesContent: {
    gap: spacing.sm,
  },
  styleCategory: {
    marginBottom: spacing.sm,
  },
  categoryTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  categoryStylesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stylesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  styleOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface + '80',
    borderWidth: 1,
    borderColor: colors.border + '60',
    marginBottom: spacing.xs / 2,
  },
  styleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  styleOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '500',
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
    backgroundColor: colors.primary,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    ...shadows.small,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    backgroundColor: colors.text.disabled,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pendingBadge: {
    backgroundColor: colors.status.pending + '20',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  pendingBadgeText: {
    ...typography.small,
    color: colors.status.pending,
    fontSize: 11,
    fontWeight: '600',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs / 2,
  },
  bidCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  bidAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  bidTimestamp: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
  },
  bidStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.sm,
  },
  bidStatusText: {
    ...typography.small,
    fontWeight: '600',
    fontSize: 11,
  },
  bidDetails: {
    gap: spacing.md,
  },
  bidDetailRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bidDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  bidDetailLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
  },
  bidDetailValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    marginLeft: 'auto',
  },
  bidMessage: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  bidMessageLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontSize: 13,
  },
  bidMessageText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  acceptBidButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.small,
  },
  acceptBidButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontWeight: '700',
  },
  noBidsState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  noBidsTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  noBidsText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  // Artist Card Styles
  artistCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  artistCardBody: {
    marginBottom: spacing.md,
  },
  artistCardInfo: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  infoChipText: {
    ...typography.small,
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  // Bid Modal Preview Styles
  bidRequestPreview: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  previewLabel: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
    marginBottom: 2,
  },
  previewValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 13,
  },
  previewDescription: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
    fontSize: 13,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    transform: [{ translateY: -10 }],
    zIndex: 1,
  },
  inputWithPadding: {
    paddingLeft: spacing.xl + spacing.sm,
  },

  // Pinterest-Style Modal Styles
  pinterestModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pinterestModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: '92%',
    paddingTop: spacing.md,
  },
  pinterestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  pinterestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  pinterestSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: 13,
  },
  pinterestBody: {
    flex: 1,
  },
  pinterestBodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pinterestFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '30',
    backgroundColor: colors.background,
  },
  pinterestSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  pinterestSubmitButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  pinterestSubmitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pinterestFooterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinterestSecondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinterestSecondaryButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 15,
  },
  pinterestPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  pinterestPrimaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  // Pinterest-Style Quest Board Cards
  pinterestQuestCard: {
    backgroundColor: colors.surface,
    borderRadius: 20, // Subtly rounded borders
    overflow: 'hidden',
    ...shadows.medium,
    borderWidth: 1,
    borderColor: colors.border + '20',
    marginBottom: spacing.md,
  },
  questImagePreview: {
    flexDirection: 'row',
    height: 200,
    backgroundColor: colors.background,
    position: 'relative',
  },
  questImage: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  questImageSingle: {
    width: '100%',
  },
  questImageDouble: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: colors.background,
  },
  questImageTriple: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: colors.background,
  },
  questImageMore: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  questImageMoreText: {
    ...typography.small,
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  questCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  questAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
  },
  questClientName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  questMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  questMetaText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 11,
  },
  questMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.disabled,
  },
  questAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.status.success + '15',
  },
  questAppliedText: {
    ...typography.small,
    color: colors.status.success,
    fontSize: 11,
    fontWeight: '700',
  },
  questCardBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  questTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  questDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  questInfoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  questBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '15',
  },
  questBudgetText: {
    ...typography.small,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  questDeadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questDeadlineText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  questStylesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  questStyleTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  questStyleText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  questMoreStyles: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 10,
    fontWeight: '600',
    alignSelf: 'center',
    paddingHorizontal: spacing.xs,
  },
});

