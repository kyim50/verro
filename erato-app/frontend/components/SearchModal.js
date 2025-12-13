import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSearchStore, useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import ArtistFilters from './ArtistFilters';
import StylePreferenceQuiz from './StylePreferenceQuiz';
import Constants from 'expo-constants';
import axios from 'axios';

const IS_SMALL_SCREEN = Dimensions.get('window').width < 400;

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

const { width } = Dimensions.get('window');
const SPACING = 4;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING - spacing.md * 2) / NUM_COLUMNS;

export default function SearchModal({ visible, onClose }) {
  const {
    query,
    artworks,
    artists,
    isLoading,
    activeTab,
    filters,
    setQuery,
    setActiveTab,
    setFilters,
    search,
    searchArtistsWithFilters,
    clearSearch,
  } = useSearchStore();
  
  const { token, user } = useAuthStore();
  const isArtist = user?.user_type === 'artist' || (user?.artists && (Array.isArray(user.artists) ? user.artists.length > 0 : !!user.artists));
  
  const [localQuery, setLocalQuery] = useState(query);
  const [showFilters, setShowFilters] = useState(false);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [loadingSmartMatches, setLoadingSmartMatches] = useState(false);
  const lastSearchQuery = useRef('');

  useEffect(() => {
    // Debounce search - only search when query actually changes
    // Skip if query hasn't changed (prevents re-searching on tab switch)
    if (localQuery === lastSearchQuery.current) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      if (localQuery.trim().length >= 2) {
        lastSearchQuery.current = localQuery;
        // Get current activeTab from store at the time of search
        const currentTab = useSearchStore.getState().activeTab;
        search(localQuery, filters, currentTab);
      } else if (localQuery.trim().length === 0) {
        lastSearchQuery.current = '';
        clearSearch();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localQuery, filters]); // Only trigger on query/filter changes, not tab changes

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    if (activeTab === 'artists') {
      if (localQuery.trim().length >= 2) {
        search(localQuery, newFilters);
      } else {
        searchArtistsWithFilters(newFilters);
      }
    }
  };

  const handleSmartMatch = async () => {
    if (!token) {
      return;
    }
    setLoadingSmartMatches(true);
    try {
      const response = await axios.get(`${API_URL}/artists/matches/smart?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveTab('artists');
      useSearchStore.setState({ artists: response.data.artists || [] });
    } catch (error) {
      console.error('Error loading smart matches:', error);
    } finally {
      setLoadingSmartMatches(false);
    }
  };

  const handleClose = () => {
    clearSearch();
    setLocalQuery('');
    onClose();
  };

  const renderArtwork = ({ item, index }) => {
    const heightMultipliers = [1.2, 1.5, 1.3, 1.6, 1.4];
    const imageHeight = ITEM_WIDTH * heightMultipliers[index % heightMultipliers.length];

    return (
      <TouchableOpacity
        style={[styles.artworkCard, { height: imageHeight }]}
        onPress={() => {
          router.push(`/artwork/${item.id}`);
          handleClose();
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.thumbnail_url || item.image_url }}
          style={styles.artworkImage}
          contentFit="cover"
        />
        <View style={styles.artworkOverlay}>
          <Text style={styles.artworkTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.artworkArtist} numberOfLines={1}>
            {item.artists?.users?.username || 'Unknown'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderArtist = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.artistCard}
        onPress={() => {
          router.push(`/artist/${item.id}`);
          handleClose();
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.users?.avatar_url || 'https://via.placeholder.com/80' }}
          style={styles.artistAvatar}
          contentFit="cover"
        />
        <View style={styles.artistInfo}>
          <Text style={styles.artistName} numberOfLines={1}>
            {item.users?.full_name || item.users?.username}
          </Text>
          <Text style={styles.artistUsername} numberOfLines={1}>
            @{item.users?.username}
          </Text>
          {item.users?.bio && (
            <Text style={styles.artistBio} numberOfLines={2}>
              {item.users.bio}
            </Text>
          )}
          <View style={styles.artistStats}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={14} color={colors.primary} />
              <Text style={styles.statText}>{item.rating?.toFixed(1) || '0.0'}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="briefcase-outline" size={14} color={colors.text.secondary} />
              <Text style={styles.statText}>{item.total_commissions || 0}</Text>
            </View>
            {item.min_price && item.max_price && (
              <Text style={styles.priceText}>
                ${item.min_price} - ${item.max_price}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (localQuery.trim().length < 2) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={colors.text.disabled} />
          <Text style={styles.emptyTitle}>Search</Text>
          <Text style={styles.emptyText}>
            Find amazing art or discover talented artists
          </Text>
          
          {activeTab === 'artists' && !isArtist && token && (
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={handleSmartMatch}
                disabled={loadingSmartMatches}
              >
                {loadingSmartMatches ? (
                  <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color={colors.text.primary} />
                    <Text style={styles.emptyActionText}>Smart Matches</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyActionButton}
                onPress={() => setShowStyleQuiz(true)}
              >
                <Ionicons name="color-palette" size={20} color={colors.text.primary} />
                <Text style={styles.emptyActionText}>Style Quiz</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="sad-outline" size={64} color={colors.text.disabled} />
        <Text style={styles.emptyTitle}>No Results Found</Text>
        <Text style={styles.emptyText}>
          Try different keywords or check the other tab
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleClose}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.text.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'artworks' ? 'Search artworks...' : 'Search artists...'}
              placeholderTextColor={colors.text.disabled}
              value={localQuery}
              onChangeText={setLocalQuery}
              autoFocus
              returnKeyType="search"
            />
            {localQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setLocalQuery('');
                  clearSearch();
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'artworks' && styles.activeTab]}
            onPress={() => {
              setActiveTab('artworks');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'artworks' && styles.activeTabText]}>
              Artworks {artworks.length > 0 && `(${artworks.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'artists' && styles.activeTab]}
            onPress={() => {
              setActiveTab('artists');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'artists' && styles.activeTabText]}>
              Artists {artists.length > 0 && `(${artists.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : activeTab === 'artworks' ? (
            <FlatList
              key="artworks-grid"
              data={artworks}
              renderItem={renderArtwork}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              key="artists-list"
              data={artists}
              renderItem={renderArtist}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Filters Modal */}
      <ArtistFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        token={token}
      />

      {/* Style Quiz Modal */}
      {!isArtist && (
        <StylePreferenceQuiz
          visible={showStyleQuiz}
          onClose={() => setShowStyleQuiz(false)}
          token={token}
          onComplete={() => {
            handleSmartMatch();
          }}
        />
      )}
    </Modal>
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
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.md : spacing.lg,
    paddingTop: Math.max(Constants.statusBarHeight - spacing.md, spacing.sm),
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    height: '100%',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.button,
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: SPACING,
  },
  artworkCard: {
    width: ITEM_WIDTH,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  artworkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  artworkTitle: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  artworkArtist: {
    ...typography.tiny,
    color: colors.text.secondary,
    marginTop: 2,
  },
  artistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  artistAvatar: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 16,
  },
  artistUsername: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  artistBio: {
    ...typography.tiny,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  artistStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  priceText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  emptyActions: {
    marginTop: spacing.xl,
    gap: spacing.md,
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyActionText: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
});
