import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (profile?.artist) {
      setCommissionStatus(profile.artist.commission_status || 'open');
      setMinPrice(profile.artist.min_price?.toString() || '');
      setMaxPrice(profile.artist.max_price?.toString() || '');
      setTurnaroundDays(profile.artist.turnaround_days?.toString() || '');
      setSpecialties(profile.artist.specialties?.join(', ') || '');
    }
  }, [profile]);

  const handleSave = async () => {
    // Validation
    if (minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)) {
      Alert.alert('Error', 'Minimum price cannot be greater than maximum price');
      return;
    }

    if (turnaroundDays && parseInt(turnaroundDays) < 1) {
      Alert.alert('Error', 'Turnaround days must be at least 1');
      return;
    }

    setIsSaving(true);

    try {
      const specialtiesArray = specialties
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const updateData = {
        commissionStatus,
      };

      if (minPrice) updateData.minPrice = parseFloat(minPrice);
      if (maxPrice) updateData.maxPrice = parseFloat(maxPrice);
      if (turnaroundDays) updateData.turnaroundDays = parseInt(turnaroundDays);
      if (specialtiesArray.length > 0) updateData.specialties = specialtiesArray;

      await axios.put(
        `${API_URL}/artists/${user.id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refresh profile
      await fetchProfile(user.id, token);

      Alert.alert('Success', 'Artist profile updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error updating artist profile:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to update artist profile');
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
        {/* Commission Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commission Status</Text>
          <Text style={styles.helperText}>Let clients know if you’re open</Text>

          <View style={styles.statusButtons}>
            {[
              { key: 'open', label: 'Open', icon: 'checkmark-circle' },
              { key: 'limited', label: 'Limited', icon: 'time' },
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
    borderBottomColor: colors.border,
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
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  switchDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statusButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusButtonActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}12`,
  },
  statusButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  statusButtonTextActive: {
    color: colors.primary,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
