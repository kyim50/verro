import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function EditArtistProfileScreen() {
  const { user, token } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();

  const [commissionStatus, setCommissionStatus] = useState('open');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [turnaroundDays, setTurnaroundDays] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [maxSlots, setMaxSlots] = useState('5');
  const [allowWaitlist, setAllowWaitlist] = useState(false);
  const isInitialMount = useRef(true);

  const fetchSlotsSettings = async () => {
    try {
      if (!user?.id) return;
      const { data } = await axios.get(`${API_URL}/commission-packages/settings/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (data?.max_queue_slots) setMaxSlots(String(data.max_queue_slots));
      setAllowWaitlist(!!data?.allow_waitlist);
    } catch (error) {
      console.error('Error loading slots settings:', error);
    }
  };

  useEffect(() => {
    // Only set initial values on first mount, not when profile updates after save
    if (isInitialMount.current && profile?.artist) {
      setCommissionStatus(profile.artist.commission_status || 'open');
      setMinPrice(profile.artist.min_price?.toString() || '');
      setMaxPrice(profile.artist.max_price?.toString() || '');
      setTurnaroundDays(profile.artist.turnaround_days?.toString() || '');
      setSpecialties(profile.artist.specialties?.join(', ') || '');
      fetchSlotsSettings();
      isInitialMount.current = false;
    }
  }, [profile]);

  const handleSave = async () => {
    // Validation
    if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Minimum price cannot be greater than maximum price',
        visibilityTime: 2000,
      });
      return;
    }

    if (turnaroundDays && parseInt(turnaroundDays) < 1) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Turnaround days must be at least 1',
        visibilityTime: 2000,
      });
      return;
    }

    setIsSaving(true);

    try {
      const specialtiesArray = specialties
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const updateData = {
        commission_status: commissionStatus,
      };

      if (minPrice && minPrice.trim() !== '') {
        updateData.min_price = parseFloat(minPrice);
      } else if (minPrice === '' || !minPrice) {
        updateData.min_price = null; // Clear min_price if empty
      }
      
      if (maxPrice && maxPrice.trim() !== '') {
        updateData.max_price = parseFloat(maxPrice);
      } else if (maxPrice === '' || !maxPrice) {
        updateData.max_price = null; // Clear max_price if empty
      }
      
      if (turnaroundDays && turnaroundDays.trim() !== '') {
        updateData.turnaround_days = parseInt(turnaroundDays);
      } else if (turnaroundDays === '' || !turnaroundDays) {
        updateData.turnaround_days = null; // Clear turnaround_days if empty
      }
      
      if (specialtiesArray.length > 0) {
        updateData.specialties = specialtiesArray;
      } else {
        updateData.specialties = []; // Clear specialties if empty
      }

      const response = await axios.put(
        `${API_URL}/users/me/artist`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update slots/waitlist
      const slotsPayload = {
        max_queue_slots: maxSlots ? parseInt(maxSlots, 10) : 5,
        allow_waitlist: allowWaitlist,
        is_open: commissionStatus === 'open',
      };
      await axios.post(
        `${API_URL}/commission-packages/settings`,
        slotsPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Commission update response:', response.data);

      // Build updated artist data from response (server is source of truth)
      const updatedArtistData = {
        ...response.data,
      };

      // Optimistically update profile store immediately with server response
      useProfileStore.setState((state) => {
        if (state.profile && state.profile.artist) {
          return {
            profile: {
              ...state.profile,
              artist: {
                ...state.profile.artist,
                ...updatedArtistData, // Use server response as source of truth
              },
            },
          };
        }
        return state;
      });

      // Force refresh to bypass cache and get fresh data from server
      // This ensures everything is in sync
      await fetchProfile(user.id, token, true);
      
      // Also update auth store user data if artist info is nested there
      const { fetchUser } = useAuthStore.getState();
      if (fetchUser) {
        await fetchUser();
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Artist profile updated successfully',
        visibilityTime: 2000,
      });
      
      // Navigate back immediately - profile screen will refresh on focus
      router.back();
    } catch (error) {
      console.error('Error updating artist profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to update artist profile',
        visibilityTime: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Commission Info</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick link to manage packages */}
        <TouchableOpacity
          style={styles.quickLinkCard}
          onPress={() => router.push('/commission-packages')}
          activeOpacity={0.9}
        >
          <View style={styles.quickLinkIcon}>
            <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.quickLinkText}>
            <Text style={styles.quickLinkTitle}>Manage Packages</Text>
            <Text style={styles.quickLinkSubtitle}>Create, edit, and hide client-facing packages.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Commission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Status</Text>
          <Text style={styles.helperText}>Let clients know if you're accepting commissions</Text>

          <View style={styles.statusButtons}>
            {[
              { key: 'open', label: 'Open', icon: 'checkmark-circle' },
              { key: 'closed', label: 'Closed', icon: 'close-circle' },
            ].map((opt) => {
              const active = commissionStatus === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.statusButton, active && styles.statusButtonActive]}
                  onPress={() => setCommissionStatus(opt.key)}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={active ? colors.primary : colors.text.secondary}
                  />
                  <Text
                    style={[
                      styles.statusButtonText,
                      active && styles.statusButtonTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Slots & Waitlist */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Slots & Queue</Text>
          <Text style={styles.helperText}>Set how many commissions you can take at once</Text>

          <Text style={styles.inputLabel}>Max active slots</Text>
          <TextInput
            style={styles.input}
            placeholder="5"
            placeholderTextColor={colors.text.disabled}
            value={maxSlots}
            onChangeText={setMaxSlots}
            keyboardType="number-pad"
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: spacing.md, minWidth: 0 }}>
              <Text style={styles.switchLabel}>Allow waitlist</Text>
              <Text style={styles.switchDescription} numberOfLines={2}>Let clients join when full</Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Switch
                value={allowWaitlist}
                onValueChange={setAllowWaitlist}
                trackColor={{ false: colors.border + '40', true: colors.primary + '40' }}
                thumbColor={allowWaitlist ? colors.primary : colors.background}
                ios_backgroundColor={colors.border + '40'}
              />
            </View>
          </View>
        </View>

        {/* Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <Text style={styles.helperText}>Typical range clients should expect</Text>

          <View style={styles.priceRow}>
            <View style={styles.priceInput}>
              <Text style={styles.inputLabel}>Min ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                placeholderTextColor={colors.text.disabled}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.priceInput}>
              <Text style={styles.inputLabel}>Max ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="500"
                placeholderTextColor={colors.text.disabled}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Turnaround */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Turnaround</Text>
          <Text style={styles.helperText}>Average completion time (days)</Text>
          <TextInput
            style={styles.input}
            placeholder="7"
            placeholderTextColor={colors.text.disabled}
            value={turnaroundDays}
            onChangeText={setTurnaroundDays}
            keyboardType="number-pad"
          />
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <Text style={styles.helperText}>Comma-separated (e.g. Portraits, Landscapes)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Portraits, Landscapes, Abstract"
            placeholderTextColor={colors.text.disabled}
            value={specialties}
            onChangeText={setSpecialties}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
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
    borderBottomColor: colors.border + '40',
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
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  quickLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 0,
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  quickLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  quickLinkTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
  },
  quickLinkSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  section: {
    marginBottom: spacing.xl + spacing.sm,
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginBottom: spacing.sm,
    fontWeight: '400',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 16,
    marginTop: spacing.sm,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 4,
    fontSize: 15,
    fontWeight: '600',
  },
  switchDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400',
    maxWidth: '90%',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  statusButtonActive: {
    backgroundColor: colors.primary + '15',
    shadowOpacity: 0.08,
  },
  statusButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 15,
  },
  statusButtonTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md + 2,
    paddingTop: spacing.md + 2,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 0,
    minHeight: 52,
    fontSize: 15,
    textAlignVertical: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md + 2,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
