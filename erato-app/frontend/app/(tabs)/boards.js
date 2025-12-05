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
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBoardStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function BoardsScreen() {
  const { boards, isLoading, fetchBoards, createBoard, deleteBoard } = useBoardStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      await fetchBoards();
    } catch (error) {
      console.error('Error loading boards:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBoards();
    setRefreshing(false);
  }, []);

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

  const renderEmpty = () => (
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Boards</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Boards Grid */}
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