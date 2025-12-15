import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';
import ReviewCard from './ReviewCard';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ReviewsSection({ artistId, isArtistView = false }) {
  const { token, user } = useAuthStore();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'verified'
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, [artistId, filter]);

  const fetchReviews = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/review-enhancements/artist/${artistId}/with-responses`,
        {
          params: {
            verified_only: filter === 'verified',
            limit: 50,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setReviews(response.data.data.reviews || []);
      setStats(response.data.data.stats || null);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load reviews',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const handleReviewUpdate = () => {
    fetchReviews();
  };

  const renderReview = ({ item }) => (
    <ReviewCard
      review={item}
      isArtist={isArtistView && user?.artists?.id === artistId}
      onUpdate={handleReviewUpdate}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.primaryStat}>
            <View style={styles.ratingIconContainer}>
              <Ionicons name="star" size={28} color={colors.status.warning} />
            </View>
            <View>
              <Text style={styles.primaryStatValue}>{stats.averageRating || '0.0'}</Text>
              <Text style={styles.primaryStatLabel}>Average Rating</Text>
            </View>
          </View>
          
          <View style={styles.secondaryStats}>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatValue}>{stats.totalReviews || 0}</Text>
              <Text style={styles.secondaryStatLabel}>Reviews</Text>
            </View>
            <View style={styles.secondaryStatItem}>
              <Text style={styles.secondaryStatValue}>{stats.verifiedReviews || 0}</Text>
              <Text style={styles.secondaryStatLabel}>Verified</Text>
            </View>
            {stats.responseRate != null && (
              <View style={styles.secondaryStatItem}>
                <Text style={styles.secondaryStatValue}>{stats.responseRate}%</Text>
                <Text style={styles.secondaryStatLabel}>Response</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Pinterest-style Filter Bar */}
      <View style={styles.pinterestFilterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pinterestFilterContent}
        >
          <TouchableOpacity
            style={styles.pinterestFilterItem}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.pinterestFilterText, filter === 'all' && styles.pinterestFilterTextActive]}>
              All Reviews
            </Text>
            {filter === 'all' && <View style={styles.pinterestFilterUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pinterestFilterItem}
            onPress={() => setFilter('verified')}
            activeOpacity={0.7}
          >
            <Text style={[styles.pinterestFilterText, filter === 'verified' && styles.pinterestFilterTextActive]}>
              Verified Only
            </Text>
            {filter === 'verified' && <View style={styles.pinterestFilterUnderline} />}
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyText}>No reviews yet</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'verified' ? 'No verified reviews' : 'Be the first to review this artist'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          renderItem={renderReview}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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
    paddingVertical: spacing.xxl,
  },
  statsContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: 0,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border + '80',
    gap: spacing.md,
  },
  primaryStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '60',
  },
  ratingIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryStatValue: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
  },
  primaryStatLabel: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  secondaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.sm,
  },
  secondaryStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryStatValue: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },
  secondaryStatLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  pinterestFilterBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  pinterestFilterContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  pinterestFilterItem: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  pinterestFilterText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '600',
  },
  pinterestFilterTextActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  pinterestFilterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.text.disabled,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});










