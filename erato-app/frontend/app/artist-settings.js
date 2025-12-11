import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ArtistSettings() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Commission Settings
  const [queueSlots, setQueueSlots] = useState('3');
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [autoDecline, setAutoDecline] = useState(false);
  const [commissionsPaused, setCommissionsPaused] = useState(false);

  // Will/Won't Draw
  const [willDraw, setWillDraw] = useState('');
  const [wontDraw, setWontDraw] = useState('');

  // Terms of Service
  const [termsOfService, setTermsOfService] = useState('');
  const [revisionLimit, setRevisionLimit] = useState('2');
  const [turnaroundTime, setTurnaroundTime] = useState('7-14');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/artists/settings`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const settings = response.data.settings || {};

      setQueueSlots(settings.max_queue_slots?.toString() || settings.queue_slots?.toString() || '5');
      setWaitlistEnabled(settings.allow_waitlist || settings.waitlist_enabled || false);
      setAutoDecline(settings.auto_decline_when_full || false);
      setCommissionsPaused(!settings.is_open || settings.commissions_paused || false);
      setWillDraw(Array.isArray(settings.will_draw) ? settings.will_draw.join(', ') : (settings.will_draw || ''));
      setWontDraw(Array.isArray(settings.wont_draw) ? settings.wont_draw.join(', ') : (settings.wont_draw || ''));
      setTermsOfService(settings.terms_of_service || '');
      setRevisionLimit(settings.revision_limit?.toString() || '2');
      setTurnaroundTime(settings.turnaround_time || '7-14');
    } catch (error) {
      console.error('Error loading settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load settings',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      const settings = {
        max_queue_slots: parseInt(queueSlots) || 5,
        allow_waitlist: waitlistEnabled,
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

      Toast.show({
        type: 'success',
        text1: 'Saved',
        text2: 'Commission settings updated',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to save settings',
        visibilityTime: 2000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Commission Settings',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Commission Settings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text.primary,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
              <Switch
                value={commissionsPaused}
                onValueChange={setCommissionsPaused}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.primary}
              />
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
              <Switch
                value={waitlistEnabled}
                onValueChange={setWaitlistEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-Decline When Full</Text>
                <Text style={styles.settingDescription}>
                  Automatically decline new requests when queue is full
                </Text>
              </View>
              <Switch
                value={autoDecline}
                onValueChange={setAutoDecline}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.primary}
                disabled={waitlistEnabled}
              />
            </View>
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
              List topics/themes you're comfortable drawing (one per line)
            </Text>
            <TextInput
              style={styles.multilineInput}
              placeholder="e.g., Fantasy characters, Portraits, Landscapes..."
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
              List topics/themes you won't accept (one per line)
            </Text>
            <TextInput
              style={styles.multilineInput}
              placeholder="e.g., NSFW content, Mecha, Political themes..."
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
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Revision Limit</Text>
                <Text style={styles.settingDescription}>
                  Number of free revisions included
                </Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={revisionLimit}
                onChangeText={setRevisionLimit}
                keyboardType="number-pad"
                maxLength={1}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Turnaround Time</Text>
                <Text style={styles.settingDescription}>
                  Estimated completion time (days)
                </Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={turnaroundTime}
                onChangeText={setTurnaroundTime}
                placeholder="e.g., 7-14"
                placeholderTextColor={colors.text.disabled}
              />
            </View>
          </View>

          <View style={[styles.settingCard, styles.marginTop]}>
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
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  marginTop: {
    marginTop: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
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
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  numberInput: {
    ...typography.h3,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 60,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  textInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 100,
    textAlign: 'right',
    fontSize: 14,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  inputHint: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  multilineInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
  },
  largeMultilineInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 200,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    ...shadows.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
