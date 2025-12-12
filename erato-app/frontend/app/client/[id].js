import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import Toast from 'react-native-toast-message';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadClientProfile();
  }, [id]);

  const loadClientProfile = async () => {
    try {
      setLoading(true);

      // Fetch client user data
      const response = await axios.get(
        `${API_URL}/users/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setClient(response.data.user || response.data);

      // Fetch client stats if available
      try {
        const statsResponse = await axios.get(
          `${API_URL}/users/${id}/stats`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setStats(statsResponse.data);
      } catch (err) {
        console.log('Stats not available');
      }
    } catch (error) {
      console.error('Error loading client profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load client profile',
        visibilityTime: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Client Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Client Profile',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text.primary,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.errorTitle}>Client Not Found</Text>
          <Text style={styles.errorText}>This client profile could not be loaded.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Client Profile',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text.primary,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <Image
            source={{ uri: client.avatar_url || DEFAULT_AVATAR }}
            style={styles.avatar}
            contentFit="cover"
          />
          <Text style={styles.name}>{client.full_name || client.username}</Text>
          {client.username && (
            <Text style={styles.username}>@{client.username}</Text>
          )}
          {client.bio && (
            <Text style={styles.bio}>{client.bio}</Text>
          )}
        </View>

        {/* Stats Section */}
        {stats && (
          <View style={styles.statsSection}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="briefcase-outline" size={24} color={colors.primary} />
                <Text style={styles.statValue}>{stats.total_commissions || 0}</Text>
                <Text style={styles.statLabel}>Commissions</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.status.success} />
                <Text style={styles.statValue}>{stats.completed_commissions || 0}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Client Information</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={20} color={colors.text.secondary} />
                <Text style={styles.infoLabel}>Member Since</Text>
              </View>
              <Text style={styles.infoValue}>
                {new Date(client.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>

            {client.location && (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="location-outline" size={20} color={colors.text.secondary} />
                  <Text style={styles.infoLabel}>Location</Text>
                </View>
                <Text style={styles.infoValue}>{client.location}</Text>
              </View>
            )}
          </View>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.md,
    borderWidth: 4,
    borderColor: colors.surface,
    ...shadows.medium,
  },
  name: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  username: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 16,
    marginBottom: spacing.sm,
  },
  bio: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  statsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  statValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 28,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
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
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
  },
  infoValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
});
