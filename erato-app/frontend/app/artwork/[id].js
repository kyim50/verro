import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

export default function ArtworkDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, token } = useAuthStore();

  const [artwork, setArtwork] = useState(null);
  const [similarArtworks, setSimilarArtworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissionDetails, setCommissionDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchArtworkDetails();
    fetchSimilarArtworks();
  }, [id]);

  const fetchArtworkDetails = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artworks/${id}`, { headers });
      // The API returns {artwork: {...}} not just the artwork object
      const artworkData = response.data.artwork || response.data;
      setArtwork(artworkData);
    } catch (error) {
      console.error('Error fetching artwork:', error);
      Alert.alert('Error', 'Failed to load artwork');
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarArtworks = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artworks`, {
        params: { limit: 6 },
        headers
      });
      setSimilarArtworks(response.data.artworks || []);
    } catch (error) {
      console.error('Error fetching similar artworks:', error);
    }
  };

  const handleRequestCommission = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to request a commission');
      return;
    }

    if (!commissionDetails.trim()) {
      Alert.alert('Details Required', 'Please provide details about your commission request');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/commissions/request`,
        {
          artist_id: artwork.artist_id,
          artwork_id: artwork.id,
          details: commissionDetails,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowCommissionModal(false);
      setCommissionDetails('');
      Alert.alert('Success!', 'Your commission request has been sent to the artist.');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send commission request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!artwork) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Artwork not found</Text>
      </View>
    );
  }

  const isOwnArtwork = user?.id === artwork.artist_id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="share-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Main Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: artwork.image_url }}
            style={styles.mainImage}
            contentFit="contain"
          />
        </View>

        {/* Artwork Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{artwork.title}</Text>
          {artwork.description && (
            <Text style={styles.description}>{artwork.description}</Text>
          )}

          {/* Tags */}
          {artwork.tags && artwork.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {artwork.tags.map((tag, index) => (
                <TouchableOpacity key={index} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="eye-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.statText}>{artwork.view_count || 0} views</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={20} color={colors.text.secondary} />
              <Text style={styles.statText}>{artwork.like_count || 0} likes</Text>
            </View>
          </View>
        </View>

        {/* Artist Info */}
        <View style={styles.artistSection}>
          <TouchableOpacity
            style={styles.artistInfo}
            onPress={() => !isOwnArtwork && router.push(`/artist/${artwork.artist_id}`)}
          >
            <Image
              source={{ uri: artwork.artists?.users?.avatar_url || 'https://via.placeholder.com/80' }}
              style={styles.artistAvatar}
              contentFit="cover"
            />
            <View style={styles.artistDetails}>
              <Text style={styles.artistName}>
                {artwork.artists?.users?.full_name || artwork.artists?.users?.username || 'Unknown Artist'}
              </Text>
              <Text style={styles.artistBio} numberOfLines={1}>
                {artwork.artists?.users?.bio || 'Artist on Verro'}
              </Text>
            </View>
          </TouchableOpacity>

          {!isOwnArtwork && (
            <TouchableOpacity
              style={styles.commissionButton}
              onPress={() => setShowCommissionModal(true)}
            >
              <Ionicons name="mail-outline" size={20} color={colors.text.primary} />
              <Text style={styles.commissionButtonText}>Request Commission</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Similar Artworks */}
        {similarArtworks.length > 0 && (
          <View style={styles.similarSection}>
            <Text style={styles.sectionTitle}>More Like This</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarGrid}
            >
              {similarArtworks.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.similarItem}
                  onPress={() => router.push(`/artwork/${item.id}`)}
                >
                  <Image
                    source={{ uri: item.thumbnail_url || item.image_url }}
                    style={styles.similarImage}
                    contentFit="cover"
                  />
                  <Text style={styles.similarTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Commission Request Modal */}
      <Modal
        visible={showCommissionModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCommissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Commission</Text>
              <TouchableOpacity onPress={() => setShowCommissionModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Tell {artwork.artist?.users?.full_name || 'the artist'} about your commission idea
            </Text>

            <TextInput
              style={styles.detailsInput}
              placeholder="Describe your commission request..."
              placeholderTextColor={colors.text.disabled}
              value={commissionDetails}
              onChangeText={setCommissionDetails}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.priceHint}>
              Price Range: ${artwork.artist?.min_price || 0} - ${artwork.artist?.max_price || 0}
            </Text>

            <TouchableOpacity
              style={[styles.sendButton, submitting && styles.sendButtonDisabled]}
              onPress={handleRequestCommission}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.sendButtonText}>Send Request</Text>
              )}
            </TouchableOpacity>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: width,
    height: height * 0.6,
    backgroundColor: colors.surface,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  tagText: {
    ...typography.caption,
    color: colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  artistSection: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  artistDetails: {
    flex: 1,
  },
  artistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  artistBio: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  commissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  commissionButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  similarSection: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  similarGrid: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  similarItem: {
    width: width * 0.4,
  },
  similarImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  similarTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  errorText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  detailsInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.text.primary,
    fontSize: 16,
    minHeight: 120,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceHint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  sendButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
});
