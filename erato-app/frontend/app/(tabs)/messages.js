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

  const renderConversation = ({ item }) => {
    const hasUnread = item.unread_count > 0;
    const isCommissionRequest = item.commissions?.status === 'pending' &&
                                item.commissions?.artist_id === user?.id;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => router.push(`/messages/${item.id}`)}
      >
        <Image
          source={{ uri: item.other_participant?.avatar_url }}
          style={styles.avatar}
          contentFit="cover"
        />

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.name, hasUnread && styles.nameUnread]}>
              {getConversationTitle(item)}
            </Text>
            {item.latest_message && (
              <Text style={styles.time}>
                {formatTime(item.latest_message.created_at)}
              </Text>
            )}
          </View>

          <View style={styles.messageRow}>
            <Text
              style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
              numberOfLines={1}
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
            <View style={styles.actionRow}>
              <Text style={styles.requestLabel}>
                <Ionicons name="mail" size={14} color={colors.primary} />
                {' '}New Commission Request
              </Text>
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
    paddingVertical: spacing.sm,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  messagePreviewUnread: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginLeft: spacing.sm,
  },
  unreadText: {
    ...typography.small,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 11,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  requestLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
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
