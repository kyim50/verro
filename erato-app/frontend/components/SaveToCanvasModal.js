// Extracted from home.js - Full Pinterest-style save modal with thumbnails
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import Toast from 'react-native-toast-message';

export default function SaveToCanvasModal({
  visible,
  onClose,
  boards,
  onSaveToBoard,
  artworkId,
  loading = false,
}) {
  const [selectedCanvasId, setSelectedCanvasId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedCanvasId(null);
      setSaving(false);
    }
  }, [visible]);

  const handleCanvasSelect = async (canvas) => {
    setSelectedCanvasId(canvas.id);
    setSaving(true);
    try {
      await onSaveToBoard(canvas.id, artworkId);
      onClose();
      Toast.show({
        type: 'success',
        text1: 'Saved!',
        text2: 'Artwork added to canvas',
        visibilityTime: 2000,
      });
    } catch (error) {
      console.error('Error saving to canvas:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save artwork',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const renderCanvas = (canvas) => {
    const firstArtworks = canvas.board_artworks?.slice(0, 4) || [];
    const artworkCount = canvas.board_artworks?.length || canvas.artworks?.[0]?.count || 0;

    return (
      <TouchableOpacity
        key={canvas.id}
        style={styles.saveCanvasOption}
        onPress={() => handleCanvasSelect(canvas)}
        activeOpacity={0.7}
        disabled={saving}
      >
        {/* Canvas Thumbnail - Pinterest Grid Style */}
        <View style={styles.saveCanvasThumbnail}>
          {firstArtworks.length > 0 ? (
            <View style={styles.saveThumbnailGrid}>
              {/* Left large image */}
              <View style={styles.saveGridLeft}>
                <Image
                  source={{ uri: firstArtworks[0]?.artworks?.thumbnail_url || firstArtworks[0]?.artworks?.image_url }}
                  style={styles.saveGridImage}
                  contentFit="cover"
                />
              </View>
              {/* Right small images */}
              <View style={styles.saveGridRight}>
                {firstArtworks.slice(1, 4).map((ba, index) => (
                  <View key={index} style={styles.saveGridSmallItem}>
                    <Image
                      source={{ uri: ba.artworks?.thumbnail_url || ba.artworks?.image_url }}
                      style={styles.saveGridImage}
                      contentFit="cover"
                    />
                  </View>
                ))}
                {firstArtworks.length < 4 && Array(4 - firstArtworks.length).fill(0).map((_, i) => (
                  <View key={`empty-${i}`} style={[styles.saveGridSmallItem, styles.saveGridEmpty]} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.saveGridEmptyFull}>
              <Ionicons name="images-outline" size={24} color={colors.text.disabled} />
            </View>
          )}
        </View>

        {/* Canvas Info */}
        <View style={styles.saveCanvasInfo}>
          <Text style={styles.saveCanvasName} numberOfLines={1}>
            {canvas.name}
          </Text>
          <Text style={styles.saveCanvasMeta}>
            {artworkCount} {artworkCount === 1 ? 'pin' : 'pins'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      style={{ zIndex: 9999 }}
      onRequestClose={onClose}
    >
      <View style={styles.saveCanvasModalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
          <View style={styles.saveCanvasModalContent}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }}>
                {/* Header with Safe Area */}
                <View style={styles.saveCanvasHeader}>
                  <TouchableOpacity
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={saving}
                  >
                    <Ionicons name="close" size={28} color={colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.saveCanvasTitle}>Save to Canvas</Text>
                  <View style={{ width: 28 }} />
                </View>

                {/* Canvas List */}
                <ScrollView
                  style={styles.saveCanvasList}
                  contentContainerStyle={styles.saveCanvasListContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.loadingText}>Loading canvases...</Text>
                    </View>
                  ) : boards && boards.length > 0 ? (
                    boards.map(renderCanvas)
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="images-outline" size={48} color={colors.text.disabled} />
                      <Text style={styles.emptyTitle}>No Canvases Yet</Text>
                      <Text style={styles.emptySubtitle}>
                        Create your first canvas to start organizing your saved artworks
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modal overlay styles from home.js
  saveCanvasModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer Pinterest overlay
  },
  saveCanvasModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, // Pinterest-style soft rounding
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: spacing.lg,
  },
  saveCanvasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15', // Soft border
  },
  saveCanvasTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700', // Pinterest-style
    fontSize: 22,
    letterSpacing: -0.3,
  },
  saveCanvasList: {
    flex: 1,
  },
  saveCanvasListContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  saveCanvasOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16, // Pinterest-style soft rounding
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, // Soft shadow
    shadowRadius: 6,
    elevation: 2,
  },
  saveCanvasThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12, // Softer rounding
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  saveThumbnailGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  saveGridLeft: {
    flex: 1,
    height: '100%',
  },
  saveGridRight: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  saveGridSmallItem: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  saveGridImage: {
    width: '100%',
    height: '100%',
  },
  saveGridEmpty: {
    backgroundColor: colors.surface + '40',
  },
  saveGridEmptyFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  saveCanvasInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  saveCanvasName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '600', // Pinterest-style
    marginBottom: 3,
  },
  saveCanvasMeta: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400',
  },
  // Loading and empty states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h1,
    color: colors.text.primary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
