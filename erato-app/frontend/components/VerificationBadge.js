import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

const BADGE_CONFIG = {
  portfolio: {
    name: 'Portfolio Verified',
    icon: 'shield-checkmark',
    color: '#3B82F6',
    description: 'Artist has proven ownership of their portfolio',
  },
  payment: {
    name: 'Payment Verified',
    icon: 'card',
    color: '#10B981',
    description: '5+ completed commissions, 4+ star average',
  },
  identity: {
    name: 'Identity Verified',
    icon: 'person-check',
    color: '#8B5CF6',
    description: 'Identity verified with Erato',
  },
};

export default function VerificationBadge({ type, size = 'medium', showTooltip = false, onPress }) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const sizeConfig = {
    small: { icon: 12, fontSize: 10, padding: spacing.xs },
    medium: { icon: 16, fontSize: 12, padding: spacing.sm },
    large: { icon: 20, fontSize: 14, padding: spacing.md },
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  const BadgeContent = (
    <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
      <Ionicons name={config.icon} size={currentSize.icon} color={config.color} />
      {size !== 'small' && (
        <Text style={[styles.badgeText, { color: config.color, fontSize: currentSize.fontSize }]}>
          {config.name}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {BadgeContent}
      </TouchableOpacity>
    );
  }

  return BadgeContent;
}

export function VerificationBadges({ artist, size = 'medium', onBadgePress }) {
  if (!artist) return null;

  const badges = [];
  if (artist.verified && artist.verification_type) {
    badges.push(artist.verification_type);
  }

  // Check payment verification eligibility
  // This would typically come from the API, but we can infer from stats
  // For now, we'll just show the verified badge

  if (badges.length === 0) return null;

  return (
    <View style={styles.badgesContainer}>
      {badges.map((type) => (
        <VerificationBadge
          key={type}
          type={type}
          size={size}
          onPress={onBadgePress ? () => onBadgePress(type) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});







