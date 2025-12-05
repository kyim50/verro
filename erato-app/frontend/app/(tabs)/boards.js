import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useBoardStore, useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function BoardsScreen() {
  const { boards, isLoading, fetchBoards, createBoard, deleteBoard } = useBoardStore();
  const { user, token } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [activeTab, setActiveTab] = useState('boards'); // 'boards', 'commissions', 'activity'
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  useEffect(() => {
    loadBoards();
    if (activeTab === 'commissions') {
      loadCommissions();
    }
  }, [activeTab]);

  const loadBoards = async () => {
    try {
      await fetchBoards();
    } catch (error) {
      console.error('Error loading boards:', error);
    }
  };

  const loadCommissions = async () => {
    setCommissionsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/commissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommissions(response.data.commissions || []);
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'boards') {
      await loadBoards();
    } else if (activeTab === 'commissions') {
      await loadCommissions();
    }
    setRefreshing(false);
  }, [activeTab]);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      Alert.alert('Error', 'Board name is required');
      return;
    }

    try {
      await createBoard({
        name: newBoardName.trim(),
        description: newBoardDescription.trim(),
        is_public: isPublic,
      });

      setShowCreateModal(false);
      setNewBoardName('');
      setNewBoardDescription('');
      setIsPublic(false);

      Alert.alert('Success', 'Board created!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create board');
    }
  };

  const handleDeleteBoard = (board) => {
    Alert.alert(
      'Delete Board',
      `Are you sure you want to delete "${board.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBoard(board.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete board');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'accepted': return '#4CAF50';
      case 'declined': return '#F44336';
      case 'in_progress': return '#2196F3';
      case 'completed': return '#9C27B0';
      case 'cancelled': return '#757575';
      default: return colors.text.secondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'accepted': return 'checkmark-circle-outline';
      case 'declined': return 'close-circle-outline';
      case 'in_progress': return 'hourglass-outline';
      case 'completed': return 'trophy-outline';
      case 'cancelled': return 'ban-outline';
      default: return 'help-circle-outline';
    }
  };

  const renderBoard = ({ item }) => {
    const artworkCount = item.artworks?.[0]?.count || 0;
    const firstArtworks = item.board_artworks?.slice(0, 4) || [];
    const isCreatedBoard = item.board_type === 'created';

    return (
      <TouchableOpacity
        style={[styles.boardCard, isCreatedBoard && styles.createdBoardCard]}
        onPress={() => router.push(`/board/${item.id}`)}
        activeOpacity={0.9}
      >
        {/* Cover Grid - show first 4 artworks */}
        <View style={styles.coverGrid}>
          {firstArtworks.length > 0 ? (
            firstArtworks.map((ba, index) => (
              <View key={index} style={styles.gridItem}>
                <Image
                  source={{ uri: ba.artworks?.thumbnail_url || ba.artworks?.image_url }}
                  style={styles.gridImage}
                  contentFit="cover"
                />
              </View>
            ))
          ) : (
            <View style={styles.emptyGrid}>
              <Ionicons name="images-outline" size={40} color={colors.text.disabled} />
            </View>
          )}
        </View>

        {/* Board Info */}
        <View style={styles.boardInfo}>
          <View style={styles.boardHeader}>
            <View style={styles.boardTitleRow}>
              <Text style={styles.boardName} numberOfLines={1}>
                {item.name}
              </Text>
              {isCreatedBoard && (
                <View style={styles.createdBadge}>
                  <Ionicons name="cloud-upload-outline" size={12} color={colors.primary} />
                </View>
              )}
            </View>
            {!isCreatedBoard && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteBoard(item);
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {item.description && (
            <Text style={styles.boardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.boardFooter}>
            <Text style={styles.artworkCount}>
              {artworkCount} {artworkCount === 1 ? 'Pin' : 'Pins'}
            </Text>
            {!item.is_public && (
              <Ionicons name="lock-closed" size={14} color={colors.text.secondary} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommission = ({ item }) => {
    const isClient = item.client_id === user?.id;
    const otherUser = isClient ? item.artist?.users : item.client;
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.commissionCard}
        onPress={() => {
          // Navigate to commission details or conversation
          if (item.conversation_id) {
            router.push(`/messages/${item.conversation_id}`);
          }
        }}
        activeOpacity={0.9}
      >
        <View style={styles.commissionHeader}>
          <View style={styles.commissionUser}>
            <Image
              source={{ uri: otherUser?.avatar_url || 'https://via.placeholder.com/40' }}
              style={styles.commissionAvatar}
              contentFit="cover"
            />
            <View style={styles.commissionUserInfo}>
              <Text style={styles.commissionUsername}>{otherUser?.username || 'Unknown'}</Text>
              <Text style={styles.commissionRole}>{isClient ? 'Artist' : 'Client'}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Ionicons name={getStatusIcon(item.status)} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {item.artwork && (
          <View style={styles.commissionArtwork}>
            <Image
              source={{ uri: item.artwork.thumbnail_url || item.artwork.image_url }}
              style={styles.commissionArtworkImage}
              contentFit="cover"
            />
            <Text style={styles.commissionArtworkTitle} numberOfLines={1}>
              {item.artwork.title}
            </Text>
          </View>
        )}

        <Text style={styles.commissionDetails} numberOfLines={2}>
          {item.details}
        </Text>

        {item.client_note && isClient && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteLabel}>Your note:</Text>
            <Text style={styles.noteText} numberOfLines={2}>{item.client_note}</Text>
          </View>
        )}

        {item.artist_response && !isClient && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteLabel}>Your response:</Text>
            <Text style={styles.noteText} numberOfLines={2}>{item.artist_response}</Text>
          </View>
        )}

        <View style={styles.commissionFooter}>
          <Text style={styles.commissionDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.price && (
            <Text style={styles.commissionPrice}>${item.price}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (activeTab === 'boards') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No Boards Yet</Text>
          <Text style={styles.emptyText}>
            Create boards to save and organize artworks you love!
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>Create Your First Board</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (activeTab === 'commissions') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="briefcase-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No Commissions</Text>
          <Text style={styles.emptyText}>
            {user?.user_type === 'artist' || user?.user_type === 'both'
              ? 'You haven\'t received any commission requests yet.'
              : 'You haven\'t requested any commissions yet.'}
          </Text>
        </View>
      );
    }
    return null;
  };

  const renderTabContent = () => {
    if (activeTab === 'boards') {
      return (
        <FlatList
          data={boards.sort((a, b) => {
            // Pin "Created" board at top
            if (a.board_type === 'created') return -1;
            if (b.board_type === 'created') return 1;
            // Sort rest by creation date (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
          })}
          renderItem={renderBoard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!isLoading && renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      );
    } else if (activeTab === 'commissions') {
      return (
        <FlatList
          data={commissions}
          renderItem={renderCommission}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.md }]}
          ListEmptyComponent={!commissionsLoading && renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        {activeTab === 'boards' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'boards' && styles.tabActive]}
          onPress={() => setActiveTab('boards')}
        >
          <Ionicons
            name="albums"
            size={20}
            color={activeTab === 'boards' ? colors.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'boards' && styles.tabTextActive]}>
            Boards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'commissions' && styles.tabActive]}
          onPress={() => setActiveTab('commissions')}
        >
          <Ionicons
            name="briefcase"
            size={20}
            color={activeTab === 'commissions' ? colors.primary : colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'commissions' && styles.tabTextActive]}>
            Commissions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {renderTabContent()}

      {/* Create Board Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Board</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="My Favorite Art"
                placeholderTextColor={colors.text.disabled}
                value={newBoardName}
                onChangeText={setNewBoardName}
                autoFocus
              />

              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What's this board about?"
                placeholderTextColor={colors.text.disabled}
                value={newBoardDescription}
                onChangeText={setNewBoardDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.publicToggle}
                onPress={() => setIsPublic(!isPublic)}
              >
                <View style={styles.toggleLeft}>
                  <Ionicons
                    name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                    size={20}
                    color={colors.text.primary}
                  />
                  <View>
                    <Text style={styles.toggleLabel}>
                      {isPublic ? 'Public' : 'Private'}
                    </Text>
                    <Text style={styles.toggleDescription}>
                      {isPublic ? 'Anyone can see this board' : 'Only you can see this board'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.switch, isPublic && styles.switchActive]}>
                  <View style={[styles.switchThumb, isPublic && styles.switchThumbActive]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateBoard}
              >
                <Text style={styles.saveButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 28,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary + '20',
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
  },
  tabTextActive: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  boardCard: {
    width: '48%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadows.small,
  },
  createdBoardCard: {
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  coverGrid: {
    width: '100%',
    height: 160,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.surfaceLight,
  },
  gridItem: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: colors.background,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  emptyGrid: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardInfo: {
    padding: spacing.md,
  },
  boardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  boardName: {
    ...typography.h3,
    color: colors.text.primary,
    marginRight: spacing.xs,
    fontSize: 16,
  },
  createdBadge: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    padding: 4,
  },
  boardDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  boardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artworkCount: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
  },
  commissionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  commissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  commissionUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  commissionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commissionUserInfo: {
    flex: 1,
  },
  commissionUsername: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
  },
  commissionRole: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  commissionArtwork: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  commissionArtworkImage: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.sm,
  },
  commissionArtworkTitle: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  commissionDetails: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  noteContainer: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  noteLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    marginBottom: 2,
  },
  noteText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 13,
  },
  commissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commissionDate: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 12,
  },
  commissionPrice: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 100,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  label: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  publicToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  toggleDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text.primary,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
