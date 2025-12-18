import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import { uploadImage } from '../../utils/imageUpload';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function CreateCommissionScreen() {
  const { artistId, packageId: initialPackageId } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(!artistId);
  const [currentArtistId, setCurrentArtistId] = useState(artistId);
  const [referenceImages, setReferenceImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (artistId) {
      setCurrentArtistId(artistId);
      setShowSearch(false);
    }
  }, [artistId]);

  useEffect(() => {
    const fetchPackages = async () => {
      if (!currentArtistId) {
        setPackages([]);
        setPackagesLoading(false);
        return;
      }
      setPackagesLoading(true);
      try {
        const response = await axios.get(`${API_URL}/artists/${currentArtistId}/packages`);
        setPackages(response.data || []);
        if (initialPackageId) {
          const match = (response.data || []).find((p) => String(p.id) === String(initialPackageId));
          setSelectedPackageId(match ? match.id : null);
        } else if ((response.data || []).length === 1) {
          setSelectedPackageId(response.data[0].id);
        }
        setSelectedAddons([]);
      } catch (error) {
        console.error('Error fetching packages for request:', error);
        setPackages([]);
      } finally {
        setPackagesLoading(false);
      }
    };

    fetchPackages();
  }, [currentArtistId, initialPackageId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await axios.get(`${API_URL}/artists`, {
          params: {
            search: searchQuery.trim(),
            limit: 20,
            commission_status: 'open',
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setSearchResults(response.data.artists || []);
      } catch (error) {
        console.error('Error searching artists:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, token]);

  const handleSelectArtist = (artist) => {
    setSelectedArtist(artist);
    setCurrentArtistId(artist.id);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setUploadingImages(true);
      const uploadedUrls = [];

      for (const asset of result.assets) {
        try {
          const url = await uploadImage(asset.uri, 'commissions', '', token);
          uploadedUrls.push(url);
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Upload Failed',
            text2: 'Failed to upload image. Please try again.',
          });
        }
      }

      if (uploadedUrls.length > 0) {
        setReferenceImages([...referenceImages, ...uploadedUrls]);
      }
      setUploadingImages(false);
    }
  };

  const handleSubmit = async () => {
    // Check if current user is an artist
    if (user?.artists) {
      Toast.show({
        type: 'info',
        text1: 'Not Available',
        text2: 'Artists cannot request commissions from other artists. This feature is only available for clients.',
        visibilityTime: 3000,
      });
      router.back();
      return;
    }

    if (!currentArtistId) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please select an artist to request a commission from',
        visibilityTime: 2000,
      });
      return;
    }

    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please provide a title for your commission',
        visibilityTime: 2000,
      });
      return;
    }

    if (!description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Required',
        text2: 'Please provide details about what you want',
        visibilityTime: 2000,
      });
      return;
    }

    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/commissions/request`,
        {
          artist_id: currentArtistId,
          details: description.trim(),
          client_note: title.trim(),
          budget: budget.trim() ? parseFloat(budget.trim()) : null,
          deadline: deadline.trim() || null,
          package_id: selectedPackageId || null,
          selected_addons: selectedAddons,
          reference_images: referenceImages,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Your commission request has been sent to the artist.',
        visibilityTime: 3000,
      });
      // Navigate back after a short delay
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      console.error('Error creating commission:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to create commission request',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Commission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl }}
      >
        <Text style={styles.description}>
          Describe what you'd like the artist to create for you
        </Text>

        {/* Artist Search Section */}
        {showSearch && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Search for an Artist *</Text>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username or name..."
                placeholderTextColor={colors.text.disabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={showSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {searchLoading && (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.searchLoadingText}>Searching...</Text>
              </View>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const artistUser = item.users || {};
                    const displayName = artistUser.full_name || artistUser.username || 'Unknown Artist';
                    const username = artistUser.username || 'unknown';
                    return (
                      <TouchableOpacity
                        style={styles.artistResultItem}
                        onPress={() => handleSelectArtist(item)}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: artistUser.avatar_url || DEFAULT_AVATAR }}
                          style={styles.artistResultAvatar}
                          contentFit="cover"
                        />
                        <View style={styles.artistResultInfo}>
                          <Text style={styles.artistResultName} numberOfLines={1}>
                            {displayName}
                          </Text>
                          <Text style={styles.artistResultUsername} numberOfLines={1}>
                            @{username}
                          </Text>
                          {item.rating != null && typeof item.rating === 'number' && (
                            <View style={styles.artistResultRating}>
                              <Ionicons name="star" size={12} color={colors.status.warning} />
                              <Text style={styles.artistResultRatingText}>
                                {item.rating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                      </TouchableOpacity>
                    );
                  }}
                  scrollEnabled={false}
                />
              </View>
            )}

            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <View style={styles.searchEmptyContainer}>
                <Ionicons name="person-outline" size={48} color={colors.text.disabled} />
                <Text style={styles.searchEmptyText}>No artists found</Text>
                <Text style={styles.searchEmptySubtext}>
                  Try searching with a different name or username
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Selected Artist Display */}
        {selectedArtist && !showSearch && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Selected Artist</Text>
            <TouchableOpacity
              style={styles.selectedArtistCard}
              onPress={() => {
                setShowSearch(true);
                setSelectedArtist(null);
                setCurrentArtistId(null);
                setPackages([]);
                setSelectedPackageId(null);
              }}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: selectedArtist.users?.avatar_url || DEFAULT_AVATAR }}
                style={styles.selectedArtistAvatar}
                contentFit="cover"
              />
              <View style={styles.selectedArtistInfo}>
                <Text style={styles.selectedArtistName} numberOfLines={1}>
                  {selectedArtist.users?.full_name || selectedArtist.users?.username}
                </Text>
                <Text style={styles.selectedArtistUsername} numberOfLines={1}>
                  @{selectedArtist.users?.username}
                </Text>
              </View>
              <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Package selection - Only show if artist is selected */}
        {currentArtistId && (
          <View style={styles.inputGroup}>
            <View style={styles.packageHeader}>
              <Text style={styles.label}>Choose a package (optional)</Text>
              {packagesLoading && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {packagesLoading ? null : packages.length === 0 ? (
              <Text style={styles.packageEmptyText}>
                This artist hasn't published packages yet. You can still send a custom request.
              </Text>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.packageScrollContent}
            >
              {packages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageOption,
                      isSelected && styles.packageOptionSelected,
                    ]}
                    onPress={() => setSelectedPackageId(isSelected ? null : pkg.id)}
                    activeOpacity={0.85}
                  >
                    {/* Package Image - Compact */}
                    {pkg.thumbnail_url || pkg.image_url ? (
                      <Image
                        source={{ uri: pkg.thumbnail_url || pkg.image_url }}
                        style={styles.packageImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.packageImagePlaceholder}>
                        <Ionicons name="cube-outline" size={24} color={colors.text.disabled} />
                      </View>
                    )}
                    
                    {/* Selected Indicator */}
                    {isSelected && (
                      <View style={styles.packageSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.text.primary} />
                      </View>
                    )}
                    
                    {/* Compact Info */}
                    <View style={styles.packageContent}>
                      <Text style={styles.packageOptionTitle} numberOfLines={1}>{pkg.name}</Text>
                      <Text style={styles.packageOptionPrice}>${pkg.base_price}</Text>
                      {pkg.estimated_delivery_days && (
                        <View style={styles.packageMetaCompact}>
                          <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
                          <Text style={styles.packageMetaTextCompact}><Text style={{ fontWeight: '700' }}>{pkg.estimated_delivery_days}</Text>d</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          
          {/* Add-ons Section - Outside ScrollView */}
          {selectedPackage?.addons?.length ? (
            <View style={styles.addonList}>
              <Text style={styles.addonHeader}>Add-ons</Text>
              {selectedPackage.addons.map((addon) => {
                const isChecked = selectedAddons.includes(addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={styles.addonRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedAddons((prev) =>
                        prev.includes(addon.id)
                          ? prev.filter((id) => id !== addon.id)
                          : [...prev, addon.id]
                      );
                    }}
                  >
                    <View style={[styles.addonCheckbox, isChecked && styles.addonCheckboxChecked]}>
                      {isChecked && <Ionicons name="checkmark" size={14} color={colors.text.primary} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addonName}>{addon.name}</Text>
                      {addon.description ? (
                        <Text style={styles.addonDesc} numberOfLines={2}>{addon.description}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.addonPrice}>+${addon.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          </View>
        )}

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Custom Portrait"
            placeholderTextColor={colors.text.disabled}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your commission in detail..."
            placeholderTextColor={colors.text.disabled}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.characterCount}>{description.length}/1000</Text>
        </View>

        {/* Budget - Only show if no package is selected */}
        {!selectedPackageId && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Budget (Optional)</Text>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.prefix}>$</Text>
              <TextInput
                style={[styles.input, styles.inputWithPrefixField]}
                value={budget}
                onChangeText={setBudget}
                placeholder="100"
                placeholderTextColor={colors.text.disabled}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        )}

        {/* Deadline */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Deadline (Optional)</Text>
          <TextInput
            style={styles.input}
            value={deadline}
            onChangeText={setDeadline}
            placeholder="e.g., 2 weeks, End of month"
            placeholderTextColor={colors.text.disabled}
          />
        </View>

        {/* Reference Images */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Reference Images (Optional)</Text>
          <Text style={styles.helperText}>
            Share visual references to help the artist understand your vision
          </Text>

          {/* Image Preview Grid */}
          {referenceImages.length > 0 && (
            <View style={styles.referenceImagesGrid}>
              {referenceImages.map((imageUrl, index) => (
                <View key={index} style={styles.referenceImageItem}>
                  <Image source={{ uri: imageUrl }} style={styles.referenceImagePreview} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setReferenceImages(referenceImages.filter((_, i) => i !== index));
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            onPress={handlePickImages}
            disabled={uploadingImages}
            activeOpacity={0.8}
          >
            {uploadingImages ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="images-outline" size={28} color={colors.primary} />
                <Text style={styles.addImageButtonText}>
                  {referenceImages.length === 0 ? 'Add Reference Images' : 'Add More Images'}
                </Text>
                {referenceImages.length > 0 && (
                  <Text style={styles.addImageButtonSubtext}>
                    {referenceImages.length} added
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.helpBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.helpText}>
            The artist will review your request and respond with their availability and pricing.
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <>
              <Ionicons name="send" size={20} color={colors.text.primary} />
              <Text style={styles.submitButtonText}>Send Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  packageScrollContent: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  packageOption: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    position: 'relative',
  },
  packageOptionSelected: {
    borderColor: colors.primary,
  },
  packageImage: {
    width: '100%',
    height: 100,
    backgroundColor: colors.surfaceLight,
  },
  packageImagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageSelectedBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  packageContent: {
    padding: spacing.sm,
  },
  packageMetaCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  packageMetaTextCompact: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  packageOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  packageOptionTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.sm,
  },
  packageOptionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  packageOptionDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  packageOptionDescriptionMuted: {
    ...typography.caption,
    color: colors.text.disabled,
    marginBottom: spacing.sm,
  },
  packageOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  packageMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageMetaText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  packageEmptyText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  addonList: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  addonHeader: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  addonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addonCheckbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    paddingTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '60',
    minHeight: 48,
    fontSize: 15,
    textAlignVertical: 'center',
    includeFontPadding: false,
    textAlign: 'left',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
    includeFontPadding: false,
    textAlign: 'left',
  },
  characterCount: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    ...typography.h3,
    color: colors.text.secondary,
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  inputWithPrefixField: {
    flex: 1,
    paddingLeft: spacing.xl,
  },
  helpBox: {
    flexDirection: 'row',
    backgroundColor: `${colors.primary}15`,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  helpText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  referenceImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  referenceImageItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  referenceImagePreview: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  addImageButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  addImageButtonText: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  addImageButtonSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '40',
    backgroundColor: colors.background,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  searchLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  searchLoadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  searchResultsContainer: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 300,
  },
  artistResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
    gap: spacing.md,
  },
  artistResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
  },
  artistResultInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  artistResultName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  artistResultUsername: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  artistResultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  artistResultRatingText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  selectedArtistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    gap: spacing.md,
  },
  selectedArtistAvatar: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
  },
  selectedArtistInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  selectedArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  selectedArtistUsername: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  searchEmptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  searchEmptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  searchEmptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
