import { useState, useEffect } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function CreateCommissionScreen() {
  const { artistId, packageId: initialPackageId } = useLocalSearchParams();
  const { token, user } = useAuthStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      if (!artistId) return;
      setPackagesLoading(true);
      try {
        const response = await axios.get(`${API_URL}/artists/${artistId}/packages`);
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
  }, [artistId, initialPackageId]);

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
          artist_id: artistId,
          details: description.trim(),
          client_note: title.trim(),
          budget: budget.trim() ? parseFloat(budget.trim()) : null,
          deadline: deadline.trim() || null,
          package_id: selectedPackageId || null,
          selected_addons: selectedAddons,
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Commission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Describe what you'd like the artist to create for you
        </Text>

        {/* Package selection */}
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
                          <Text style={styles.packageMetaTextCompact}>{pkg.estimated_delivery_days}d</Text>
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

        {/* Budget */}
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

        <View style={styles.helpBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.helpText}>
            The artist will review your request and respond with their availability and pricing.
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
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
    flex: 1,
    marginRight: spacing.sm,
  },
  packageOptionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 16,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 120,
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
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
});
