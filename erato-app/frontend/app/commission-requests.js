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
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
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
          // Pass correct parameters: uri, bucket, folder, token
          const url = await uploadImage(asset.uri, 'commission-requests', '', token);
          uploadedUrls.push(url);
        } catch (error) {
          console.error('Error uploading image:', error);
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: 'Failed to upload image. Please try again.',
          });
        }
      }
      if (uploadedUrls.length > 0) {
        setFormData({ ...formData, reference_images: [...formData.reference_images, ...uploadedUrls] });
      }
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

    // REQUIRED: Validate reference images
    if (!formData.reference_images || formData.reference_images.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Reference Image Required',
        text2: 'Please add at least one reference image to help artists understand your vision',
      });
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
    // For clients: Pinterest content-first cards matching Quest Board
    if (!isArtist) {
      const pendingBidsCount = item.pending_bids_count || 0;
      const statusColor =
        item.status === 'open' ? colors.status.pending :
        item.status === 'awarded' ? colors.status.success :
        colors.text.secondary;

      const hasReferenceImages = item.reference_images && item.reference_images.length > 0;

      return (
        <TouchableOpacity
          style={styles.questCard}
          onPress={() => {
            setSelectedRequest(item);
            setShowBidsModal(true);
          }}
          activeOpacity={0.9}
        >
          {/* Pinterest Content-First: Image at Top (same as Quest Board) */}
          {hasReferenceImages && (
            <View style={styles.pinterestImageContainer}>
              {item.reference_images.length === 1 ? (
                // Single large hero image
                <ExpoImage
                  source={{ uri: item.reference_images[0] }}
                  style={styles.pinterestHeroImage}
                  contentFit="cover"
                />
              ) : item.reference_images.length === 2 ? (
                // Two images side by side
                <View style={styles.pinterestImageRow}>
                  {item.reference_images.slice(0, 2).map((imageUrl, index) => (
                    <ExpoImage
                      key={index}
                      source={{ uri: imageUrl }}
                      style={styles.pinterestImageHalf}
                      contentFit="cover"
                    />
                  ))}
                </View>
              ) : (
                // Grid layout for 3+ images
                <View style={styles.pinterestImageGrid}>
                  <ExpoImage
                    source={{ uri: item.reference_images[0] }}
                    style={styles.pinterestImageMain}
                    contentFit="cover"
                  />
                  <View style={styles.pinterestImageSide}>
                    <ExpoImage
                      source={{ uri: item.reference_images[1] }}
                      style={styles.pinterestImageSmall}
                      contentFit="cover"
                    />
                    {item.reference_images.length > 2 && (
                      <View style={styles.pinterestImageSmallWrapper}>
                        <ExpoImage
                          source={{ uri: item.reference_images[2] }}
                          style={styles.pinterestImageSmall}
                          contentFit="cover"
                        />
                        {item.reference_images.length > 3 && (
                          <View style={styles.pinterestImageOverlay}>
                            <Text style={styles.pinterestImageOverlayText}>
                              +{item.reference_images.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Card Content */}
          <View style={styles.pinterestClientCardContent}>
            {/* Title & Status Row */}
            <View style={styles.clientCardTop}>
              <Text style={styles.cleanRequestTitle} numberOfLines={2}>{item.title}</Text>
              <View style={[styles.cleanStatusBadge, { backgroundColor: statusColor + '10' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.cleanStatusText, { color: statusColor }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.cleanRequestDescription} numberOfLines={2}>
              {item.description}
            </Text>

            {/* Metadata Row */}
            <View style={styles.cleanMetadataRow}>
              {/* Bids count */}
              <View style={styles.cleanBidsSummary}>
                <View style={styles.cleanBidsIconContainer}>
                  <Ionicons name="people" size={14} color="#fff" />
                </View>
                <Text style={styles.cleanBidsText}>
                  {item.bid_count || 0}
                </Text>
                {pendingBidsCount > 0 && (
                  <View style={styles.cleanPendingDot} />
                )}
              </View>

              {/* Budget */}
              {item.budget_min || item.budget_max ? (
                <View style={styles.cleanBudgetContainer}>
                  <Ionicons name="cash" size={14} color={colors.text.secondary} />
                  <Text style={styles.cleanBudgetText}>
                    {item.budget_min && item.budget_max
                      ? `$${item.budget_min}-$${item.budget_max}`
                      : item.budget_min
                      ? `$${item.budget_min}+`
                      : `Up to $${item.budget_max}`}
                  </Text>
                </View>
              ) : null}

              {/* Timestamp */}
              <Text style={styles.cleanTimestamp}>
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </Text>
            </View>
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
        {/* Pinterest Content-First: Image at Top */}
        {hasReferenceImages && (
          <View style={styles.pinterestImageContainer}>
            {item.reference_images.length === 1 ? (
              // Single large hero image
              <ExpoImage
                source={{ uri: item.reference_images[0] }}
                style={styles.pinterestHeroImage}
                contentFit="cover"
              />
            ) : item.reference_images.length === 2 ? (
              // Two images side by side
              <View style={styles.pinterestImageRow}>
                {item.reference_images.slice(0, 2).map((imageUrl, index) => (
                  <ExpoImage
                    key={index}
                    source={{ uri: imageUrl }}
                    style={styles.pinterestImageHalf}
                    contentFit="cover"
                  />
                ))}
              </View>
            ) : (
              // Grid layout for 3+ images
              <View style={styles.pinterestImageGrid}>
                <ExpoImage
                  source={{ uri: item.reference_images[0] }}
                  style={styles.pinterestImageMain}
                  contentFit="cover"
                />
                <View style={styles.pinterestImageSide}>
                  <ExpoImage
                    source={{ uri: item.reference_images[1] }}
                    style={styles.pinterestImageSmall}
                    contentFit="cover"
                  />
                  {item.reference_images.length > 2 && (
                    <View style={styles.pinterestImageSmallWrapper}>
                      <ExpoImage
                        source={{ uri: item.reference_images[2] }}
                        style={styles.pinterestImageSmall}
                        contentFit="cover"
                      />
                      {item.reference_images.length > 3 && (
                        <View style={styles.pinterestImageOverlay}>
                          <Text style={styles.pinterestImageOverlayText}>
                            +{item.reference_images.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Client Info Header - Below Image */}
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
      {/* Header - Pinterest Minimal Style */}
      <View style={[styles.pinterestPageHeader, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.pinterestBackButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.pinterestHeaderTitle}>{isArtist ? 'Quest Board' : 'My Requests'}</Text>
        <View style={styles.pinterestHeaderActions}>
          {isArtist && (
            <TouchableOpacity
              style={styles.pinterestIconButton}
              onPress={() => setShowFiltersModal(true)}
            >
              <Ionicons name="options-outline" size={24} color={colors.text.primary} />
              {(filters.budget_min || filters.budget_max || filters.styles.length > 0) && (
                <View style={styles.pinterestFilterDot} />
              )}
            </TouchableOpacity>
          )}
          {!isArtist && (
            <TouchableOpacity
              style={styles.pinterestAddButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}
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
            <View style={styles.emptyIconCircle}>
              <Ionicons name="sparkles-outline" size={56} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {isArtist ? 'Your next project awaits!' : 'No Requests Yet'}
            </Text>
            <Text style={styles.emptyText}>
              {isArtist
                ? 'Browse commission requests from clients looking for talented artists like you'
                : 'Post your first commission request to connect with amazing artists'}
            </Text>
            {!isArtist && (
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.text.primary} />
                <Text style={styles.emptyActionText}>Create Request</Text>
              </TouchableOpacity>
            )}
            {isArtist && (
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => {
                  // Refresh to check for new requests
                  loadRequests();
                }}
              >
                <Ionicons name="refresh-outline" size={22} color={colors.text.primary} />
                <Text style={styles.emptyActionText}>Refresh</Text>
              </TouchableOpacity>
            )}
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
              {/* Header with Safe Area */}
              <View style={[styles.pinterestModalHeader, { paddingTop: insets.top + spacing.md }]}>
                <TouchableOpacity
                  onPress={() => setShowCreateModal(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.modalHeaderContent}>
                  <Text style={styles.pinterestTitle}>Create Request</Text>
                  <Text style={styles.pinterestSubtitle}>Tell artists what you need</Text>
                </View>
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

              {/* Reference Images Section - REQUIRED */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Reference Images *</Text>
                <Text style={styles.helperText}>
                  Help artists bring your vision to life. Add images showing the style, mood, or concepts you have in mind.
                </Text>

                {/* Image Preview Grid */}
                {formData.reference_images.length > 0 && (
                  <View style={styles.referenceImagesGrid}>
                    {formData.reference_images.map((imageUrl, index) => (
                      <View key={index} style={styles.referenceImageItem}>
                        <ExpoImage
                          source={{ uri: imageUrl }}
                          style={styles.referenceImagePreview}
                          contentFit="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => {
                            setFormData({
                              ...formData,
                              reference_images: formData.reference_images.filter((_, i) => i !== index)
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={24} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Image Button */}
                <TouchableOpacity
                  style={styles.addImageButton}
                  onPress={handlePickImage}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={32} color={colors.primary} />
                  <Text style={styles.addImageButtonText}>
                    {formData.reference_images.length === 0 ? 'Add Reference Images' : 'Add More Images'}
                  </Text>
                  <Text style={[styles.addImageButtonSubtext, formData.reference_images.length === 0 && { color: colors.primary }]}>
                    {formData.reference_images.length === 0 ? 'Tap to choose images' : `${formData.reference_images.length} image${formData.reference_images.length === 1 ? '' : 's'} added`}
                  </Text>
                </TouchableOpacity>
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

              {/* Styles Section - Simplified */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Preferred Styles (optional)</Text>
                <Text style={styles.helperText}>
                  Select art styles you're interested in - this helps artists understand your taste
                </Text>
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
              <View style={styles.pinterestModalHeader}>
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
            {/* Header with Safe Area */}
            <View style={[styles.pinterestModalHeader, { paddingTop: insets.top + spacing.md }]}>
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
            {/* Header with Safe Area */}
            <View style={[styles.pinterestHeader, { paddingTop: insets.top + spacing.md }]}>
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
                  <View key={bid.id} style={styles.pinterestBidCard}>
                    {/* Artist Header */}
                    <TouchableOpacity
                      style={styles.pinterestBidHeader}
                      onPress={() => {
                        setShowBidsModal(false);
                        router.push(`/artist/${bid.artist_id}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <ExpoImage
                        source={{ uri: bid.artist?.avatar_url || DEFAULT_AVATAR }}
                        style={styles.pinterestBidAvatar}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pinterestArtistName}>{bid.artist?.username || 'Artist'}</Text>
                        <Text style={styles.pinterestBidTimestamp}>
                          {new Date(bid.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>
                      <View style={[styles.pinterestBidStatusBadge, { backgroundColor: bid.status === 'pending' ? colors.status.pending + '15' : bid.status === 'accepted' ? colors.status.success + '15' : colors.text.secondary + '15' }]}>
                        <View style={[styles.statusDot, { backgroundColor: bid.status === 'pending' ? colors.status.pending : bid.status === 'accepted' ? colors.status.success : colors.text.secondary }]} />
                        <Text style={[styles.bidStatusText, { color: bid.status === 'pending' ? colors.status.pending : bid.status === 'accepted' ? colors.status.success : colors.text.secondary }]}>
                          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                    </TouchableOpacity>

                    {/* Bid Details */}
                    <View style={styles.pinterestBidDetails}>
                      <View style={styles.pinterestBidDetailRow}>
                        <View style={styles.pinterestBidDetailCard}>
                          <View style={styles.bidDetailIconContainer}>
                            <Ionicons name="cash-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.pinterestBidDetailLabel}>Offer</Text>
                          <Text style={styles.pinterestBidDetailValue}>${bid.bid_amount}</Text>
                        </View>
                        {bid.estimated_delivery_days && (
                          <View style={styles.pinterestBidDetailCard}>
                            <View style={styles.bidDetailIconContainer}>
                              <Ionicons name="time-outline" size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.pinterestBidDetailLabel}>Delivery</Text>
                            <Text style={styles.pinterestBidDetailValue}>{bid.estimated_delivery_days} days</Text>
                          </View>
                        )}
                      </View>

                      {bid.message && (
                        <View style={styles.pinterestBidMessage}>
                          <Text style={styles.pinterestBidMessageLabel}>Message</Text>
                          <Text style={styles.pinterestBidMessageText}>{bid.message}</Text>
                        </View>
                      )}

                      {bid.status === 'pending' && selectedRequest.status === 'open' && (
                        <TouchableOpacity
                          style={styles.pinterestAcceptBidButton}
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
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
                          <Text style={styles.pinterestAcceptBidButtonText}>Accept Bid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.pinterestNoBidsState}>
                  <View style={styles.noBidsIconContainer}>
                    <Ionicons name="people-outline" size={48} color={colors.text.disabled} />
                  </View>
                  <Text style={styles.pinterestNoBidsTitle}>No bids yet</Text>
                  <Text style={styles.pinterestNoBidsText}>Artists will see your request and can submit bids</Text>
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
  // Pinterest-Style Minimal Page Header
  pinterestPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  pinterestBackButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm, // Align to edge
  },
  pinterestHeaderTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  pinterestHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pinterestIconButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm, // Align to edge
    position: 'relative',
  },
  pinterestAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -spacing.sm,
  },
  pinterestFilterDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
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
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
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
    backgroundColor: colors.background, // Pinterest-style clean background
    borderRadius: 16, // Soft Pinterest rounding
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Very soft shadow
    shadowRadius: 8,
    elevation: 2,
  },
  // Enhanced Pinterest-style client cards
  pinterestClientCard: {
    backgroundColor: colors.background,
    borderRadius: 24,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  clientImagePreview: {
    width: '100%',
    height: 180,
    flexDirection: 'row',
    backgroundColor: colors.surfaceLight,
    gap: 3,
  },
  clientPreviewImage: {
    flex: 1,
    height: '100%',
  },
  clientPreviewImageSingle: {
    flex: 1,
    width: '100%',
  },
  clientPreviewImageDouble: {
    width: '50%',
  },
  pinterestClientCardContent: {
    padding: spacing.xl,
  },
  // Clean Pinterest-style client card elements
  clientCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  cleanRequestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.4,
    flex: 1,
  },
  cleanStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.full,
  },
  cleanStatusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cleanRequestDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  cleanMetadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '15',
  },
  cleanBidsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cleanBidsIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cleanBidsText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  cleanPendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
    marginLeft: spacing.xs / 2,
  },
  cleanBudgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cleanBudgetText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  cleanTimestamp: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 13,
    marginLeft: 'auto',
  },
  pinterestStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pinterestBidsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  bidsIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinterestPendingBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  pinterestBudgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
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
    fontSize: 17,
    fontWeight: '700', // Pinterest-style
    marginBottom: spacing.sm,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  requestDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: spacing.md,
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
    fontSize: 14,
    fontWeight: '600', // Pinterest-style
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg + spacing.sm,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
    letterSpacing: -0.3,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg + spacing.md,
    paddingHorizontal: spacing.md,
    maxWidth: 340,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg + spacing.md,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyActionText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs + 2,
    marginTop: spacing.xs,
    letterSpacing: -0.2,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: spacing.sm + 2,
    lineHeight: 20,
    fontWeight: '400',
  },
  // Reference Images Styles
  referenceImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  referenceImageItem: {
    width: (width - spacing.xl * 2 - spacing.lg * 2 - spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surface,
  },
  referenceImagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addImageButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  addImageButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addImageButtonSubtext: {
    ...typography.caption,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.text.primary,
    ...typography.body,
    fontSize: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
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
    marginBottom: spacing.lg + spacing.sm,
  },
  filterSection: {
    marginBottom: spacing.xl,
    paddingBottom: 0, // No border dividers
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
    fontSize: 17,
    fontWeight: '700',
  },
  sortOptions: {
    gap: spacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: spacing.sm,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sortOptionActive: {
    backgroundColor: colors.primary + '08',
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
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
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    marginBottom: spacing.sm + 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  categoryStylesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  stylesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  styleOption: {
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  styleOptionSelected: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  styleOptionText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  styleOptionTextSelected: {
    color: colors.text.primary,
    fontWeight: '700',
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
    borderRadius: 18,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  // Enhanced Pinterest-style bid cards
  pinterestBidCard: {
    backgroundColor: colors.background,
    borderRadius: 20,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  pinterestBidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
  },
  pinterestBidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  pinterestArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  pinterestBidTimestamp: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
  },
  pinterestBidStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  pinterestBidDetails: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pinterestBidDetailRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pinterestBidDetailCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  bidDetailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinterestBidDetailLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  pinterestBidDetailValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  pinterestBidMessage: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  pinterestBidMessageLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pinterestBidMessageText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  pinterestAcceptBidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  pinterestAcceptBidButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pinterestNoBidsState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  noBidsIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  pinterestNoBidsTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  pinterestNoBidsText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer dimming like Pinterest
  },
  pinterestModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, // Pinterest-style soft rounding
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: spacing.sm,
  },
  pinterestModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '10', // Even softer border
  },
  modalHeaderContent: {
    flex: 1,
    alignItems: 'center',
  },
  pinterestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  pinterestSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 3,
    fontSize: 13,
    fontWeight: '400',
  },
  pinterestBody: {
    flex: 1,
  },
  pinterestBodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pinterestFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border + '15', // Very subtle border
    backgroundColor: colors.background,
  },
  pinterestSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.full, // Full pill shape
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, // Soft shadow
    shadowRadius: 12,
    elevation: 4,
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
    letterSpacing: 0.5,
  },
  pinterestFooterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinterestSecondaryButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pinterestSecondaryButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 15,
  },
  pinterestPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  pinterestPrimaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  // Pinterest-Style Quest Board Cards
  pinterestQuestCard: {
    backgroundColor: colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  questImagePreview: {
    flexDirection: 'row',
    height: 220,
    backgroundColor: colors.surfaceLight,
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
  // Pinterest Content-First Image Styles
  pinterestImageContainer: {
    marginBottom: spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pinterestHeroImage: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surface,
  },
  pinterestImageRow: {
    flexDirection: 'row',
    gap: 4,
    height: 220,
  },
  pinterestImageHalf: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  pinterestImageGrid: {
    flexDirection: 'row',
    gap: 4,
    height: 240,
  },
  pinterestImageMain: {
    flex: 2,
    backgroundColor: colors.surface,
  },
  pinterestImageSide: {
    flex: 1,
    gap: 4,
  },
  pinterestImageSmall: {
    width: '100%',
    height: '48.5%',
    backgroundColor: colors.surface,
  },
  pinterestImageSmallWrapper: {
    position: 'relative',
    height: '48.5%',
  },
  pinterestImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinterestImageOverlayText: {
    ...typography.h2,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  questCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  questTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  questDescription: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  questInfoRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  questBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary + '12', // Softer background
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
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  questStyleTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background, // Borderless Pinterest style
  },
  questStyleText: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  questMoreStyles: {
    ...typography.small,
    color: colors.text.disabled,
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'center',
    paddingHorizontal: spacing.xs,
  },
});

