import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const SPACING = width < 400 ? 3 : 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING - spacing.md * 2) / NUM_COLUMNS;

export default function CanvasDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [columns, setColumns] = useState([[], []]);
  const [editMode, setEditMode] = useState(false);
  const [selectedArtworks, setSelectedArtworks] = useState(new Set());
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [userBoards, setUserBoards] = useState([]);

  const fetchBoardDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/boards/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBoard(response.data);

      // Extract artworks from board_artworks relationship
      const artworkList = response.data.board_artworks?.map(ba => ba.artworks).filter(Boolean) || [];
      setArtworks(artworkList);
    } catch (error) {
      console.error('Error fetching board details:', error);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchBoardDetails();
  }, [fetchBoardDetails]);

  // Refresh board details when screen comes into focus (e.g., after adding artwork)
  useFocusEffect(
    useCallback(() => {
      fetchBoardDetails();
    }, [fetchBoardDetails])
  );

  // Fetch user's boards for moving artworks
  const fetchUserBoards = useCallback(async () => {
    try {
      // Use /boards endpoint which includes full artwork data
      const response = await axios.get(`${API_URL}/boards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched boards with artworks:', response.data);

      // Filter out the current board and system boards
      const filteredBoards = response.data.filter(b =>
        b.id !== id && b.name !== 'Liked' && b.board_type !== 'created'
      );
      console.log('Filtered boards for modal:', filteredBoards);

      // Log the full structure for debugging
      filteredBoards.forEach(b => {
        console.log('Board:', b.name);
        console.log('  - artworks:', b.artworks);
        console.log('  - board_artworks:', b.board_artworks);
        if (b.board_artworks?.[0]) {
          console.log('  - first board_artwork:', b.board_artworks[0]);
          console.log('  - first artwork details:', b.board_artworks[0].artworks);
        }
      });

      setUserBoards(filteredBoards);
    } catch (error) {
      console.error('Error fetching user boards:', error);
    }
  }, [token, id]);

  // Toggle edit mode
  const toggleEditMode = () => {
    if (editMode) {
      setSelectedArtworks(new Set());
    } else {
      fetchUserBoards();
    }
    setEditMode(!editMode);
  };

  // Toggle artwork selection
  const toggleArtworkSelection = (artworkId) => {
    const newSelected = new Set(selectedArtworks);
    if (newSelected.has(artworkId)) {
      newSelected.delete(artworkId);
    } else {
      newSelected.add(artworkId);
    }
    setSelectedArtworks(newSelected);
  };

  // Delete selected artworks from board
  const handleDeleteSelected = () => {
    Alert.alert(
      'Delete Artworks',
      `Are you sure you want to remove ${selectedArtworks.size} ${selectedArtworks.size === 1 ? 'artwork' : 'artworks'} from this canvas?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete each selected artwork from the board
              await Promise.all(
                Array.from(selectedArtworks).map(artworkId =>
                  axios.delete(`${API_URL}/boards/${id}/artworks/${artworkId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  })
                )
              );

              Toast.show({
                type: 'success',
                text1: 'Success',
                text2: `Removed ${selectedArtworks.size} ${selectedArtworks.size === 1 ? 'artwork' : 'artworks'}`,
                visibilityTime: 2000,
              });

              setSelectedArtworks(new Set());
              setEditMode(false);
              await fetchBoardDetails();
            } catch (error) {
              console.error('Error deleting artworks:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to remove artworks',
                visibilityTime: 3000,
              });
            }
          }
        }
      ]
    );
  };

  // Move/Add selected artworks to another board
  const handleMoveToBoard = async (targetBoardId) => {
    const isLikedBoard = board?.name === 'Liked';

    try {
      await Promise.all(
        Array.from(selectedArtworks).map(async (artworkId) => {
          // Add to target board
          await axios.post(
            `${API_URL}/boards/${targetBoardId}/artworks`,
            { artwork_id: artworkId },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          // Only remove from current board if it's NOT the Liked board
          if (!isLikedBoard) {
            await axios.delete(`${API_URL}/boards/${id}/artworks/${artworkId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        })
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: isLikedBoard
          ? `Added ${selectedArtworks.size} ${selectedArtworks.size === 1 ? 'artwork' : 'artworks'} to canvas`
          : `Moved ${selectedArtworks.size} ${selectedArtworks.size === 1 ? 'artwork' : 'artworks'}`,
        visibilityTime: 2000,
      });

      setSelectedArtworks(new Set());
      setEditMode(false);
      setShowBoardSelector(false);

      // Only refresh if we removed artworks (non-Liked boards)
      if (!isLikedBoard) {
        await fetchBoardDetails();
      }
    } catch (error) {
      console.error('Error with artworks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: isLikedBoard ? 'Failed to add artworks to canvas' : 'Failed to move artworks',
        visibilityTime: 3000,
      });
    }
  };

  // Organize artworks into balanced columns (Pinterest masonry style)
  useEffect(() => {
    if (artworks.length > 0) {
      const newColumns = [[], []];
      const columnHeights = [0, 0];

      artworks.forEach((item) => {
        // Calculate image height based on aspect ratio if available
        let imageHeight;
        const ratio = item.aspect_ratio || item.aspectRatio;

        if (ratio && typeof ratio === 'string' && ratio.includes(':')) {
          const parts = ratio.split(':');
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);

          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            imageHeight = ITEM_WIDTH * (h / w);
          } else {
            imageHeight = ITEM_WIDTH * 1.25;
          }
        } else {
          imageHeight = ITEM_WIDTH * 1.25;
        }

        const totalHeight = imageHeight;

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
    } else {
      setColumns([[], []]);
    }
  }, [artworks]);

  const renderArtwork = (item) => {
    const isSelected = selectedArtworks.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.artworkCard}
        onPress={() => {
          if (editMode) {
            toggleArtworkSelection(item.id);
          } else {
            router.push(`/artwork/${item.id}`);
          }
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.thumbnail_url || item.image_url }}
          style={[styles.artworkImage, { height: item.imageHeight }]}
          contentFit="cover"
        />
        {editMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && <Ionicons name="checkmark" size={18} color="#FFF" />}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isLikedBoard = board?.name === 'Liked';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (editMode) {
              toggleEditMode();
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name={editMode ? "close" : "arrow-back"} size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {editMode ? `${selectedArtworks.size} Selected` : board?.name || 'Canvas'}
          </Text>
          {!editMode && (
            <Text style={styles.headerSubtitle}>
              {artworks.length} {artworks.length === 1 ? 'artwork' : 'artworks'}
            </Text>
          )}
        </View>
        {artworks.length > 0 && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={toggleEditMode}
          >
            <Text style={styles.editButtonText}>{editMode ? 'Done' : 'Edit'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit Mode Actions */}
      {editMode && selectedArtworks.size > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              fetchUserBoards();
              setShowBoardSelector(true);
            }}
          >
            <Ionicons name="folder-outline" size={20} color={colors.primary} />
            <Text style={styles.actionButtonText}>
              {isLikedBoard ? 'Add to Canvas' : 'Move to Canvas'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {artworks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No Artworks Yet</Text>
          <Text style={styles.emptyText}>Save artworks to this canvas to see them here</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.masonryContainer}>
            {/* Left Column */}
            <View style={styles.masonryColumn}>
              {columns[0].map(item => renderArtwork(item))}
            </View>

            {/* Right Column */}
            <View style={styles.masonryColumn}>
              {columns[1].map(item => renderArtwork(item))}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Artwork Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowModal(false)}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowModal(false)}
              >
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalViewButton}
                onPress={() => {
                  setShowModal(false);
                  router.push(`/artwork/${selectedArtwork?.id}`);
                }}
              >
                <Text style={styles.modalViewText}>View Details</Text>
              </TouchableOpacity>
            </View>

            {selectedArtwork && (
              <View style={styles.modalContent}>
                <Image
                  source={{ uri: selectedArtwork.image_url }}
                  style={styles.modalImage}
                  contentFit="contain"
                />
                <View style={styles.modalInfo}>
                  <Text style={styles.modalTitle}>{selectedArtwork.title}</Text>
                  {selectedArtwork.artists?.users && (
                    <Text style={styles.modalArtist}>
                      by {selectedArtwork.artists.users.full_name || selectedArtwork.artists.users.username}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Board Selector Modal - Pinterest Style */}
      <Modal
        visible={showBoardSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBoardSelector(false)}
      >
        <View style={styles.boardSelectorContainer}>
          <TouchableOpacity
            style={styles.boardSelectorOverlay}
            activeOpacity={1}
            onPress={() => setShowBoardSelector(false)}
          />
          <View style={styles.boardSelectorContent}>
            <View style={styles.boardSelectorHeader}>
              <TouchableOpacity onPress={() => setShowBoardSelector(false)}>
                <Ionicons name="close" size={28} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.boardSelectorTitle}>Move to Canvas</Text>
            <View style={styles.boardListContainer}>
              {userBoards.length === 0 ? (
                <View style={styles.emptyBoardList}>
                  <Ionicons name="folder-outline" size={48} color={colors.text.disabled} />
                  <Text style={styles.emptyBoardText}>No canvases available</Text>
                  <Text style={styles.emptyBoardSubtext}>Create a canvas first to move artworks</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.boardList}
                  contentContainerStyle={styles.boardListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {userBoards.map((targetBoard) => {
                    // Get thumbnail from first artwork in board
                    const firstArtwork = targetBoard.board_artworks?.[0]?.artworks;
                    const thumbnailUrl = firstArtwork?.thumbnail_url || firstArtwork?.image_url;
                    const artworkCount = targetBoard.artworks?.[0]?.count || targetBoard.board_artworks?.length || 0;

                    console.log(`Rendering board: ${targetBoard.name}`);
                    console.log(`  Thumbnail URL: ${thumbnailUrl}`);
                    console.log(`  Artwork count: ${artworkCount}`);

                    return (
                      <TouchableOpacity
                        key={targetBoard.id}
                        style={styles.boardOption}
                        onPress={() => handleMoveToBoard(targetBoard.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.boardThumbnail}>
                          {thumbnailUrl ? (
                            <Image
                              source={{ uri: thumbnailUrl }}
                              style={styles.boardThumbnailImage}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.boardThumbnailPlaceholder}>
                              <Ionicons name="images-outline" size={28} color={colors.text.disabled} />
                            </View>
                          )}
                        </View>
                        <View style={styles.boardInfo}>
                          <Text style={styles.boardName} numberOfLines={1}>
                            {targetBoard.name}
                          </Text>
                          <Text style={styles.boardMeta}>
                            {artworkCount} {artworkCount === 1 ? 'pin' : 'pins'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md, // Add padding to prevent clash with buttons
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 18, // Slightly smaller to fit better
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  gridContent: {
    paddingBottom: spacing.xxl,
  },
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING + spacing.md / 2,
    paddingTop: SPACING,
  },
  masonryColumn: {
    flex: 1,
    paddingHorizontal: SPACING / 2,
  },
  artworkCard: {
    width: '100%',
    marginBottom: SPACING,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  artworkImage: {
    width: '100%',
    borderRadius: borderRadius.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.overlayDark,
  },
  modalOverlay: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.text.primary + '33', // 0.2 opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalViewButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  modalViewText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  modalInfo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  modalArtist: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  editButtonText: {
    ...typography.button,
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  deleteButton: {
    backgroundColor: colors.surface,
  },
  deleteButtonText: {
    color: colors.status.error,
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boardSelectorContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  boardSelectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  boardSelectorContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    minHeight: 300,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  boardSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  boardSelectorTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  boardListContainer: {
    flex: 1,
  },
  boardList: {
    flex: 1,
  },
  boardListContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  boardThumbnail: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceLight,
  },
  boardThumbnailImage: {
    width: 70,
    height: 70,
  },
  boardThumbnailPlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  boardMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptyBoardList: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyBoardText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  emptyBoardSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
