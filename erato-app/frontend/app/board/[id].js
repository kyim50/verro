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
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const SPACING = width < 400 ? 3 : 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING - spacing.md * 2) / NUM_COLUMNS;

export default function BoardDetailScreen() {
  const { id } = useLocalSearchParams();
  const { token } = useAuthStore();
  const [board, setBoard] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [columns, setColumns] = useState([[], []]);

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
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.artworkCard}
        onPress={() => {
          setSelectedArtwork(item);
          setShowModal(true);
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.thumbnail_url || item.image_url }}
          style={[styles.artworkImage, { height: item.imageHeight }]}
          contentFit="cover"
        />
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{board?.name || 'Board'}</Text>
          <Text style={styles.headerSubtitle}>
            {artworks.length} {artworks.length === 1 ? 'artwork' : 'artworks'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {artworks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>No Artworks Yet</Text>
          <Text style={styles.emptyText}>Save artworks to this board to see them here</Text>
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
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 20,
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
});
