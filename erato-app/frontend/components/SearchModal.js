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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSearchStore, useAuthStore } from '../store';
import { colors, spacing, typography, borderRadius } from '../constants/theme';
import ArtistFilters from './ArtistFilters';
import StylePreferenceQuiz from './StylePreferenceQuiz';
import Constants from 'expo-constants';
import axios from 'axios';
import { expandSearchQuery, scoreArtworkRelevance, getUserStylePreferences } from '../utils/searchUtils';

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
  const [recommendedArtists, setRecommendedArtists] = useState([]);
  const [popularArtworks, setPopularArtworks] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [sortBy, setSortBy] = useState('relevance'); // relevance, recent, popular, price_low, price_high
  const [rankedArtworks, setRankedArtworks] = useState([]);

  useEffect(() => {
    // Load recommendations when modal opens
    if (visible) {
      loadRecommendations();
    }
  }, [visible]);

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

  // Smart ranking and sorting for artwork search results
  useEffect(() => {
    if (artworks.length === 0) {
      setRankedArtworks([]);
      return;
    }

    let processedArtworks = [...artworks];

    // Apply smart ranking when searching
    if (localQuery.trim().length >= 2) {
      // Score each artwork based on relevance
      const scoredArtworks = processedArtworks.map(artwork => ({
        ...artwork,
        relevanceScore: scoreArtworkRelevance(artwork, localQuery, {})
      }));

      // Sort based on selected sort option
      switch (sortBy) {
        case 'relevance':
          scoredArtworks.sort((a, b) => b.relevanceScore - a.relevanceScore);
          break;
        case 'recent':
          scoredArtworks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          break;
        case 'popular':
          scoredArtworks.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));
          break;
        default:
          // Keep relevance score order
          scoredArtworks.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }

      processedArtworks = scoredArtworks;
    }

    setRankedArtworks(processedArtworks);
  }, [artworks, localQuery, sortBy]);

  const loadRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      // Load recommended artists and popular artworks in parallel
      const requests = [];

      // Load popular artworks for everyone
      requests.push(
        axios.get(`${API_URL}/artworks?sort=engagement_score&order=desc&limit=12`)
      );

      // Load recommended artists only for logged-in non-artists
      if (token && !isArtist) {
        requests.push(
          axios.get(`${API_URL}/artists/matches/smart?limit=6`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        );
      }

      const responses = await Promise.all(requests);

      setPopularArtworks(responses[0].data.artworks || []);
      if (responses.length > 1) {
        setRecommendedArtists(responses[1].data.artists || []);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

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
    const heights = [160, 210, 180, 200, 175, 190, 220, 170, 195, 185];
    const columnIndex = index % 2;
    const itemIndex = Math.floor(index / 2);
    const imageHeight = heights[itemIndex % heights.length];

    // Get related tags based on search query
    const expandedTerms = localQuery ? expandSearchQuery(localQuery) : [];
    const relatedTags = item.tags?.filter(tag =>
      expandedTerms.some(term => tag.toLowerCase().includes(term.toLowerCase()))
    ).slice(0, 2) || [];

    return (
      <View key={item.id} style={styles.searchArtworkCard}>
        <TouchableOpacity
          onPress={() => {
            router.push(`/artwork/${item.id}`);
            handleClose();
          }}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: item.thumbnail_url || item.image_url }}
            style={[styles.searchArtworkImage, { height: imageHeight }]}
            contentFit="cover"
          />
        </TouchableOpacity>

        <View style={styles.searchArtworkInfo}>
          <View style={styles.searchTitleRow}>
            <Text style={styles.searchArtworkTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.searchMenuButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {item.artists?.users && (
            <Text style={styles.searchArtistName} numberOfLines={1}>
              {item.artists.users.username}
            </Text>
          )}
          {relatedTags.length > 0 && (
            <View style={styles.relatedTagsContainer}>
              {relatedTags.map((tag, idx) => (
                <View key={idx} style={styles.relatedTag}>
                  <Text style={styles.relatedTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
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

  const renderDiscoveryCategory = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.categoryCard}
        onPress={() => {
          if (item.type === 'artist') {
            router.push(`/artist/${item.id}`);
          }
          handleClose();
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: item.image }}
          style={styles.categoryImage}
          contentFit="cover"
        />
        <View style={styles.categoryOverlay}>
          <Text style={styles.categoryTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    if (localQuery.trim().length < 2) {
      // Pinterest-style discovery view
      return (
        <ScrollView
          style={styles.discoveryContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.discoveryContent}
        >
          {/* Artists for you section - Pinterest style with image tiles */}
          {!isArtist && recommendedArtists.length > 0 && (
            <View style={styles.discoverySection}>
              <Text style={styles.discoverySectionTitle}>Artists for you</Text>
              <View style={styles.masonryContainer}>
                {/* Left Column */}
                <View style={styles.masonryColumn}>
                  {recommendedArtists.slice(0, 6).filter((_, index) => index % 2 === 0).map((artist, index) => {
                    const heights = [180, 160, 200];
                    const actualIndex = index * 2;
                    return (
                      <TouchableOpacity
                        key={artist.id}
                        style={[styles.categoryTile, { height: heights[index % heights.length] }]}
                        onPress={() => {
                          router.push(`/artist/${artist.id}`);
                          handleClose();
                        }}
                        activeOpacity={0.95}
                      >
                        <Image
                          source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/200' }}
                          style={styles.categoryTileImage}
                          contentFit="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={styles.categoryTileOverlay}
                        >
                          <Text style={styles.categoryTileText} numberOfLines={2}>
                            {artist.users?.full_name || artist.users?.username}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Right Column */}
                <View style={styles.masonryColumn}>
                  {recommendedArtists.slice(0, 6).filter((_, index) => index % 2 === 1).map((artist, index) => {
                    const heights = [200, 170, 190];
                    return (
                      <TouchableOpacity
                        key={artist.id}
                        style={[styles.categoryTile, { height: heights[index % heights.length] }]}
                        onPress={() => {
                          router.push(`/artist/${artist.id}`);
                          handleClose();
                        }}
                        activeOpacity={0.95}
                      >
                        <Image
                          source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/200' }}
                          style={styles.categoryTileImage}
                          contentFit="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={styles.categoryTileOverlay}
                        >
                          <Text style={styles.categoryTileText} numberOfLines={2}>
                            {artist.users?.full_name || artist.users?.username}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Popular on Verro section - Pinterest style masonry - Only show on Artworks tab */}
          {popularArtworks.length > 0 && activeTab === 'artworks' && (
            <View style={styles.discoverySection}>
              <Text style={[styles.discoverySectionTitle, styles.centeredSectionTitle]}>Popular on Verro</Text>
              <View style={styles.masonryContainer}>
                {/* Left Column */}
                <View style={styles.masonryColumn}>
                  {popularArtworks.filter((_, index) => index % 2 === 0).map((artwork, index) => {
                    const heights = [160, 210, 180, 200, 175, 190];
                    // Get first 2 tags or use title as fallback
                    const displayText = artwork.tags && artwork.tags.length > 0
                      ? artwork.tags.slice(0, 2).join(' • ')
                      : artwork.title;

                    return (
                      <TouchableOpacity
                        key={artwork.id}
                        style={[styles.categoryTile, { height: heights[index % heights.length] }]}
                        onPress={() => {
                          router.push(`/artwork/${artwork.id}`);
                          handleClose();
                        }}
                        activeOpacity={0.95}
                      >
                        <Image
                          source={{ uri: artwork.thumbnail_url || artwork.image_url }}
                          style={styles.categoryTileImage}
                          contentFit="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={styles.categoryTileOverlay}
                        >
                          <Text style={styles.categoryTileText} numberOfLines={2}>
                            {displayText}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Right Column */}
                <View style={styles.masonryColumn}>
                  {popularArtworks.filter((_, index) => index % 2 === 1).map((artwork, index) => {
                    const heights = [220, 170, 195, 185, 205, 180];
                    // Get first 2 tags or use title as fallback
                    const displayText = artwork.tags && artwork.tags.length > 0
                      ? artwork.tags.slice(0, 2).join(' • ')
                      : artwork.title;

                    return (
                      <TouchableOpacity
                        key={artwork.id}
                        style={[styles.categoryTile, { height: heights[index % heights.length] }]}
                        onPress={() => {
                          router.push(`/artwork/${artwork.id}`);
                          handleClose();
                        }}
                        activeOpacity={0.95}
                      >
                        <Image
                          source={{ uri: artwork.thumbnail_url || artwork.image_url }}
                          style={styles.categoryTileImage}
                          contentFit="cover"
                        />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.8)']}
                          style={styles.categoryTileOverlay}
                        >
                          <Text style={styles.categoryTileText} numberOfLines={2}>
                            {displayText}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Loading state */}
          {loadingRecommendations && (
            <View style={styles.discoveryLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}

          {/* Empty state when no recommendations loaded */}
          {!loadingRecommendations && popularArtworks.length === 0 && recommendedArtists.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptyTitle}>Search Verro</Text>
              <Text style={styles.emptyText}>
                Find amazing art and discover talented artists
              </Text>
            </View>
          )}
        </ScrollView>
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

        {/* Filter and Sort Bar - Show when there are results */}
        {((activeTab === 'artworks' && rankedArtworks.length > 0) || (activeTab === 'artists' && artists.length > 0)) && (
          <View style={styles.filterSortBar}>
            {activeTab === 'artists' && (
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilters(true)}
              >
                <Ionicons name="options-outline" size={20} color={colors.text.primary} />
                <Text style={styles.filterButtonText}>Filters</Text>
                {Object.keys(filters).length > 0 && <View style={styles.filterBadge} />}
              </TouchableOpacity>
            )}
            {activeTab === 'artworks' && (
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => {
                  // Cycle through sort options
                  const sortOptions = ['relevance', 'recent', 'popular'];
                  const currentIndex = sortOptions.indexOf(sortBy);
                  const nextIndex = (currentIndex + 1) % sortOptions.length;
                  setSortBy(sortOptions[nextIndex]);
                }}
              >
                <Ionicons name="swap-vertical-outline" size={20} color={colors.text.primary} />
                <Text style={styles.sortButtonText}>
                  {sortBy === 'relevance' && 'Most Relevant'}
                  {sortBy === 'recent' && 'Most Recent'}
                  {sortBy === 'popular' && 'Most Popular'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : activeTab === 'artworks' && rankedArtworks.length > 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.searchResultsContainer}
            >
              <View style={styles.masonryContainer}>
                {/* Left Column */}
                <View style={styles.masonryColumn}>
                  {rankedArtworks.filter((_, index) => index % 2 === 0).map((artwork, index) => (
                    <View key={artwork.id}>
                      {renderArtwork({ item: artwork, index: index * 2 })}
                    </View>
                  ))}
                </View>
                {/* Right Column */}
                <View style={styles.masonryColumn}>
                  {rankedArtworks.filter((_, index) => index % 2 === 1).map((artwork, index) => (
                    <View key={artwork.id}>
                      {renderArtwork({ item: artwork, index: index * 2 + 1 })}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          ) : activeTab === 'artists' && artists.length > 0 ? (
            <FlatList
              key="artists-list"
              data={artists}
              renderItem={renderArtist}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            renderEmpty()
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
  // Pinterest-style discovery sections
  discoveryContainer: {
    flex: 1,
  },
  discoveryContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  discoverySection: {
    marginBottom: spacing.xl + spacing.md,
  },
  discoverySectionTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    letterSpacing: -0.5,
  },
  centeredSectionTitle: {
    textAlign: 'center',
  },
  // Pinterest-style masonry layout (2 columns with staggered heights)
  masonryContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  masonryColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  categoryTile: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
    marginBottom: 0,
  },
  categoryTileImage: {
    width: '100%',
    height: '100%',
  },
  categoryTileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md + 4,
    justifyContent: 'flex-end',
  },
  categoryTileText: {
    ...typography.h3,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  discoveryLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xxl * 3,
  },
  searchResultsContainer: {
    paddingBottom: spacing.xxl,
  },
  // Homepage-style search result cards
  searchArtworkCard: {
    width: '100%',
    marginBottom: spacing.md,
  },
  searchArtworkImage: {
    width: '100%',
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  searchArtworkInfo: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  searchTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  searchArtworkTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.xs,
  },
  searchMenuButton: {
    padding: 2,
  },
  searchArtistName: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  relatedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  relatedTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  relatedTagText: {
    ...typography.tiny,
    color: colors.text.secondary,
    fontSize: 11,
  },
  // Filter and Sort Bar
  filterSortBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  filterButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 14,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
  },
  sortButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 14,
  },
});
