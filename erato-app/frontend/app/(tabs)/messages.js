import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR, components } from '../../constants/theme';
import { initSocket, getSocket } from '../../lib/socket';
import { showAlert } from '../../components/StyledAlert';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false); // Start as false to allow immediate render
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'commissions'
  const socketRef = useRef(null);
  
  // Artist search state
  const [showArtistSearch, setShowArtistSearch] = useState(false);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [artistSearchResults, setArtistSearchResults] = useState([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const searchTimeoutRef = useRef(null);
  const isArtistUser = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));

  const fetchConversations = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Show all conversations, including commission-linked ones so new requests appear immediately
      const allConversations = response.data.conversations || [];
      setConversations(allConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Initialize Socket.io for real-time conversation updates
  useEffect(() => {
    if (!token) return;

    const socket = initSocket(token);
    socketRef.current = socket;

    // Join all conversation rooms when socket connects
    socket.on('connect', () => {
      console.log('Socket connected in conversations list');
    });

    // Listen for new messages to update conversation list
    socket.on('new-message', (message) => {
      setConversations(prev => {
        // Find if this conversation exists in the list
        const conversationIndex = prev.findIndex(conv => conv.id === message.conversation_id);
        
        if (conversationIndex === -1) {
          // Conversation doesn't exist yet, fetch full list
          setTimeout(() => {
            fetchConversations();
          }, 0);
          return prev;
        }

        const conversation = prev[conversationIndex];
        const isFromCurrentUser = message.sender_id === user?.id;
        
        // Create updated conversation
        const updatedConversation = {
          ...conversation,
          latest_message: {
            ...message,
            content: message.message_type === 'image' ? 'Sent an image' : message.content,
          },
          // Update unread count if message is from other user
          unread_count: isFromCurrentUser 
            ? conversation.unread_count 
            : (conversation.unread_count || 0) + 1,
        };

        // Move conversation to top and update it
        const newConversations = [...prev];
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(updatedConversation);

        return newConversations;
      });
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.off('new-message');
        socket.off('connect');
      }
    };
  }, [token, user, fetchConversations]);

  // Load conversations immediately on mount
  useEffect(() => {
    if (user && token) {
      // Always fetch on mount, but don't show loading if we already have data
      if (conversations.length === 0) {
        setLoading(true);
      }
      fetchConversations();
    } else {
      setLoading(false);
    }
  }, [user, token]); // Only run when user/token changes

  // Refresh conversations when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        // Always refresh on focus, but don't show loading spinner if we have data
        const hasData = conversations.length > 0;
        if (!hasData) {
          setLoading(true);
        }
        fetchConversations().finally(() => {
          if (!hasData) {
            setLoading(false);
          }
        });
      }
    }, [user, token, conversations.length])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
  };

  const handleDeleteConversation = (conversationId) => {
    showAlert({
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation? This will remove all messages.',
      type: 'warning',
      buttons: [
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
              Toast.show({
                type: 'success',
                text1: 'Deleted',
                text2: 'Conversation deleted successfully',
                visibilityTime: 2000,
              });
            } catch (error) {
              console.error('Error deleting conversation:', error);
              const msg = error.response?.data?.error || 'Failed to delete conversation';
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: msg,
                visibilityTime: 3000,
              });
            }
          },
        },
      ],
    });
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

  // Filter conversations based on active tab - memoized for performance
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (activeTab === 'unread') {
        return conv.unread_count > 0;
      }
      if (activeTab === 'commissions') {
        return conv.commissions && conv.commissions.length > 0;
      }
      return true; // 'all'
    });
  }, [conversations, activeTab]);

  // Get counts for tabs
  const unreadCount = conversations.filter(c => c.unread_count > 0).length;
  const commissionCount = conversations.filter(c => c.commissions && c.commissions.length > 0).length;

  // Get artists the client has chatted with before
  // For clients, we need to check which conversations have artists as the other participant
  // We'll fetch this from the backend by checking if the other participant has an artist profile
  const [chattedArtistIds, setChattedArtistIds] = useState(new Set());
  
  useEffect(() => {
    if (isArtistUser || !token || conversations.length === 0) {
      setChattedArtistIds(new Set());
      return;
    }

    // Extract unique participant IDs from conversations
    const participantIds = conversations
      .map(conv => conv.other_participant?.id)
      .filter(Boolean);

    if (participantIds.length === 0) {
      setChattedArtistIds(new Set());
      return;
    }

    // Check which participants are artists
    const checkArtists = async () => {
      try {
        const response = await axios.get(`${API_URL}/artists`, {
          params: {
            limit: 100,
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const allArtists = response.data.artists || [];
        const artistIds = new Set(allArtists.map(a => a.id));
        
        // Filter participant IDs to only include those who are artists
        const chattedArtists = participantIds.filter(id => artistIds.has(id));
        setChattedArtistIds(new Set(chattedArtists));
      } catch (error) {
        console.error('Error checking artists:', error);
        // On error, allow all participants (backend will handle restriction)
        setChattedArtistIds(new Set(participantIds));
      }
    };

    checkArtists();
  }, [conversations, isArtistUser, token]);

  // Search artists
  useEffect(() => {
    if (!showArtistSearch) {
      setArtistSearchQuery('');
      setArtistSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (artistSearchQuery.trim().length < 2) {
      setArtistSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setArtistSearchLoading(true);
      try {
        const params = {
          search: artistSearchQuery.trim(),
          limit: 20,
        };
        
        const response = await axios.get(`${API_URL}/artists`, {
          params,
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        let artists = response.data.artists || [];
        
        // For clients, filter to only artists they've chatted with
        if (!isArtistUser) {
          const chattedIds = Array.from(chattedArtistIds);
          if (chattedIds.length === 0) {
            setArtistSearchResults([]);
            setArtistSearchLoading(false);
            return;
          }
          artists = artists.filter(artist => chattedIds.includes(artist.id));
        }
        
        setArtistSearchResults(artists);
      } catch (error) {
        console.error('Error searching artists:', error);
        setArtistSearchResults([]);
      } finally {
        setArtistSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [artistSearchQuery, showArtistSearch, token, isArtistUser, chattedArtistIds]);

  // Create conversation with selected artist
  const handleSelectArtist = async (artist) => {
    try {
      setArtistSearchLoading(true);
      
      // Create or get conversation
      const response = await axios.post(
        `${API_URL}/messages/conversations`,
        { participant_id: artist.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const conversation = response.data.conversation;
      
      // Close search modal
      setShowArtistSearch(false);
      setArtistSearchQuery('');
      setArtistSearchResults([]);
      
      // Navigate to conversation
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      const errorMsg = error.response?.data?.error || 'Failed to start conversation';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMsg,
        visibilityTime: 3000,
      });
    } finally {
      setArtistSearchLoading(false);
    }
  };

  const renderConversation = React.useCallback(({ item }) => {
    const hasUnread = item.unread_count > 0;
    const isOnline = isUserOnline(item.other_participant);
    const hasCommission = item.commissions && item.commissions.length > 0;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, hasUnread && styles.conversationCardUnread]}
        onPress={() => {
          // Optimistically clear unread count locally when opening
          setConversations((prev) =>
            prev.map((c) =>
              c.id === item.id ? { ...c, unread_count: 0 } : c
            )
          );
          router.push(`/messages/${item.id}`);
        }}
        onLongPress={() => handleDeleteConversation(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: item.other_participant?.avatar_url || DEFAULT_AVATAR }}
                style={styles.avatar}
                contentFit="cover"
              />
              {isOnline && (
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                </View>
              )}
              {hasCommission && (
                <View style={styles.commissionBadge}>
                  <Ionicons name="pricetag" size={12} color={colors.primary} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameContainer}>
                <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
                  {getConversationTitle(item)}
                </Text>
                {hasCommission && (
                  <Ionicons name="pricetag" size={14} color={colors.primary} style={{ marginLeft: spacing.xs }} />
                )}
              </View>
              {item.latest_message && (
                <View style={styles.timeContainer}>
                  <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                    {formatTime(item.latest_message.created_at)}
                  </Text>
                </View>
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
                  <Text style={styles.unreadCount}>
                    {item.unread_count > 99 ? '99+' : item.unread_count}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Header - Always render */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowArtistSearch(true)}
          >
            <Ionicons name="create-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All
            </Text>
            {conversations.length > 0 && (
              <View style={[styles.tabBadge, activeTab === 'all' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'all' && styles.tabBadgeTextActive]}>
                  {conversations.length}
                </Text>
              </View>
            )}
            {activeTab === 'all' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('unread')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'unread' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'unread' && styles.tabBadgeTextActive]}>
                  {unreadCount}
                </Text>
              </View>
            )}
            {activeTab === 'unread' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => setActiveTab('commissions')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'commissions' && styles.tabTextActive]}>
              Commissions
            </Text>
            {commissionCount > 0 && (
              <View style={[styles.tabBadge, activeTab === 'commissions' && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === 'commissions' && styles.tabBadgeTextActive]}>
                  {commissionCount}
                </Text>
              </View>
            )}
            {activeTab === 'commissions' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        })}
        contentContainerStyle={[
          styles.listContent,
          filteredConversations.length === 0 && styles.emptyStateContainer,
          { paddingBottom: Math.max(insets.bottom, 20) + 80 }
        ]}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'unread' ? 'mail-outline' : activeTab === 'commissions' ? 'document-text-outline' : 'chatbubbles-outline'} 
                size={64} 
                color={colors.text.disabled} 
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'unread' ? 'No unread messages' : activeTab === 'commissions' ? 'No commission conversations' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'unread' 
                  ? 'All caught up! You have no unread messages.' 
                  : activeTab === 'commissions'
                  ? 'No conversations linked to commissions yet'
                  : 'Start a conversation by messaging an artist or client'}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            enabled={true}
          />
        }
      />

      {/* Artist Search Modal */}
      <Modal
        visible={showArtistSearch}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setShowArtistSearch(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowArtistSearch(false);
                setArtistSearchQuery('');
                setArtistSearchResults([]);
              }}
            >
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {isArtistUser ? 'Search Artists' : 'Message Artist'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={isArtistUser ? "Search artists..." : "Search artists you've chatted with..."}
              placeholderTextColor={colors.text.disabled}
              value={artistSearchQuery}
              onChangeText={setArtistSearchQuery}
              autoFocus
            />
            {artistSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setArtistSearchQuery('');
                  setArtistSearchResults([]);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results */}
          {artistSearchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : artistSearchResults.length > 0 ? (
            <FlatList
              data={artistSearchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const artistUser = item.users || item;
                return (
                  <TouchableOpacity
                    style={styles.artistResultCard}
                    onPress={() => handleSelectArtist(artistUser)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: artistUser.avatar_url || DEFAULT_AVATAR }}
                      style={styles.artistResultAvatar}
                      contentFit="cover"
                    />
                    <View style={styles.artistResultInfo}>
                      <Text style={styles.artistResultName} numberOfLines={1}>
                        {artistUser.full_name || artistUser.username}
                      </Text>
                      <Text style={styles.artistResultUsername} numberOfLines={1}>
                        @{artistUser.username}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={styles.searchResultsContent}
            />
          ) : artistSearchQuery.trim().length >= 2 ? (
            <View style={styles.emptySearchContainer}>
              <Ionicons name="search-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptySearchTitle}>No artists found</Text>
              <Text style={styles.emptySearchText}>
                {isArtistUser 
                  ? "Try searching with a different name or username"
                  : "You can only message artists you've chatted with before"}
              </Text>
            </View>
          ) : (
            <View style={styles.emptySearchContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptySearchTitle}>
                {isArtistUser ? 'Search for an artist' : 'Search for an artist you\'ve chatted with'}
              </Text>
              <Text style={styles.emptySearchText}>
                {isArtistUser 
                  ? "Type at least 2 characters to search"
                  : "Type at least 2 characters to search for artists you've previously messaged"}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    opacity: 1, // Ensure container is always visible
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 26 : 30,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
  },
  tabsContainer: {
    backgroundColor: colors.background,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabsScrollContent: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.lg,
    position: 'relative',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500', // Pinterest-style lighter
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600', // Pinterest-style slightly bolder
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  tabBadge: {
    backgroundColor: colors.text.secondary + '20', // Soft gray background
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: colors.primary, // Primary color when active
  },
  tabBadgeText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    fontWeight: '600', // Pinterest-style
  },
  tabBadgeTextActive: {
    color: colors.text.primary,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  conversationCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  conversationCardUnread: {
    backgroundColor: colors.primary + '08', // Very subtle tint for unread
  },
  cardContent: {
    flexDirection: 'row',
    padding: spacing.lg,
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: spacing.lg,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: IS_SMALL_SCREEN ? 56 : 60,
    height: IS_SMALL_SCREEN ? 56 : 60,
    borderRadius: IS_SMALL_SCREEN ? 28 : 30,
    backgroundColor: colors.background,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.success,
  },
  commissionBadge: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
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
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 16 : 17,
    fontWeight: '600', // Pinterest-style
    flex: 1,
  },
  nameUnread: {
    fontWeight: '700', // Slightly bolder for unread
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '500',
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 14 : 15,
    lineHeight: 20,
    fontWeight: '400', // Pinterest-style lighter
    flex: 1,
    marginRight: spacing.sm,
  },
  messagePreviewUnread: {
    color: colors.text.primary,
    fontWeight: '500', // Pinterest-style medium for unread
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
  // Artist Search Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Constants.statusBarHeight,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  searchResultsContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  artistResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border + '30',
    ...shadows.small,
  },
  artistResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    marginRight: spacing.md,
  },
  artistResultInfo: {
    flex: 1,
  },
  artistResultName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs / 2,
  },
  artistResultUsername: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
  },
  emptySearchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptySearchTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    fontWeight: '700',
  },
  emptySearchText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
  },
});
