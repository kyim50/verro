import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function MessagesScreen() {
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && token) {
      fetchConversations();
    }
  }, [user, token]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString();
  };

  const getMessagePreview = (conv) => {
    if (!conv.latest_message) {
      if (conv.commissions) {
        return 'Commission request';
      }
      return 'No messages yet';
    }

    if (conv.latest_message.message_type === 'commission_request') {
      return 'Commission request';
    }

    if (conv.latest_message.message_type === 'commission_update') {
      return 'Commission status updated';
    }

    return conv.latest_message.content;
  };

  const getConversationTitle = (conv) => {
    if (conv.other_participant) {
      return conv.other_participant.full_name || conv.other_participant.username;
    }
    return 'Unknown User';
  };

  const isUserOnline = (participant) => {
    if (!participant || !participant.last_seen) return false;
    const lastSeen = new Date(participant.last_seen);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / 1000 / 60;
    return diffMinutes < 5;
  };

  const renderConversation = ({ item }) => {
    const hasUnread = item.unread_count > 0;
    const isCommissionRequest = item.commissions?.status === 'pending' &&
                                item.commissions?.artist_id === user?.id;
    const isOnline = isUserOnline(item.other_participant);

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/messages/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.other_participant?.avatar_url || 'https://via.placeholder.com/56' }}
            style={styles.avatar}
            contentFit="cover"
          />
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
              {getConversationTitle(item)}
            </Text>
            {item.latest_message && (
              <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                {formatTime(item.latest_message.created_at)}
              </Text>
            )}
          </View>

          <View style={styles.messageRow}>
            <Text
              style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
              numberOfLines={2}
            >
              {getMessagePreview(item)}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>

          {isCommissionRequest && (
            <View style={styles.commissionBadge}>
              <Ionicons name="briefcase" size={12} color={colors.primary} />
              <Text style={styles.commissionBadgeText}>New Request</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity>
          <Ionicons name="create-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a conversation by requesting a commission from an artist
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  listContent: {
    paddingTop: spacing.xs,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  messagePreview: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  messagePreviewUnread: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginTop: 2,
  },
  unreadText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  commissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.sm,
  },
  commissionBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
