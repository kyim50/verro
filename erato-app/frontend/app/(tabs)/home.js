import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Text,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFeedStore, useBoardStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const { width } = Dimensions.get('window');
const SPACING = 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING) / NUM_COLUMNS;

export default function HomeScreen() {
  const { artworks, fetchArtworks, reset, hasMore, isLoading } = useFeedStore();
  const { boards, fetchBoards, saveArtworkToBoard, createBoard } = useBoardStore();
  const [refreshing, setRefreshing] = useState(false);
  const [columns, setColumns] = useState([[], []]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  useEffect(() => {
    fetchArtworks(true);
    fetchBoards();
  }, []);

  // Organize artworks into balanced columns (Pinterest masonry style)
  useEffect(() => {
    if (artworks.length > 0) {
      const newColumns = [[], []];
      const columnHeights = [0, 0];

      artworks.forEach((item, index) => {
        // Vary image heights for visual interest
        const heightMultipliers = [1.2, 1.5, 1.3, 1.6, 1.4, 1.7, 1.25, 1.45, 1.35, 1.55];
        const imageHeight = ITEM_WIDTH * heightMultipliers[index % heightMultipliers.length];
        const textHeight = 60; // Space for title + artist name below image
        const totalHeight = imageHeight + textHeight;

        // Add to the shorter column
        const shortestColumnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;
        
        newColumns[shortestColumnIndex].push({
          ...item,
          imageHeight,
          totalHeight,
        });
        
        columnHeights[shortestColumnIndex] += totalHeight + SPACING;
      });

      setColumns(newColumns);
    }
  }, [artworks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reset();
    await fetchArtworks(true);
    setRefreshing(false);
  }, []);

  const handleOpenSaveMenu = (artwork, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedArtwork(artwork);
    setShowSaveModal(true);
  };

  const handleBoardSelect = async (board) => {
    try {
      await saveArtworkToBoard(board.id, selectedArtwork.id);
      setShowSaveModal(false);
      Alert.alert('Saved!', `Added to ${board.name}`);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save artwork');
    }
  };

  const handleCreateAndSave = async () => {
    if (!newBoardName.trim()) {
      Alert.alert('Error', 'Board name is required');
      return;
    }

    try {
      const newBoard = await createBoard({ name: newBoardName.trim() });
      await saveArtworkToBoard(newBoard.id, selectedArtwork.id);
      setShowCreateBoard(false);
      setShowSaveModal(false);
      setNewBoardName('');
      Alert.alert('Success!', `Created "${newBoardName}" and saved artwork`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create board');
    }
  };

  const renderArtwork = (item) => (
    <View key={item.id} style={styles.card}>
      <Link href={`/artwork/${item.id}`} asChild>
        <TouchableOpacity activeOpacity={0.9}>
          <Image
            source={{ uri: item.thumbnail_url || item.image_url }}
            style={[styles.image, { height: item.imageHeight }]}
            contentFit="cover"
            transition={200}
          />
        </TouchableOpacity>
      </Link>
      
      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {item.artists?.users && (
          <View style={styles.artistRow}>
            <Text style={styles.artistName} numberOfLines={1}>
              {item.artists.users.username}
            </Text>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => handleOpenSaveMenu(item, e)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading artworks...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
        <Text style={styles.emptyTitle}>No Artworks Yet</Text>
        <Text style={styles.emptyText}>
          Be the first to share your art or explore other artists!
        </Text>
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Text style={styles.exploreButtonText}>Explore Artists</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabContainer}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Explore</Text>
          </View>
          <View style={styles.tab}>
            <Text style={styles.tabText}>For you</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="search" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Ionicons name="person-circle" size={26} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Masonry Grid Content */}
      {artworks.length === 0 ? (
        renderEmpty()
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.masonryContainer}>
            {/* Left Column */}
            <View style={styles.column}>
              {columns[0].map(renderArtwork)}
            </View>

            {/* Right Column */}
            <View style={styles.column}>
              {columns[1].map(renderArtwork)}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Save to Board Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Save to Board</Text>
              <TouchableOpacity onPress={() => setShowSaveModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {!showCreateBoard ? (
              <>
                <ScrollView style={styles.boardList}>
                  {boards.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.boardOption}
                      onPress={() => handleBoardSelect(item)}
                    >
                      <Ionicons name="albums" size={24} color={colors.text.secondary} />
                      <Text style={styles.boardOptionText}>{item.name}</Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                <TouchableOpacity
                  style={styles.createBoardButton}
                  onPress={() => setShowCreateBoard(true)}
                >
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                  <Text style={styles.createBoardText}>Create New Board</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.createBoardForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Board name"
                  placeholderTextColor={colors.text.disabled}
                  value={newBoardName}
                  onChangeText={setNewBoardName}
                  autoFocus
                />
                <View style={styles.createBoardActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowCreateBoard(false);
                      setNewBoardName('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateAndSave}
                  >
                    <Text style={styles.createButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    backgroundColor: colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    padding: 4,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surfaceLight,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING,
    paddingTop: SPACING,
  },
  column: {
    flex: 1,
    paddingHorizontal: SPACING / 2,
  },
  card: {
    width: '100%',
    marginBottom: SPACING,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
  },
  textContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    marginBottom: 2,
    fontWeight: '600',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artistName: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    flex: 1,
  },
  menuButton: {
    padding: 4,
    marginLeft: 4,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
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
  exploreButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
  exploreButtonText: {
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
  boardList: {
    maxHeight: 300,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  boardOptionText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  createBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  createBoardText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  createBoardForm: {
    padding: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  createBoardActions: {
    flexDirection: 'row',
    gap: spacing.md,
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
  createButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});