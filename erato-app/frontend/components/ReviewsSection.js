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
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.averageRating}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalReviews}</Text>
            <Text style={styles.statLabel}>Total Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.verifiedReviews}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          {stats.responseRate && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.responseRate}%</Text>
                <Text style={styles.statLabel}>Response Rate</Text>
              </View>
            </>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  pinterestFilterBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
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
