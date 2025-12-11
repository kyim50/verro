import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import { useAuthStore } from '../store';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

const VERIFICATION_TYPES = [
  {
    id: 'portfolio',
    name: 'Portfolio Verified',
    icon: 'shield-checkmark',
    color: '#3B82F6',
    description: 'Prove ownership of your portfolio',
  },
  {
    id: 'payment',
    name: 'Payment Verified',
    icon: 'card',
    color: '#10B981',
    description: 'Complete 5+ commissions with 4+ star average',
  },
  {
    id: 'identity',
    name: 'Identity Verified',
    icon: 'person-check',
    color: '#8B5CF6',
    description: 'Verify your identity with Erato',
  },
];

export default function VerificationProgress({ artistId, onVerifyPress }) {
  const { token } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [artistId]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/verification/stats/${artistId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching verification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!stats) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verification Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {VERIFICATION_TYPES.map((type) => {
          const isCompleted = stats.progress?.[type.id] || false;
          const isEligible = type.id === 'payment' 
            ? stats.stats?.eligibleForPaymentBadge 
            : true;

          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.card,
                isCompleted && styles.cardCompleted,
                !isEligible && styles.cardDisabled,
              ]}
              onPress={() => onVerifyPress && onVerifyPress(type.id)}
              disabled={!isEligible || isCompleted}
            >
              <View style={[styles.iconContainer, { backgroundColor: type.color + '20' }]}>
                <Ionicons
                  name={isCompleted ? type.icon : `${type.icon}-outline`}
                  size={32}
                  color={isCompleted ? type.color : colors.text.secondary}
                />
              </View>
              <Text style={[styles.cardTitle, isCompleted && styles.cardTitleCompleted]}>
                {type.name}
              </Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {type.description}
              </Text>
              {isCompleted ? (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={type.color} />
                  <Text style={[styles.completedText, { color: type.color }]}>Verified</Text>
                </View>
              ) : type.id === 'payment' && stats.stats ? (
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {stats.stats.completedCommissions || 0}/5 commissions
                  </Text>
                  <Text style={styles.progressText}>
                    {stats.stats.averageRating || '0.0'}/4.0 rating
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.verifyButton, { borderColor: type.color }]}
                  onPress={() => onVerifyPress && onVerifyPress(type.id)}
                >
                  <Text style={[styles.verifyButtonText, { color: type.color }]}>
                    Verify
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  scrollView: {
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  card: {
    width: 200,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompleted: {
    borderColor: colors.status.success,
    borderWidth: 2,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardTitleCompleted: {
    color: colors.status.success,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    minHeight: 32,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  completedText: {
    ...typography.caption,
    fontWeight: '600',
  },
  progressInfo: {
    marginTop: spacing.xs,
  },
  progressText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  verifyButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  verifyButtonText: {
    ...typography.bodyBold,
    fontSize: 12,
  },
});
