import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';
import { useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';
import { showAlert } from '../components/StyledAlert';

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
      showAlert({
        title: 'Error',
        message: 'Failed to load settings',
        type: 'error',
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (showToast = true) => {
    // Prevent multiple simultaneous saves
    if (saving) return;

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

      if (showToast) {
        showAlert({
          title: 'Saved',
          message: 'Commission settings updated',
          type: 'success',
          duration: 1500,
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save settings',
        type: 'error',
        duration: 2000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Commission Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commission Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              <TouchableOpacity
                style={[styles.switch, commissionsPaused && styles.switchActive]}
                onPress={() => {
                  setCommissionsPaused(!commissionsPaused);
                  setTimeout(() => {
                    saveSettings(false);
                  }, 300);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.switchThumb, commissionsPaused && styles.switchThumbActive]} />
              </TouchableOpacity>
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
                textAlignVertical="center"
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
              <TouchableOpacity
                style={[styles.switch, waitlistEnabled && styles.switchActive]}
                onPress={() => {
                  setWaitlistEnabled(!waitlistEnabled);
                  setTimeout(() => {
                    saveSettings(false);
                  }, 300);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.switchThumb, waitlistEnabled && styles.switchThumbActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto-Decline When Full</Text>
                <Text style={styles.settingDescription}>
                  Automatically decline new requests when queue is full
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.switch,
                  autoDecline && styles.switchActive,
                  waitlistEnabled && styles.switchDisabled
                ]}
                onPress={() => {
                  if (waitlistEnabled) return;
                  setAutoDecline(!autoDecline);
                  setTimeout(() => {
                    saveSettings(false);
                  }, 300);
                }}
                activeOpacity={0.8}
                disabled={waitlistEnabled}
              >
                <View style={[styles.switchThumb, autoDecline && styles.switchThumbActive]} />
              </TouchableOpacity>
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
                textAlignVertical="center"
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
    </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Constants.statusBarHeight + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15',
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  settingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  marginTop: {
    marginTop: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
    justifyContent: 'center',
    minWidth: 0,
  },
  settingLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: colors.border + '30',
    marginVertical: spacing.md,
  },
  numberInput: {
    ...typography.h3,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: 70,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: 120,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '600',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  inputLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
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
    borderWidth: 0,
    borderRadius: 16,
    padding: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  largeMultilineInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background,
    borderWidth: 0,
    borderRadius: 16,
    padding: spacing.lg,
    paddingTop: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 200,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    padding: 2,
    flexShrink: 0,
  },
  switchActive: {
    backgroundColor: '#E60023',
  },
  switchDisabled: {
    opacity: 0.5,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
});
