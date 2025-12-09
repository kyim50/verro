import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

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
      // Filter out conversations that are commission requests (they go to Library now)
      const allConversations = response.data.conversations || [];
      // Only show conversations that are NOT commission requests
      const regularConversations = allConversations.filter(conv => {
        // If conversation has a commission_id and commission status is pending, hide it from messages
        if (conv.commissions) {
          return conv.commissions.status !== 'pending';
        }
        return true; // Show conversations without commission association
      });
      setConversations(regularConversations);
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

  const handleDeleteConversation = (conversationId) => {
    Alert.alert(
      'Delete Conversation',
      'Hold to confirm deleting this conversation. This will remove all messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_URL}/messages/conversations/${conversationId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              await fetchConversations();
            } catch (error) {
              console.error('Error deleting conversation:', error);
              const msg = error.response?.data?.error || 'Failed to delete conversation';
              Alert.alert('Error', msg);
            }
          },
        },
      ]
    );
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
    const isOnline = isUserOnline(item.other_participant);

    return (
            <TouchableOpacity
              style={styles.conversationCard}
              onPress={() => router.push(`/messages/${item.id}`)}
              onLongPress={() => handleDeleteConversation(item.id)}
              activeOpacity={0.7}
            >
        <View style={styles.cardContent}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: item.other_participant?.avatar_url || DEFAULT_AVATAR }}
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

            <Text
              style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
              numberOfLines={2}
            >
              {getMessagePreview(item)}
            </Text>
          </View>

          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
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
            Start a conversation by messaging an artist or client
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    paddingTop: IS_SMALL_SCREEN ? Constants.statusBarHeight + spacing.sm : Constants.statusBarHeight + spacing.md,
    paddingBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 22 : 24,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  conversationCard: {
    marginHorizontal: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    marginBottom: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.small,
  },
  cardContent: {
    flexDirection: 'row',
    padding: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: IS_SMALL_SCREEN ? spacing.sm : spacing.md,
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 44 : 48,
    height: IS_SMALL_SCREEN ? 44 : 48,
    borderRadius: IS_SMALL_SCREEN ? 22 : 24,
    backgroundColor: colors.background,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 1,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
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
  messagePreview: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 16,
    marginTop: 1,
  },
  messagePreviewUnread: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  unreadText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
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
