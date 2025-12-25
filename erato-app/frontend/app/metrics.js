import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import axios from 'axios';
import { useAuthStore, useProfileStore } from '../store';
import { colors, spacing, typography, borderRadius, shadows } from '../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;

export default function MetricsScreen() {
  const { token, user } = useAuthStore();
  const { profile } = useProfileStore();
  const [refreshing, setRefreshing] = useState(false);
  const [engagementMetrics, setEngagementMetrics] = useState(null);
  const [loadingEngagement, setLoadingEngagement] = useState(false);
  const [commissionStats, setCommissionStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    totalRevenue: 0
  });
  const [clientStats, setClientStats] = useState(null);

  const isArtist = profile?.artist !== null && profile?.artist !== undefined;

  // Load commission stats for artists
  const loadCommissionStats = useCallback(async () => {
    if (!user?.id || !token) return;

    if (!isArtist) return;

    try {
      const response = await axios.get(
        `${API_URL}/commissions?artist_id=${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const commissions = response.data.commissions || [];
      const stats = {
        total: commissions.length,
        pending: commissions.filter(c => c.status === 'pending').length,
        in_progress: commissions.filter(c => c.status === 'in_progress' || c.status === 'accepted').length,
        completed: commissions.filter(c => c.status === 'completed').length,
        totalRevenue: commissions
          .filter(c => c.status === 'completed' && c.final_price)
          .reduce((sum, c) => sum + parseFloat(c.final_price || 0), 0),
      };
      setCommissionStats(stats);
    } catch (error) {
      console.log('Error loading commission stats:', error);
    }
  }, [user?.id, token, isArtist]);

  // Load client stats
  const loadClientStats = useCallback(async () => {
    if (!user?.id || !token || isArtist) return;

    try {
      const statsResponse = await axios.get(
        `${API_URL}/users/${user.id}/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClientStats(statsResponse.data);
    } catch (error) {
      console.log('Error loading client stats:', error);
    }
  }, [user?.id, token, isArtist]);

  // Load engagement metrics
  const loadEngagementMetrics = useCallback(async () => {
    if (!token || !user?.id) return;

    setLoadingEngagement(true);
    try {
      if (isArtist) {
        // Get the artist.id from the artists table using user_id
        const artistResponse = await axios.get(
          `${API_URL}/artists?user_id=${user.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const artists = artistResponse.data?.artists || artistResponse.data || [];
        if (artists.length === 0) {
          setLoadingEngagement(false);
          return;
        }

        const artistId = artists[0].id || artists[0].user_id;
        if (!artistId) {
          setLoadingEngagement(false);
          return;
        }

        // Fetch engagement metrics using the artistId
        const response = await axios.get(
          `${API_URL}/engagement/artist/${artistId}/metrics`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data?.success && response.data?.data) {
          const metrics = response.data.data;
          setEngagementMetrics({
            total_artworks: metrics.total_artworks || 0,
            total_views: metrics.total_views || 0,
            total_clicks: metrics.total_clicks || 0,
            total_likes: metrics.total_likes || 0,
            total_saves: metrics.total_saves || 0,
            total_shares: metrics.total_shares || 0,
            total_commission_inquiries: metrics.total_commission_inquiries || 0,
            average_engagement_score: metrics.average_engagement_score || 0,
            top_artworks: metrics.top_artworks || [],
          });
        }
      } else {
        // Client engagement metrics
        const response = await axios.get(
          `${API_URL}/engagement/user/${user.id}/metrics`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data?.success && response.data?.data) {
          const metrics = response.data.data;
          setEngagementMetrics({
            unique_artworks: metrics.unique_artworks || 0,
            unique_artists: metrics.unique_artists || 0,
            total_views: metrics.total_views || 0,
            total_likes: metrics.total_likes || 0,
            total_saves: metrics.total_saves || 0,
            total_commission_inquiries: metrics.total_commission_inquiries || 0,
            top_artworks: metrics.top_artworks || [],
          });
        }
      }
    } catch (error) {
      console.log('Error loading engagement metrics:', error);
    } finally {
      setLoadingEngagement(false);
    }
  }, [user?.id, token, isArtist]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadCommissionStats(),
      loadClientStats(),
      loadEngagementMetrics(),
    ]);
    setRefreshing(false);
  }, [loadCommissionStats, loadClientStats, loadEngagementMetrics]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadCommissionStats();
        loadClientStats();
        loadEngagementMetrics();
      }
    }, [user?.id, loadCommissionStats, loadClientStats, loadEngagementMetrics])
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Metrics</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {loadingEngagement && !engagementMetrics ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading metrics...</Text>
          </View>
        ) : (
          <>
            {/* Overview Stats */}
            <View style={styles.overviewSection}>
              <Text style={styles.overviewTitle}>Overview</Text>
              <View style={styles.overviewGrid}>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewCardValue}>
                    {isArtist ? commissionStats.total : (clientStats?.total_commissions || 0)}
                  </Text>
                  <Text style={styles.overviewCardLabel}>Commissions</Text>
                </View>

                {isArtist && commissionStats.totalRevenue > 0 && (
                  <View style={styles.overviewCard}>
                    <Text style={styles.overviewCardValue}>${commissionStats.totalRevenue.toFixed(0)}</Text>
                    <Text style={styles.overviewCardLabel}>Revenue</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Status Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commission Status</Text>
              <View style={styles.statusList}>
                <View style={styles.statusRow}>
                  <View style={styles.statusLabelContainer}>
                    <View style={[styles.statusDot, { backgroundColor: colors.status.warning }]} />
                    <Text style={styles.statusLabel}>Pending</Text>
                  </View>
                  <Text style={[styles.statusValue, { color: colors.status.warning }]}>
                    {isArtist ? commissionStats.pending : 0}
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.statusLabelContainer}>
                    <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                    <Text style={styles.statusLabel}>In Progress</Text>
                  </View>
                  <Text style={[styles.statusValue, { color: colors.primary }]}>
                    {isArtist ? commissionStats.in_progress : (clientStats?.active_commissions || 0)}
                  </Text>
                </View>

                <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.statusLabelContainer}>
                    <View style={[styles.statusDot, { backgroundColor: colors.status.success }]} />
                    <Text style={styles.statusLabel}>Completed</Text>
                  </View>
                  <Text style={[styles.statusValue, { color: colors.status.success }]}>
                    {isArtist ? commissionStats.completed : (clientStats?.completed_commissions || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Engagement Analytics */}
            {engagementMetrics && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Engagement</Text>
                <View style={styles.engagementGrid}>
                  <View style={styles.engagementCard}>
                    <View style={styles.engagementIconCircle}>
                      <Ionicons name="eye-outline" size={24} color={colors.primary} />
                    </View>
                    <Text style={styles.engagementCardValue}>{engagementMetrics.total_views || 0}</Text>
                    <Text style={styles.engagementCardLabel}>Views</Text>
                  </View>
                  <View style={styles.engagementCard}>
                    <View style={styles.engagementIconCircle}>
                      <Ionicons name="heart-outline" size={24} color={colors.error} />
                    </View>
                    <Text style={styles.engagementCardValue}>{engagementMetrics.total_likes || 0}</Text>
                    <Text style={styles.engagementCardLabel}>Likes</Text>
                  </View>
                </View>
                <View style={styles.engagementGrid}>
                  <View style={styles.engagementCard}>
                    <View style={styles.engagementIconCircle}>
                      <Ionicons name="bookmark-outline" size={24} color={colors.status.warning} />
                    </View>
                    <Text style={styles.engagementCardValue}>{engagementMetrics.total_saves || 0}</Text>
                    <Text style={styles.engagementCardLabel}>Saves</Text>
                  </View>
                  {isArtist && (
                    <View style={styles.engagementCard}>
                      <View style={styles.engagementIconCircle}>
                        <Ionicons name="mail-outline" size={24} color={colors.status.success} />
                      </View>
                      <Text style={styles.engagementCardValue}>
                        {engagementMetrics.total_commission_inquiries || 0}
                      </Text>
                      <Text style={styles.engagementCardLabel}>Inquiries</Text>
                    </View>
                  )}
                </View>

                {isArtist && (
                  <View style={styles.portfolioStats}>
                    <View style={styles.portfolioStatCard}>
                      <Text style={styles.portfolioStatLabel}>Artworks</Text>
                      <Text style={styles.portfolioStatValue}>{engagementMetrics.total_artworks || 0}</Text>
                    </View>
                    <View style={styles.portfolioStatCard}>
                      <Text style={styles.portfolioStatLabel}>Engagement</Text>
                      <Text style={styles.portfolioStatValue}>
                        {engagementMetrics.average_engagement_score?.toFixed(1) || '0.0'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Top Artworks - Pinterest Style */}
                {engagementMetrics.top_artworks && engagementMetrics.top_artworks.length > 0 && (
                  <View style={styles.topArtworksSection}>
                    <Text style={styles.topArtworksTitle}>Top Artworks</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.topArtworksScroll}
                    >
                      {engagementMetrics.top_artworks.slice(0, 5).map((artwork, index) => (
                        <TouchableOpacity
                          key={artwork.artwork_id || index}
                          style={styles.topArtworkCard}
                          onPress={() => router.push(`/artwork/${artwork.artwork_id}`)}
                          activeOpacity={0.95}
                        >
                          <Image
                            source={{ uri: artwork.image_url }}
                            style={styles.topArtworkImage}
                            contentFit="cover"
                          />
                          <View style={styles.topArtworkBadge}>
                            <Text style={styles.topArtworkBadgeText}>#{index + 1}</Text>
                          </View>
                          <View style={styles.topArtworkInfo}>
                            <Text style={styles.topArtworkInfoTitle} numberOfLines={1}>
                              {artwork.title || 'Untitled'}
                            </Text>
                            <View style={styles.topArtworkMetrics}>
                              <View style={styles.topArtworkMetricItem}>
                                <Ionicons name="eye" size={14} color={colors.text.secondary} />
                                <Text style={styles.topArtworkMetricText}>{artwork.total_views || 0}</Text>
                              </View>
                              <View style={styles.topArtworkMetricItem}>
                                <Ionicons name="heart" size={14} color={colors.error} />
                                <Text style={styles.topArtworkMetricText}>{artwork.total_likes || 0}</Text>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </>
        )}
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
    paddingTop: Constants.statusBarHeight + spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl + spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '700',
    marginBottom: spacing.lg + spacing.sm,
    letterSpacing: -0.3,
  },
  metricsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg + spacing.sm,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statBoxValue: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 24,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  statBoxLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  financialStats: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '10',
  },
  financialStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  financialStatLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '500',
  },
  financialStatValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  engagementMetricsGrid: {
    gap: spacing.sm,
  },
  engagementMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  engagementMetricLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    flex: 1,
    marginLeft: spacing.sm,
  },
  engagementMetricValue: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '700',
  },
  topArtworksSection: {
    marginTop: spacing.xl + spacing.lg,
    paddingTop: spacing.xl,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  topArtworksTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    fontWeight: '700',
    marginBottom: spacing.lg + spacing.sm,
    letterSpacing: -0.3,
  },
  topArtworksScroll: {
    gap: spacing.lg,
    paddingRight: spacing.xl,
  },
  topArtworkCard: {
    width: width * 0.5,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  topArtworkImage: {
    width: '100%',
    height: width * 0.62,
  },
  topArtworkBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  topArtworkBadgeText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  topArtworkInfo: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  topArtworkInfoTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs + 2,
    letterSpacing: -0.2,
  },
  topArtworkMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  topArtworkMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  topArtworkMetricText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  // New Modern Styles
  overviewSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  overviewTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    fontWeight: '700',
    marginBottom: spacing.lg + spacing.sm,
    letterSpacing: -0.3,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    paddingVertical: spacing.xl + spacing.sm,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'visible',
  },
  overviewCardValue: {
    ...typography.h1,
    fontSize: IS_SMALL_SCREEN ? 36 : 44,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: -1.2,
    lineHeight: IS_SMALL_SCREEN ? 44 : 52,
  },
  overviewCardLabel: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.2,
  },
  statusList: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '08',
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  statusValue: {
    ...typography.h3,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  engagementGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  engagementCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl + spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    minHeight: 140,
  },
  engagementIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  engagementCardValue: {
    ...typography.h2,
    fontSize: IS_SMALL_SCREEN ? 28 : 32,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.8,
  },
  engagementCardLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  portfolioStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  portfolioStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg + spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    alignItems: 'center',
  },
  portfolioStatLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  portfolioStatValue: {
    ...typography.h2,
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
});
