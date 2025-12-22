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
            {/* Commission Statistics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commission Statistics</Text>
              <View style={styles.metricsCard}>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {isArtist ? commissionStats.total : (clientStats?.total_commissions || 0)}
                    </Text>
                    <Text style={styles.statBoxLabel}>Total</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {isArtist ? commissionStats.pending : 0}
                    </Text>
                    <Text style={styles.statBoxLabel}>Pending</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {isArtist ? commissionStats.in_progress : (clientStats?.active_commissions || 0)}
                    </Text>
                    <Text style={styles.statBoxLabel}>Active</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {isArtist ? commissionStats.completed : (clientStats?.completed_commissions || 0)}
                    </Text>
                    <Text style={styles.statBoxLabel}>Completed</Text>
                  </View>
                </View>

                {/* Financial Stats */}
                {isArtist && commissionStats.totalRevenue > 0 && (
                  <View style={styles.financialStats}>
                    <View style={styles.financialStatRow}>
                      <Text style={styles.financialStatLabel}>Total Revenue</Text>
                      <Text style={styles.financialStatValue}>${commissionStats.totalRevenue.toFixed(2)}</Text>
                    </View>
                    <View style={styles.financialStatRow}>
                      <Text style={styles.financialStatLabel}>Average per Commission</Text>
                      <Text style={styles.financialStatValue}>
                        ${commissionStats.completed > 0
                          ? (commissionStats.totalRevenue / commissionStats.completed).toFixed(2)
                          : '0.00'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Engagement Analytics */}
            {engagementMetrics && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {isArtist ? 'Engagement Analytics' : 'My Activity'}
                </Text>
                <View style={styles.metricsCard}>
                  <View style={styles.statsGrid}>
                    {isArtist ? (
                      <>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{engagementMetrics.total_artworks || 0}</Text>
                          <Text style={styles.statBoxLabel}>Artworks</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>
                            {engagementMetrics.average_engagement_score?.toFixed(1) || '0.0'}
                          </Text>
                          <Text style={styles.statBoxLabel}>Avg Score</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{engagementMetrics.unique_artworks || 0}</Text>
                          <Text style={styles.statBoxLabel}>Artworks</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statBoxValue}>{engagementMetrics.unique_artists || 0}</Text>
                          <Text style={styles.statBoxLabel}>Artists</Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.engagementMetricsGrid}>
                    <View style={styles.engagementMetricItem}>
                      <Ionicons name="eye-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.engagementMetricLabel}>Views</Text>
                      <Text style={styles.engagementMetricValue}>{engagementMetrics.total_views || 0}</Text>
                    </View>
                    {isArtist && (
                      <View style={styles.engagementMetricItem}>
                        <Ionicons name="hand-left-outline" size={18} color={colors.text.secondary} />
                        <Text style={styles.engagementMetricLabel}>Clicks</Text>
                        <Text style={styles.engagementMetricValue}>{engagementMetrics.total_clicks || 0}</Text>
                      </View>
                    )}
                    <View style={styles.engagementMetricItem}>
                      <Ionicons name="heart-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.engagementMetricLabel}>Likes</Text>
                      <Text style={styles.engagementMetricValue}>{engagementMetrics.total_likes || 0}</Text>
                    </View>
                    <View style={styles.engagementMetricItem}>
                      <Ionicons name="bookmark-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.engagementMetricLabel}>Saves</Text>
                      <Text style={styles.engagementMetricValue}>{engagementMetrics.total_saves || 0}</Text>
                    </View>
                    {isArtist && (
                      <View style={styles.engagementMetricItem}>
                        <Ionicons name="share-social-outline" size={18} color={colors.text.secondary} />
                        <Text style={styles.engagementMetricLabel}>Shares</Text>
                        <Text style={styles.engagementMetricValue}>{engagementMetrics.total_shares || 0}</Text>
                      </View>
                    )}
                    <View style={styles.engagementMetricItem}>
                      <Ionicons name="mail-outline" size={18} color={colors.text.secondary} />
                      <Text style={styles.engagementMetricLabel}>Inquiries</Text>
                      <Text style={styles.engagementMetricValue}>
                        {engagementMetrics.total_commission_inquiries || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Top Artworks */}
                  {engagementMetrics.top_artworks && engagementMetrics.top_artworks.length > 0 && (
                    <View style={styles.topArtworksSection}>
                      <Text style={styles.topArtworksTitle}>
                        {isArtist ? 'Top Performing Artworks' : 'Most Engaged Artworks'}
                      </Text>
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
                          >
                            <Image
                              source={{ uri: artwork.image_url }}
                              style={styles.topArtworkImage}
                              contentFit="cover"
                            />
                            <View style={styles.topArtworkOverlay}>
                              <Text style={styles.topArtworkTitle} numberOfLines={1}>
                                {artwork.title || `#${index + 1}`}
                              </Text>
                              <View style={styles.topArtworkStats}>
                                {isArtist ? (
                                  <>
                                    <View style={styles.topArtworkStat}>
                                      <Ionicons name="eye" size={12} color="#fff" />
                                      <Text style={styles.topArtworkStatText}>{artwork.total_views || 0}</Text>
                                    </View>
                                    <View style={styles.topArtworkStat}>
                                      <Ionicons name="bookmark" size={12} color="#fff" />
                                      <Text style={styles.topArtworkStatText}>{artwork.total_saves || 0}</Text>
                                    </View>
                                  </>
                                ) : (
                                  <View style={styles.topArtworkStat}>
                                    <Ionicons name="heart" size={12} color="#fff" />
                                    <Text style={styles.topArtworkStatText}>{artwork.engagement_count || 0}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
  },
  content: {
    flex: 1,
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
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 18 : 20,
    fontWeight: '700',
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  metricsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border + '40',
    ...shadows.small,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '20',
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
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
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
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '20',
  },
  topArtworksTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    fontWeight: '600',
    marginBottom: spacing.md,
    letterSpacing: -0.2,
  },
  topArtworksScroll: {
    gap: spacing.md,
  },
  topArtworkCard: {
    width: width * 0.4,
    height: width * 0.5,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
    ...shadows.small,
  },
  topArtworkImage: {
    width: '100%',
    height: '100%',
  },
  topArtworkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.sm,
  },
  topArtworkTitle: {
    ...typography.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  topArtworkStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  topArtworkStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  topArtworkStatText: {
    ...typography.caption,
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
});
