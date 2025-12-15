import { useState, useEffect, useCallback, useRef } from 'react';
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
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Link, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { showAlert } from '../../components/StyledAlert';
import { useFeedStore, useBoardStore, useAuthStore, useProfileStore } from '../../store';
import { colors, spacing, typography, borderRadius, shadows, DEFAULT_AVATAR } from '../../constants/theme';
import SearchModal from '../../components/SearchModal';
import StylePreferenceQuiz from '../../components/StylePreferenceQuiz';
import ArtistFilters from '../../components/ArtistFilters';
import CreateBoardModal from '../../components/CreateBoardModal';

const { width, height } = Dimensions.get('window');
const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;
const SPACING = width < 400 ? 3 : 4; // Tighter spacing on smaller screens
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (width - (NUM_COLUMNS + 1) * SPACING) / NUM_COLUMNS;
const IS_SMALL_SCREEN = width < 400;
const IS_VERY_SMALL_SCREEN = width < 380;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    artworks,
    fetchArtworks,
    reset,
    hasMore,
    isLoading,
    updateArtworkLikeCount,
    likedArtworks,
    setLikedArtwork,
    loadLikedArtworks: loadLikedArtworksFromStore,
    likedArtworksLoaded,
  } = useFeedStore();
  const { boards, fetchBoards, saveArtworkToBoard, createBoard } = useBoardStore();
  const { token, user: currentUser } = useAuthStore();
  const { profile: userProfile } = useProfileStore();
  const isArtist = currentUser?.user_type === 'artist';
  const [refreshing, setRefreshing] = useState(false);
  const [columns, setColumns] = useState([[], []]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedArtwork, setSelectedArtwork] = useState(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardIsPublic, setNewBoardIsPublic] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showStyleQuiz, setShowStyleQuiz] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDiscoverArtists, setShowDiscoverArtists] = useState(false);
  const [discoverArtists, setDiscoverArtists] = useState([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [artistFilters, setArtistFilters] = useState({});
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' or 'foryou'
  const [artStyles, setArtStyles] = useState([]);
  const [curatedStyles, setCuratedStyles] = useState([]); // Styles from quiz preferences
  const [selectedStyleFilter, setSelectedStyleFilter] = useState(null);
  const [loadingStyles, setLoadingStyles] = useState(false);
  const [styleSections, setStyleSections] = useState([]); // Organized sections
  const [suggestedArtists, setSuggestedArtists] = useState([]);
  const [loadingSuggestedArtists, setLoadingSuggestedArtists] = useState(false);
  const [forYouArtworks, setForYouArtworks] = useState([]);
  const [forYouPage, setForYouPage] = useState(1);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouHasMore, setForYouHasMore] = useState(true);
  const [sortOption, setSortOption] = useState('personalized'); // 'personalized', 'recent', 'trending', 'most_liked'
  const [showSortFilterModal, setShowSortFilterModal] = useState(false);
  const scrollViewRef = useRef(null);
  const loadingRef = useRef(false);
  const lastFocusTimeRef = useRef(0);
  const lastTapRef = useRef({});
  const heartAnimationRef = useRef({});
  const heartScaleAnims = useRef({});
  const heartOpacityAnims = useRef({});
  const [heartAnimations, setHeartAnimations] = useState({});
  const [avatarKey, setAvatarKey] = useState(0);
  const exploreOpacity = useRef(new Animated.Value(1)).current;
  const forYouOpacity = useRef(new Animated.Value(0)).current;
  const exploreTranslateY = useRef(new Animated.Value(0)).current;
  const forYouTranslateY = useRef(new Animated.Value(20)).current;

  // Load liked artworks from shared store
  const loadLikedArtworks = useCallback(async (forceReload = false) => {
    if ((likedArtworksLoaded && !forceReload) || !token || loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      await loadLikedArtworksFromStore(boards, token, forceReload);
    } catch (error) {
      if (error.response?.status !== 429) {
        console.error('Error loading liked artworks:', error);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [boards, token, likedArtworksLoaded, loadLikedArtworksFromStore]);

  // Load liked artworks when boards are available
  useEffect(() => {
    if (token && boards.length > 0) {
      loadLikedArtworks(false);
    }
  }, [token, boards.length]);

  // Style categories mapping
  const styleCategories = {
    'Character Art': ['Anime', 'Manga', 'Chibi', 'Kemono', 'Furry', 'Realism', 'Semi-Realistic', 'Cartoon', 'Disney Style', 'Pixar Style', 'Western Cartoon', 'Anime Realistic', 'Kawaii', 'Moe'],
    'Traditional Art': ['Watercolor', 'Oil Painting', 'Acrylic', 'Gouache', 'Pastel', 'Charcoal', 'Pencil', 'Ink', 'Pen & Ink', 'Marker', 'Colored Pencil'],
    'Digital Art': ['Digital Painting', 'Digital Art', 'Vector', 'Pixel Art', 'Low Poly', 'Isometric', 'Flat Design', 'Gradient Art', 'Glitch Art', 'Vaporwave', 'Synthwave'],
    '3D Art': ['3D Modeling', '3D Rendering', '3D Character', 'Sculpture', 'Blender', 'ZBrush'],
    'Illustration': ['Illustration', 'Concept Art', 'Character Design', 'Portrait', 'Landscape', 'Still Life', 'Architectural', 'Technical Drawing', 'Medical Illustration', 'Botanical'],
    'Genres': ['Fantasy', 'Sci-Fi', 'Horror', 'Cyberpunk', 'Steampunk', 'Medieval', 'Victorian', 'Gothic', 'Dark Fantasy', 'Post-Apocalyptic', 'Space', 'Nature', 'Animal', 'Pet Portrait'],
    'Abstract & Modern': ['Abstract', 'Minimalist', 'Surrealism', 'Impressionism', 'Expressionism', 'Pop Art', 'Art Deco', 'Art Nouveau', 'Cubism', 'Modern Art', 'Contemporary'],
    'Specialized': ['Logo Design', 'Typography', 'Calligraphy', 'Graffiti', 'Tattoo Design', 'Comic Book', 'Webtoon', 'Manhwa', 'Manhua', 'NSFW', 'SFW'],
    'Techniques': ['Cell Shading', 'Soft Shading', 'Hard Shading', 'Painterly', 'Sketch', 'Rendered', 'Monochrome', 'Full Color'],
    'Cultural': ['Japanese', 'Chinese', 'Korean', 'Western', 'European', 'American']
  };

  // Organize styles into sections
  const organizeStylesIntoSections = (allStyles, preferredStyleIds = [], preferredWeights = {}) => {
    const sections = [];
    
    Object.entries(styleCategories).forEach(([categoryName, styleNames]) => {
      const categoryStyles = allStyles.filter(style => 
        styleNames.some(name => style.name === name || style.name.toLowerCase().includes(name.toLowerCase()))
      );
      
      if (categoryStyles.length > 0) {
        // Separate preferred and non-preferred styles
        const preferred = categoryStyles.filter(s => preferredStyleIds.includes(s.id));
        const others = categoryStyles.filter(s => !preferredStyleIds.includes(s.id));
        
        // Sort preferred by weight
        preferred.sort((a, b) => {
          const aWeight = preferredWeights[a.id] || 0;
          const bWeight = preferredWeights[b.id] || 0;
          return bWeight - aWeight;
        });
        
        // Sort others alphabetically
        others.sort((a, b) => a.name.localeCompare(b.name));
        
        sections.push({
          name: categoryName,
          styles: [...preferred, ...others],
          hasPreferred: preferred.length > 0
        });
      }
    });
    
    // Put sections with preferred styles first
    sections.sort((a, b) => {
      if (a.hasPreferred && !b.hasPreferred) return -1;
      if (!a.hasPreferred && b.hasPreferred) return 1;
      return 0;
    });
    
    return sections;
  };

  // Load art styles and curate based on quiz preferences (for both clients and artists)
  useEffect(() => {
    const loadArtStyles = async () => {
      setLoadingStyles(true);
      try {
        // Load all styles (works without token)
        const stylesResponse = await axios.get(`${API_URL}/artists/styles/list`);
        const allStyles = stylesResponse.data.styles || stylesResponse.data || [];
        
        // Load user's style preferences if logged in (works for both clients and artists)
        let preferredStyleIds = [];
        let preferredWeights = {};
        
        if (token) {
          try {
            const prefsResponse = await axios.get(`${API_URL}/artists/preferences/quiz`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (prefsResponse.data && prefsResponse.data.preferred_styles?.length > 0) {
              preferredStyleIds = prefsResponse.data.preferred_styles.map(p => p.style_id || p);
              prefsResponse.data.preferred_styles.forEach(pref => {
                const styleId = pref.style_id || pref;
                preferredWeights[styleId] = pref.weight || 0;
              });
              
              const preferredStyles = allStyles.filter(s => preferredStyleIds.includes(s.id));
              // Sort preferred styles by weight (highest first)
              preferredStyles.sort((a, b) => {
                const aWeight = preferredWeights[a.id] || 0;
                const bWeight = preferredWeights[b.id] || 0;
                return bWeight - aWeight;
              });
              setCuratedStyles(preferredStyles);
            } else {
              setCuratedStyles([]);
            }
          } catch (prefError) {
            // No preferences set
            setCuratedStyles([]);
          }
        } else {
          setCuratedStyles([]);
        }
        
        // Organize styles into sections
        const sections = organizeStylesIntoSections(allStyles, preferredStyleIds, preferredWeights);
        setStyleSections(sections);
        
        // Keep flat list for backward compatibility
        const preferredStyles = allStyles.filter(s => preferredStyleIds.includes(s.id));
        const otherStyles = allStyles.filter(s => !preferredStyleIds.includes(s.id));
        preferredStyles.sort((a, b) => {
          const aWeight = preferredWeights[a.id] || 0;
          const bWeight = preferredWeights[b.id] || 0;
          return bWeight - aWeight;
        });
        setArtStyles([...preferredStyles, ...otherStyles]);
      } catch (error) {
        console.error('Error loading art styles:', error);
        setArtStyles([]);
        setCuratedStyles([]);
        setStyleSections([]);
      } finally {
        setLoadingStyles(false);
      }
    };
    loadArtStyles();
  }, [token]);

  // Load suggested artists for "Artists you might like" cards
  useEffect(() => {
    const loadSuggestedArtists = async () => {
      if (!token || isArtist || artworks.length === 0) return;
      
      setLoadingSuggestedArtists(true);
      try {
        const response = await axios.get(`${API_URL}/artists/matches/smart?limit=6`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuggestedArtists(response.data.artists || []);
      } catch (error) {
        console.error('Error loading suggested artists:', error);
      } finally {
        setLoadingSuggestedArtists(false);
      }
    };
    
    // Load after a delay to not interfere with initial feed load
    const timer = setTimeout(loadSuggestedArtists, 1000);
    return () => clearTimeout(timer);
  }, [token, isArtist, artworks.length]);

  // Handle style filter selection
  const handleStyleFilterSelect = useCallback((styleId) => {
    if (selectedStyleFilter === styleId) {
      // Deselect - go back to "All"
      setSelectedStyleFilter(null);
      setArtistFilters({});
      setShowDiscoverArtists(false);
      setDiscoverArtists([]);
    } else {
      // Select - replace any existing style filter
      setSelectedStyleFilter(styleId);
      const newFilters = {
        ...artistFilters,
        styles: [styleId] // Only one style at a time
      };
      setArtistFilters(newFilters);
      loadFilteredArtists(newFilters);
    }
  }, [selectedStyleFilter, artistFilters]);

  // Load filtered artists
  const loadFilteredArtists = useCallback(async (filters = null) => {
    const currentFilters = filters || artistFilters;
    if (Object.keys(currentFilters).length === 0) {
      setDiscoverArtists([]);
      setShowDiscoverArtists(false);
      return;
    }

    setLoadingArtists(true);
    setShowDiscoverArtists(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      
      if (currentFilters.styles?.length > 0) {
        params.append('styles', currentFilters.styles.join(','));
      }
      if (currentFilters.price_min !== undefined) {
        params.append('price_min', currentFilters.price_min);
      }
      if (currentFilters.price_max !== undefined) {
        params.append('price_max', currentFilters.price_max);
      }
      if (currentFilters.turnaround_max !== undefined) {
        params.append('turnaround_max', currentFilters.turnaround_max);
      }
      if (currentFilters.language) {
        params.append('language', currentFilters.language);
      }

      const response = await axios.get(`${API_URL}/artists?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setDiscoverArtists(response.data.artists || []);
    } catch (error) {
      console.error('Error loading filtered artists:', error);
      setDiscoverArtists([]);
    } finally {
      setLoadingArtists(false);
    }
  }, [artistFilters, token]);

  const handleApplyFilters = (newFilters) => {
    setArtistFilters(newFilters);
    loadFilteredArtists(newFilters);
  };

  // Load For You artworks - using personalized algorithm
  const loadForYouArtworks = useCallback(async (reset = false) => {
    if (loadingRef.current || forYouLoading || (!reset && !forYouHasMore)) return;
    
    loadingRef.current = true;
    setForYouLoading(true);
    
    // Reset page state if resetting
    if (reset) {
      setForYouPage(1);
    }
    
    const currentPage = reset ? 1 : forYouPage;
    
    if (!token) {
      // If not logged in, fall back to regular feed
      try {
        const response = await axios.get(`${API_URL}/artworks`, {
          params: { page: currentPage, limit: 20 }
        });
        const newArtworks = response.data.artworks || response.data.data || [];
        const pagination = response.data.pagination || response.data;
        const hasMore = pagination?.page < pagination?.totalPages || 
                       (pagination?.hasMore !== false && newArtworks.length === 20);
        
        setForYouArtworks(prev => reset ? newArtworks : [...prev, ...newArtworks]);
        if (!reset) {
          setForYouPage(currentPage + 1);
        } else {
          setForYouPage(2);
        }
        setForYouHasMore(hasMore);
      } catch (error) {
        console.error('Error loading artworks:', error);
        setForYouHasMore(false);
      } finally {
        setForYouLoading(false);
        loadingRef.current = false;
      }
      return;
    }

    try {
      // Use personalized feed endpoint
      const response = await axios.get(`${API_URL}/artworks/personalized/feed`, {
        params: { page: currentPage, limit: 20 },
        headers: { Authorization: `Bearer ${token}` }
      });

      let newArtworks = response.data.artworks || response.data.data || [];
      
      // If personalized feed returns empty, fall back to regular feed immediately
      if (newArtworks.length === 0 && reset) {
        console.log('Personalized feed empty, falling back to regular feed');
        const fallbackResponse = await axios.get(`${API_URL}/artworks`, {
          params: { page: currentPage, limit: 20 },
          headers: { Authorization: `Bearer ${token}` }
        });
        newArtworks = fallbackResponse.data.artworks || fallbackResponse.data.data || [];
      }
      
      // Handle different response formats
      const pagination = response.data.pagination || response.data;
      const hasMore = pagination?.page < pagination?.totalPages || 
                     (pagination?.hasMore !== false && newArtworks.length === 20);

      setForYouArtworks(prev => reset ? newArtworks : [...prev, ...newArtworks]);
      if (!reset) {
        setForYouPage(currentPage + 1);
      } else {
        setForYouPage(2);
      }
      setForYouHasMore(hasMore);
    } catch (error) {
      if (error.response?.status !== 429) {
        console.error('Error loading for you artworks:', error);
        // Fallback to regular feed if personalized fails
        try {
          const fallbackResponse = await axios.get(`${API_URL}/artworks`, {
            params: { page: currentPage, limit: 20 },
            headers: { Authorization: `Bearer ${token}` }
          });
          const newArtworks = fallbackResponse.data.artworks || fallbackResponse.data.data || [];
          const pagination = fallbackResponse.data.pagination || fallbackResponse.data;
          const hasMore = pagination?.page < pagination?.totalPages || 
                         (pagination?.hasMore !== false && newArtworks.length === 20);
          
          setForYouArtworks(prev => reset ? newArtworks : [...prev, ...newArtworks]);
          if (!reset) {
            setForYouPage(currentPage + 1);
          } else {
            setForYouPage(2);
          }
          setForYouHasMore(hasMore);
        } catch (fallbackError) {
          console.error('Fallback feed also failed:', fallbackError);
          setForYouHasMore(false);
        }
      } else {
        // Rate limited - don't change state
        setForYouHasMore(false);
      }
    } finally {
      setForYouLoading(false);
      loadingRef.current = false;
    }
  }, [forYouPage, token]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFocusTimeRef.current < 2000) {
        return;
      }
      lastFocusTimeRef.current = now;

      const refreshData = async () => {
        if (loadingRef.current) return;
        
        try {
          if (activeTab === 'explore') {
            if (artworks.length === 0) {
              await fetchArtworks(true, sortOption);
            }
          } else {
            if (forYouArtworks.length === 0) {
              await loadForYouArtworks(true);
            }
          }
          if (boards.length === 0) {
            await fetchBoards();
          }
          
          // Reload liked artworks when screen comes into focus to sync with artwork view page
          // Use merge strategy to avoid losing recently liked artworks
          if (token && boards.length > 0) {
            setTimeout(() => {
              loadLikedArtworksFromStore(boards, token, true).catch(() => {}); // Force reload to sync (but will merge)
            }, 2000); // Longer delay to ensure backend has committed
          }
        } catch (error) {
          // Handle 401 errors gracefully - token might be expired
          if (error.response?.status === 401) {
            console.log('Token expired or invalid during refresh, will be handled by interceptor');
            // Don't log as error - the auth interceptor will handle it
            return;
          }
          if (error.response?.status !== 429) {
            console.error('Error refreshing data:', error);
          }
        }
      };
      refreshData();
    }, [activeTab, loadForYouArtworks, artworks.length, forYouArtworks.length, boards.length, token])
  );

  useEffect(() => {
    fetchArtworks(true, sortOption);
    fetchBoards();
  }, [sortOption]);

  // Handle sort change
  const handleSortChange = (newSort) => {
    setSortOption(newSort);
    setShowSortFilterModal(false);
  };

  // Load liked artworks when boards are loaded
  useEffect(() => {
    if (token && boards.length > 0 && !likedArtworksLoaded) {
      loadLikedArtworks();
    }
  }, [boards, token, likedArtworksLoaded, loadLikedArtworks]);

  // Handle tab change
  useEffect(() => {
    if (activeTab === 'foryou' && forYouArtworks.length === 0 && !loadingRef.current) {
      loadForYouArtworks(true);
    }
  }, [activeTab, forYouArtworks.length, loadForYouArtworks]);

  // Load current user profile for header avatar
  useEffect(() => {
    if (currentUser?.id && token) {
      const prevAvatarUrl = userProfile?.avatar_url || currentUser?.avatar_url;
      useProfileStore.getState().fetchProfile(currentUser.id, token).then(() => {
        // Check if avatar changed
        const newProfile = useProfileStore.getState().profile;
        const newAvatarUrl = newProfile?.avatar_url || currentUser?.avatar_url;
        if (prevAvatarUrl !== newAvatarUrl) {
          setAvatarKey(prev => prev + 1);
        }
      });
    }
  }, [currentUser?.id, token, currentUser?.avatar_url]); // Refresh when avatar changes
  
  // Watch for avatar URL changes to update key
  useEffect(() => {
    if (userProfile?.avatar_url || currentUser?.avatar_url) {
      setAvatarKey(prev => prev + 1);
    }
  }, [userProfile?.avatar_url, currentUser?.avatar_url]);


  // Also refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (currentUser?.id && token) {
        useProfileStore.getState().fetchProfile(currentUser.id, token);
      }
    }, [currentUser?.id, token])
  );


  // Organize artworks into balanced columns (Pinterest masonry style) with suggested artist cards
  useEffect(() => {
    if (artworks.length > 0) {
      const newColumns = [[], []];
      const columnHeights = [0, 0];
      let artworkIndex = 0;
      const INSERT_INTERVAL = 8; // Insert suggested card every 8 artworks

      artworks.forEach((item) => {
        // Calculate image height based on aspect ratio if available
        let imageHeight;
        const ratio = item.aspect_ratio || item.aspectRatio; // Handle both snake_case and camelCase

        if (ratio && typeof ratio === 'string' && ratio.includes(':')) {
          const parts = ratio.split(':');
          const w = parseFloat(parts[0]);
          const h = parseFloat(parts[1]);

          // Ensure valid numbers
          if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
            imageHeight = ITEM_WIDTH * (h / w);
          } else {
            // Use default 4:5 ratio if invalid
            imageHeight = ITEM_WIDTH * 1.25;
          }
        } else {
          // Use default 4:5 ratio for artworks without aspect ratio
          imageHeight = ITEM_WIDTH * 1.25;
        }

        const textHeight = 60; // Space for title + artist name below image
        const totalHeight = imageHeight + textHeight;

        // Add to the shorter column
        const shortestColumnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;

        newColumns[shortestColumnIndex].push({
          ...item,
          imageHeight,
          totalHeight,
          type: 'artwork',
        });

        columnHeights[shortestColumnIndex] += totalHeight + SPACING;
        artworkIndex++;

        // Insert suggested artist card every N artworks
        if (artworkIndex % INSERT_INTERVAL === 0 && suggestedArtists.length > 0 && !isArtist && token) {
          const suggestedCardHeight = 180; // Approximate height of suggested card
          const shortestCol = columnHeights[0] <= columnHeights[1] ? 0 : 1;
          
          newColumns[shortestCol].push({
            type: 'suggested_artists',
            id: `suggested-${artworkIndex}`,
            artists: suggestedArtists.slice(0, 3), // Show 3 artists per card
            totalHeight: suggestedCardHeight,
          });
          
          columnHeights[shortestCol] += suggestedCardHeight + SPACING;
        }
      });

      setColumns(newColumns);
    }
  }, [artworks, suggestedArtists, isArtist, token]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    reset();
    await fetchArtworks(true, sortOption);
    setRefreshing(false);
  }, [sortOption]);

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
      // saveArtworkToBoard already updates the local state
      await saveArtworkToBoard(board.id, selectedArtwork.id);

      // Close modal first
      setShowSaveModal(false);
      setShowCreateBoard(false);
      setNewBoardName('');

      // Small delay to ensure modal is closed before showing alert
      setTimeout(() => {
        showAlert({
          title: 'Saved!',
          message: `Added to ${board.name}`,
          type: 'success',
        });
      }, 100);
    } catch (error) {
      console.error('Error saving artwork to board:', error);
      
      // Close modal immediately
      setShowSaveModal(false);
      setShowCreateBoard(false);
      setNewBoardName('');
      
      // Extract error message from various possible locations
      let errorMessage = 'Failed to save artwork';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Small delay to ensure modal is closed before showing alert
      setTimeout(() => {
        showAlert({
          title: 'Error',
          message: errorMessage,
          type: 'error',
          duration: 3000,
        });
      }, 150);
    }
  };

  const handleCreateAndSave = async () => {
    if (!newBoardName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Board name is required',
        type: 'error',
      });
      return;
    }

    try {
      // createBoard adds the board to local state
      const newBoard = await createBoard({ name: newBoardName.trim() });
      // saveArtworkToBoard updates the board count in local state
      await saveArtworkToBoard(newBoard.id, selectedArtwork.id);

      setShowCreateBoard(false);
      setShowSaveModal(false);
      setNewBoardName('');
      showAlert({
        title: 'Success!',
        message: `Created "${newBoardName}" and saved artwork`,
        type: 'success',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to create board',
        visibilityTime: 3000,
      });
    }
  };

  // Handle create board from modal (used by CreateBoardModal)
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      showAlert({
        title: 'Error',
        message: 'Board name is required',
        type: 'error',
      });
      return;
    }

    try {
      // Create the board
      const newBoard = await createBoard({
        name: newBoardName.trim(),
        is_public: newBoardIsPublic,
        board_type: 'general',
      });

      // If we have a selected artwork (from save modal), save it to the new board
      if (selectedArtwork) {
        await saveArtworkToBoard(newBoard.id, selectedArtwork.id);
      }

      // Close modals and reset state
      setShowCreateBoard(false);
      setShowSaveModal(false);
      setNewBoardName('');
      setNewBoardIsPublic(false);

      showAlert({
        title: 'Success!',
        message: selectedArtwork
          ? `Created "${newBoardName}" and saved artwork`
          : `Created "${newBoardName}"`,
        type: 'success',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.error || 'Failed to create board',
        visibilityTime: 3000,
      });
    }
  };

  // Handle like artwork (optimistic update)
  const handleLikeArtwork = async (artwork) => {
    if (!token) {
      showAlert({
        title: 'Login Required',
        message: 'Please login to like artworks',
        type: 'info',
      });
      return;
    }

    const artworkId = String(artwork.id);
    const currentLikedState = likedArtworksLoaded ? likedArtworks.has(artworkId) : false;
    const previousLikedState = currentLikedState;
    const previousLikeCount = artwork.like_count || 0;
    const newLikedState = !currentLikedState;

    // Optimistic update - use shared store immediately
    setLikedArtwork(artwork.id, newLikedState);

    // Update local artwork like count optimistically
    if (updateArtworkLikeCount) {
      updateArtworkLikeCount(artwork.id, newLikedState ? previousLikeCount + 1 : Math.max(0, previousLikeCount - 1));
    }

    // Force UI update by updating local state
    if (!likedArtworksLoaded) {
      // If liked artworks haven't loaded yet, ensure they're loaded
      loadLikedArtworks(true);
    }

    try {
      // Always call /like endpoint - it toggles automatically
      const response = await axios.post(`${API_URL}/artworks/${artwork.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Home Like API Response:', response.data);
      
      // The backend returns: { message: 'Artwork liked' or 'Artwork unliked', likeCount: number }
      const message = response.data.message || '';
      const newLikeCount = response.data.likeCount ?? previousLikeCount;
      // Message is either "Artwork liked" or "Artwork unliked"
      const isNowLiked = message === 'Artwork liked';
      
      console.log('Home Setting liked state:', { artworkId: artwork.id, isNowLiked, message, newLikeCount });
      
      // Update like count from response
      if (response.data.likeCount !== undefined && updateArtworkLikeCount) {
        updateArtworkLikeCount(artwork.id, response.data.likeCount);
      }
      
      // Update shared store with authoritative backend response
      setLikedArtwork(artwork.id, isNowLiked);
      
      // Refresh liked artworks list to ensure UI updates
      if (isNowLiked) {
        loadLikedArtworks(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Rollback optimistic update in shared store
      setLikedArtwork(artwork.id, previousLikedState);
      
      // Rollback like count
      if (updateArtworkLikeCount) {
        updateArtworkLikeCount(artwork.id, previousLikeCount);
      }
    }
  };

  const renderSuggestedArtistsCard = (item) => {
    if (!item.artists || item.artists.length === 0) return null;
    
    return (
      <View key={item.id} style={styles.suggestedArtistCard}>
        {/* Header */}
        <View style={styles.suggestedArtistHeader}>
          <Text style={styles.suggestedArtistTitle}>Artists you might like</Text>
          <Text style={styles.suggestedArtistSubtitle}>Based on your preferences</Text>
        </View>

        {/* Artist Cards - Simple horizontal scroll */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedArtistScrollContent}
        >
          {item.artists.slice(0, 4).map((artist) => {
            if (!artist || !artist.id) return null;
            
            const avatarUrl = artist.users?.avatar_url || DEFAULT_AVATAR;
            const artistUsername = artist.users?.username || 'Artist';
            const rating = typeof artist.rating === 'number' ? artist.rating : 0;
            
            return (
              <TouchableOpacity
                key={artist.id}
                style={styles.suggestedArtistCardItem}
                onPress={() => router.push(`/artist/${artist.id}`)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.suggestedArtistAvatar}
                  contentFit="cover"
                />
                <Text style={styles.suggestedArtistName} numberOfLines={1}>
                  @{artistUsername}
                </Text>
                {rating > 0 && (
                  <View style={styles.suggestedArtistRating}>
                    <Ionicons name="star" size={12} color={colors.status.warning} />
                    <Text style={styles.suggestedArtistRatingText}>
                      {rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderArtwork = (item, showLikeButton = false) => {
    // Handle suggested artists card
    if (item.type === 'suggested_artists') {
      return renderSuggestedArtistsCard(item);
    }
    
    // Always check current state from store for immediate updates
    const currentLikedState = useFeedStore.getState().likedArtworks;
    const isLiked = currentLikedState.has(String(item.id));
    
    // Check if artwork is trending (high engagement score)
    const engagementScore = item.engagement_score || item.engagement?.engagement_score || 0;
    const isTrending = engagementScore > 50; // Threshold for trending badge

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.imageContainer}>
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
          {isTrending && (
            <View style={styles.trendingBadge}>
              <Ionicons name="flame" size={14} color={colors.text.primary} />
              <Text style={styles.trendingBadgeText}>Trending</Text>
            </View>
          )}
          {showLikeButton && token && (
            <TouchableOpacity
              style={styles.likeButtonOverlay}
              onPress={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleLikeArtwork(item);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={24}
                color={isLiked ? colors.primary : colors.text.secondary}
                style={styles.likeIcon}
              />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => handleOpenSaveMenu(item, e)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          {item.artists?.users && (
            <Text style={styles.artistName} numberOfLines={1}>
              {item.artists.users.username}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // TikTok-style full screen artwork renderer
  const renderTikTokArtwork = (item, index) => {
    // Always check current state from store for immediate updates
    const currentLikedState = useFeedStore.getState().likedArtworks;
    const isLiked = currentLikedState.has(String(item.id));
    const artworkId = String(item.id);
    const showHeartAnimation = heartAnimations[artworkId] || false;
    
    // Initialize animations for this artwork if not exists
    if (!heartScaleAnims.current[artworkId]) {
      heartScaleAnims.current[artworkId] = new Animated.Value(0);
      heartOpacityAnims.current[artworkId] = new Animated.Value(0);
    }
    
    const handleDoubleTap = () => {
      const now = Date.now();
      const DOUBLE_PRESS_DELAY = 200; // Reduced from 300ms for more sensitive double tap
      
      // Check current liked state directly from store
      const currentLikedState = useFeedStore.getState().likedArtworks;
      const currentlyLiked = currentLikedState.has(artworkId);
      
      if (lastTapRef.current[artworkId] && (now - lastTapRef.current[artworkId]) < DOUBLE_PRESS_DELAY) {
        if (!currentlyLiked && token) {
          handleLikeArtwork(item);
          
          heartScaleAnims.current[artworkId].setValue(0);
          heartOpacityAnims.current[artworkId].setValue(1);
          
          Animated.parallel([
            Animated.spring(heartScaleAnims.current[artworkId], {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.delay(400),
              Animated.timing(heartOpacityAnims.current[artworkId], {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ]),
          ]).start(() => {
            heartScaleAnims.current[artworkId].setValue(0);
            heartOpacityAnims.current[artworkId].setValue(0);
          });
          
          setHeartAnimations(prev => ({ ...prev, [artworkId]: true }));
          if (heartAnimationRef.current[artworkId]) {
            clearTimeout(heartAnimationRef.current[artworkId]);
          }
          heartAnimationRef.current[artworkId] = setTimeout(() => {
            setHeartAnimations(prev => {
              const newState = { ...prev };
              delete newState[artworkId];
              return newState;
            });
            delete heartAnimationRef.current[artworkId];
          }, 1000);
        }
        delete lastTapRef.current[artworkId];
      } else {
        lastTapRef.current[artworkId] = now;
      }
    };
    
    // Get primary artist - check both item.artist (personalized feed) and item.artists (regular feed)
    const primaryArtist =
      (Array.isArray(item.artist) && item.artist.length > 0 ? item.artist[0] : 
       typeof item.artist === 'object' && item.artist !== null ? item.artist : null) ||
      (Array.isArray(item.artists) && item.artists.length > 0 ? item.artists[0] : 
       typeof item.artists === 'object' && item.artists !== null ? item.artists : null) ||
      (Array.isArray(item.artist_user) && item.artist_user.length > 0 ? item.artist_user[0] : item.artist_user);

    const artistUser =
      primaryArtist?.users ||
      primaryArtist?.user ||
      primaryArtist ||
      item.user ||
      item.owner_user ||
      item.creator ||
      item.created_by ||
      item.owner ||
      item.uploader ||
      (item.artist_username && {
        username: item.artist_username,
        full_name: item.artist_full_name,
        avatar_url: item.artist_avatar,
      }) ||
      (typeof item.artist === 'string' && { username: item.artist });

    const artistUsername =
      item.artist_username ||
      artistUser?.username ||
      artistUser?.full_name ||
      artistUser?.name ||
      item.artist_name ||
      item.artist_username ||
      item.username ||
      item.user_name ||
      item.created_by_username ||
      item.uploader_username ||
      (artistUser ? 'artist' : null) ||
      'artist';

    const artistAvatar =
      item.artist_avatar ||
      artistUser?.avatar_url ||
      artistUser?.avatar ||
      item.uploader_avatar ||
      item.created_by_avatar ||
      item.avatar_url;
    
    // Get artist commission status - check multiple possible locations
    // Regular feed uses item.artists.commission_status
    // Personalized feed uses item.artist.commission_status (nested artist object)
    let artistCommissionStatus = null;
    
    // Check item.artist first (personalized feed structure - Supabase returns as array)
    if (item.artist) {
      if (Array.isArray(item.artist) && item.artist.length > 0) {
        // Supabase join returns as array
        artistCommissionStatus = item.artist[0]?.commission_status;
      } else if (typeof item.artist === 'object' && item.artist !== null) {
        // Sometimes it's an object
        artistCommissionStatus = item.artist.commission_status;
      }
    }
    
    // Check item.artists (regular feed structure)
    if (!artistCommissionStatus && item.artists) {
      if (Array.isArray(item.artists) && item.artists.length > 0) {
        artistCommissionStatus = item.artists[0]?.commission_status;
      } else if (typeof item.artists === 'object' && item.artists !== null) {
        artistCommissionStatus = item.artists.commission_status;
      }
    }
    
    // Check primaryArtist (derived from item.artists or item.artist)
    if (!artistCommissionStatus && primaryArtist) {
      artistCommissionStatus = primaryArtist.commission_status;
    }
    
    // Fallback to other locations if not found
    if (!artistCommissionStatus) {
      artistCommissionStatus =
        item.artist_commission_status ||
        item.commission_status ||
        'closed'; // Default to closed if not found
    }
    
    // Ensure we have a valid status (handle string "null" or "undefined")
    if (!artistCommissionStatus || 
        artistCommissionStatus === 'null' || 
        artistCommissionStatus === 'undefined' ||
        artistCommissionStatus === null ||
        artistCommissionStatus === undefined) {
      artistCommissionStatus = 'closed';
    }
    
    // Debug logging for For You page
    if (activeTab === 'forYou' && __DEV__) {
      console.log('Commission Status Debug:', {
        artworkId: item.id,
        artist_id: item.artist_id,
        'item.artist': item.artist,
        'item.artist[0]': Array.isArray(item.artist) ? item.artist[0] : null,
        'item.artist.commission_status': typeof item.artist === 'object' && !Array.isArray(item.artist) ? item.artist.commission_status : null,
        'item.artists': item.artists,
        'primaryArtist': primaryArtist,
        'primaryArtist.commission_status': primaryArtist?.commission_status,
        'finalStatus': artistCommissionStatus
      });
    }
    
    // Get artist stats
    const artistFollowerCount = 
      primaryArtist?.follower_count ||
      primaryArtist?.followers_count ||
      item.artist_follower_count ||
      item.followers_count ||
      null;
    
    const artistRating = 
      primaryArtist?.rating ||
      primaryArtist?.average_rating ||
      item.artist_rating ||
      item.average_rating ||
      null;
    
    // Get verification status
    const isVerified = 
      primaryArtist?.is_verified ||
      primaryArtist?.verified ||
      artistUser?.is_verified ||
      artistUser?.verified ||
      item.is_verified ||
      item.verified ||
      item.artist_is_verified ||
      item.artist_verified ||
      false;
    
    console.log('Verification Status:', {
      primaryArtist: primaryArtist?.is_verified || primaryArtist?.verified,
      artistUser: artistUser?.is_verified || artistUser?.verified,
      item: item.is_verified || item.verified,
      final: isVerified
    });
    
    console.log('Artist Commission Status:', {
      primaryArtist: primaryArtist?.commission_status,
      item_artist: item.artist_commission_status,
      item: item.commission_status,
      final: artistCommissionStatus
    });
    
    return (
      <View style={styles.tikTokCard}>
        <View style={styles.tikTokImageWrapper}>
          <TouchableOpacity
            style={styles.tikTokImageContainer}
            activeOpacity={1}
            onPress={handleDoubleTap}
          >
            <Image
              source={{ uri: item.image_url || item.thumbnail_url }}
              style={styles.tikTokImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              priority="high"
            />
            {showHeartAnimation && (
              <Animated.View 
                style={[
                  styles.heartAnimation,
                  {
                    transform: [{ scale: heartScaleAnims.current[artworkId] }],
                    opacity: heartOpacityAnims.current[artworkId],
                  }
                ]}
              >
                <Ionicons name="heart" size={100} color={colors.primary} />
              </Animated.View>
            )}
            
            {/* Top badges - removed */}
          </TouchableOpacity>
        </View>
        
        {/* Artist Profile Card */}
        <View style={styles.tikTokProfileCard}>
          <TouchableOpacity
            onPress={() => router.push(`/artist/${item.artist_id}`)}
            style={styles.tikTokProfileCardContent}
            activeOpacity={0.7}
          >
            {artistAvatar ? (
              <Image
                source={{ uri: artistAvatar }}
                style={styles.tikTokAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.tikTokAvatarPlaceholder}>
                <Ionicons name="person" size={22} color={colors.text.secondary} />
              </View>
            )}
            <View style={styles.tikTokArtistText}>
              <View style={styles.tikTokArtistNameRow}>
                <Text style={styles.tikTokArtistName}>
                  @{artistUsername}
                </Text>
                <Ionicons 
                  name="checkmark-circle" 
                  size={16} 
                  color={isVerified ? colors.error : colors.text.disabled}
                  style={styles.tikTokVerifiedBadge}
                />
              </View>
              <View style={[
                styles.tikTokStatusBadge,
                artistCommissionStatus === 'open' && styles.tikTokStatusBadgeOpen,
                artistCommissionStatus === 'closed' && styles.tikTokStatusBadgeClosed,
              ]}>
                <Ionicons 
                  name={artistCommissionStatus === 'open' ? 'checkmark-circle' : 'close-circle'} 
                  size={13} 
                  color={artistCommissionStatus === 'open' ? colors.success : colors.error}
                />
                <Text style={[
                  styles.tikTokStatusBadgeText,
                  {
                    color: artistCommissionStatus === 'open' ? colors.success : colors.error
                  }
                ]}>
                  {artistCommissionStatus === 'open' ? 'Open for Commissions' : 'Closed for Commissions'}
                </Text>
              </View>
              {(artistFollowerCount !== null || artistRating !== null) && (
                <View style={styles.tikTokArtistStats}>
                  {artistRating !== null && (
                    <View style={styles.tikTokStatItem}>
                      <Ionicons name="star" size={11} color={colors.status.warning} />
                      <Text style={styles.tikTokStatText}>{artistRating.toFixed(1)}</Text>
                    </View>
                  )}
                  {artistFollowerCount !== null && artistRating !== null && (
                    <View style={styles.tikTokStatDivider} />
                  )}
                  {artistFollowerCount !== null && (
                    <View style={styles.tikTokStatItem}>
                      <Ionicons name="people" size={11} color={colors.text.secondary} />
                      <Text style={styles.tikTokStatText}>
                        {artistFollowerCount >= 1000 
                          ? `${(artistFollowerCount / 1000).toFixed(1)}K` 
                          : artistFollowerCount}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>

        {/* Bottom gradient */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)']}
          style={styles.tikTokInfoGradient}
        />

        <View style={styles.tikTokActions}>
          <TouchableOpacity
            style={styles.tikTokActionButton}
            onPress={() => {
              if (token) {
                handleLikeArtwork(item);
              } else {
                router.push('/auth/login');
              }
            }}
            disabled={false}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={32}
              color={isLiked ? colors.primary : '#FFFFFF'}
              style={{ opacity: isLiked ? 1 : 0.95 }}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.tikTokActionButton}
            onPress={() => router.push(`/artwork/${item.id}`)}
          >
            <Ionicons name="eye-outline" size={32} color={colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tikTokActionButton}
            onPress={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenSaveMenu(item, e);
            }}
          >
            <Ionicons name="bookmark-outline" size={32} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        {!isArtist && (
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.exploreButtonText}>Explore Artists</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'explore' && styles.tabActive]}
            onPress={() => {
              if (activeTab !== 'explore') {
                // Immediately hide For You tab completely
                forYouOpacity.setValue(0);
                forYouTranslateY.setValue(20);

                // Use requestAnimationFrame to ensure state update happens after render
                requestAnimationFrame(() => {
                  setActiveTab('explore');

                  // Small delay to ensure For You is fully hidden before showing Explore
                  setTimeout(() => {
                    // Animate Explore tab in
                    Animated.parallel([
                      Animated.timing(exploreOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                      Animated.timing(exploreTranslateY, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  }, 16); // One frame delay
                });
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>Explore</Text>
            {activeTab === 'explore' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'foryou' && styles.tabActive]}
            onPress={() => {
              if (activeTab !== 'foryou') {
                // Clear filters when switching to For You tab
                setArtistFilters({});
                setSelectedStyleFilter(null);
                setShowDiscoverArtists(false);
                setDiscoverArtists([]);

                // Immediately hide Explore tab completely
                exploreOpacity.setValue(0);
                exploreTranslateY.setValue(-20);

                // Use requestAnimationFrame to ensure state update happens after render
                requestAnimationFrame(() => {
                  setActiveTab('foryou');

                  // Small delay to ensure Explore is fully hidden before showing For You
                  setTimeout(() => {
                    // Animate For You tab in
                    Animated.parallel([
                      Animated.timing(forYouOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                      Animated.timing(forYouTranslateY, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  }, 16); // One frame delay
                });
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'foryou' && styles.tabTextActive]}>For you</Text>
            {activeTab === 'foryou' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowSortFilterModal(true)}
          >
            <Ionicons name="funnel-outline" size={20} color={colors.text.primary} />
            {(sortOption !== 'personalized' || Object.keys(artistFilters).length > 0) && (
              <View style={styles.filterBadge} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Ionicons name="search-outline" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {(userProfile?.avatar_url || currentUser?.avatar_url) ? (
              <Image
                source={{
                  uri: (() => {
                    const url = userProfile?.avatar_url || currentUser?.avatar_url;
                    // Add cache-busting parameter that changes when avatar updates
                    const separator = url?.includes('?') ? '&' : '?';
                    return `${url}${separator}_v=${avatarKey}`;
                  })()
                }}
                style={styles.profileAvatar}
                contentFit="cover"
                cachePolicy="none"
                key={`${userProfile?.avatar_url || currentUser?.avatar_url}-${avatarKey}`}
              />
            ) : (
              <Ionicons name="person-circle" size={22} color={colors.text.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Pinterest-style Filter Bar */}
      {artStyles.length > 0 && activeTab === 'explore' && (
        <View style={styles.pinterestFilterBar}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pinterestFilterContent}
          >
            <TouchableOpacity
              style={styles.pinterestFilterItem}
              onPress={() => {
                setSelectedStyleFilter(null);
                setArtistFilters({});
                setShowDiscoverArtists(false);
                setDiscoverArtists([]);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.pinterestFilterText,
                !selectedStyleFilter && Object.keys(artistFilters).length === 0 && styles.pinterestFilterTextActive
              ]}>
                All
              </Text>
              {!selectedStyleFilter && Object.keys(artistFilters).length === 0 && <View style={styles.pinterestFilterUnderline} />}
            </TouchableOpacity>
            {/* Show curated styles first, then others */}
            {[...curatedStyles, ...artStyles.filter(s => !curatedStyles.some(cs => cs.id === s.id))].map((style) => {
              const isSelected = selectedStyleFilter === style.id;
              const isCurated = curatedStyles.some(cs => cs.id === style.id);
              return (
                <TouchableOpacity
                  key={style.id}
                  style={styles.pinterestFilterItem}
                  onPress={() => handleStyleFilterSelect(style.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.pinterestFilterText,
                    isSelected && styles.pinterestFilterTextActive,
                    isCurated && !isSelected && styles.pinterestFilterTextCurated
                  ]}>
                    {style.name}
                  </Text>
                  {isSelected && <View style={styles.pinterestFilterUnderline} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}


      {/* Discover Artists Section */}
      {!isArtist && token && showDiscoverArtists && discoverArtists.length > 0 && (
        <View style={styles.discoverSection}>
          <View style={styles.discoverHeader}>
            <Text style={styles.discoverTitle}>Discover Artists</Text>
            <TouchableOpacity onPress={() => setShowDiscoverArtists(false)}>
              <Ionicons name="close" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          {loadingArtists ? (
            <View style={styles.discoverLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.discoverScroll}>
              {discoverArtists.map((artist) => (
                <TouchableOpacity
                  key={artist.id}
                  style={styles.discoverArtistCard}
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: artist.users?.avatar_url || 'https://via.placeholder.com/100' }}
                    style={styles.discoverArtistAvatar}
                    contentFit="cover"
                  />
                  <Text style={styles.discoverArtistName} numberOfLines={1}>
                    {artist.users?.full_name || artist.users?.username}
                  </Text>
                  <View style={styles.discoverArtistStats}>
                    <Ionicons name="star" size={12} color={colors.primary} />
                    <Text style={styles.discoverArtistRating}>
                      {artist.rating?.toFixed(1) || '0.0'}
                    </Text>
                  </View>
                  {artist.min_price && artist.max_price && (
                    <Text style={styles.discoverArtistPrice}>
                      ${artist.min_price}-${artist.max_price}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Content based on active tab */}
      <View style={{ flex: 1 }}>
        {/* Explore tab - existing masonry layout */}
        <Animated.View
          style={[
            {
              position: activeTab === 'explore' ? 'relative' : 'absolute',
              width: '100%',
              height: '100%',
              opacity: exploreOpacity,
              transform: [{ translateY: exploreTranslateY }],
              zIndex: activeTab === 'explore' ? 1 : 0,
            },
            activeTab !== 'explore' && { pointerEvents: 'none' },
          ]}
        >
          {artworks.length === 0 ? (
            renderEmpty()
          ) : (
            <ScrollView
              ref={scrollViewRef}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom, 20) + 80 }
              ]}
            >
              <View style={styles.masonryContainer}>
                {/* Left Column */}
                <View style={styles.column}>
                  {columns[0].map(item => renderArtwork(item, true))}
                </View>

                {/* Right Column */}
                <View style={styles.column}>
                  {columns[1].map(item => renderArtwork(item, true))}
                </View>
              </View>
            </ScrollView>
          )}
        </Animated.View>

        {/* For You tab - TikTok-style full screen vertical feed */}
        <Animated.View
          style={[
            {
              position: activeTab === 'foryou' ? 'relative' : 'absolute',
              width: '100%',
              height: '100%',
              opacity: forYouOpacity,
              transform: [{ translateY: forYouTranslateY }],
              zIndex: activeTab === 'foryou' ? 1 : 0,
            },
            activeTab !== 'foryou' && { pointerEvents: 'none' },
          ]}
        >
          {forYouArtworks.length === 0 && forYouLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading artworks...</Text>
            </View>
          ) : forYouArtworks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={64} color={colors.text.disabled} />
              <Text style={styles.emptyTitle}>No Artworks Yet</Text>
              <Text style={styles.emptyText}>
                Check back later for personalized recommendations!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={scrollViewRef}
              data={forYouArtworks}
              renderItem={({ item, index }) => renderTikTokArtwork(item, index)}
              keyExtractor={(item) => String(item.id)}
              pagingEnabled
              snapToInterval={height - 180}
              snapToAlignment="start"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              getItemLayout={(data, index) => ({
                length: height - 180,
                offset: (height - 180) * index,
                index,
              })}
              onEndReached={() => {
                if (!forYouLoading && forYouHasMore && !loadingRef.current) {
                  loadForYouArtworks(false);
                }
              }}
              onEndReachedThreshold={0.8}
              removeClippedSubviews={false}
              maxToRenderPerBatch={2}
              windowSize={3}
              initialNumToRender={1}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={async () => {
                    if (loadingRef.current || forYouLoading) return;
                    setRefreshing(true);
                    try {
                      await loadForYouArtworks(true);
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  tintColor={colors.primary}
                />
              }
              ListFooterComponent={
                forYouLoading ? (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </Animated.View>
      </View>

      {/* Save to Board Modal */}
      <Modal
        visible={showSaveModal}
        animationType="slide"
        transparent={true}
        style={{ zIndex: 9999 }}
        onRequestClose={() => {
          setShowSaveModal(false);
          setShowCreateBoard(false);
          setNewBoardName('');
          setNewBoardIsPublic(false);
        }}
      >
        <View style={styles.saveBoardModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <TouchableWithoutFeedback onPress={() => {
              setShowSaveModal(false);
              setShowCreateBoard(false);
              setNewBoardName('');
              setNewBoardIsPublic(false);
            }}>
              <View style={styles.saveBoardModalContent}>
                {/* Modal content goes here */}
                {/* Header with Safe Area */}
                <View style={[styles.saveBoardHeader, { paddingTop: insets.top + spacing.md }]}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowSaveModal(false);
                      setShowCreateBoard(false);
                      setNewBoardName('');
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={28} color={colors.text.primary} />
                  </TouchableOpacity>
                  <Text style={styles.saveBoardTitle}>Save to board</Text>
                  <View style={{ width: 28 }} />
                </View>

                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={{ flex: 1 }}>
                    <>
                      {/* Board List */}
                        <ScrollView
                          style={styles.saveBoardList}
                          contentContainerStyle={styles.saveBoardListContent}
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                        >
                          {boards.map((board) => {
                            const firstArtworks = board.board_artworks?.slice(0, 4) || [];
                            const artworkCount = board.board_artworks?.length || board.artworks?.[0]?.count || 0;

                            return (
                              <TouchableOpacity
                                key={board.id}
                                style={styles.saveBoardOption}
                                onPress={() => handleBoardSelect(board)}
                                activeOpacity={0.7}
                              >
                                {/* Board Thumbnail - Pinterest Grid Style */}
                                <View style={styles.saveBoardThumbnail}>
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

                                {/* Board Info */}
                                <View style={styles.saveBoardInfo}>
                                  <Text style={styles.saveBoardName} numberOfLines={1}>
                                    {board.name}
                                  </Text>
                                  <Text style={styles.saveBoardMeta}>
                                    {artworkCount} {artworkCount === 1 ? 'pin' : 'pins'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

                      </>
                  </View>
                </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Sort & Filter Modal */}
      <Modal
        visible={showSortFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSortFilterModal(false)}
      >
        <View style={styles.pinterestModalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={styles.pinterestModalContent}>
              <View style={[styles.pinterestHeader, { paddingTop: insets.top + spacing.md }]}>
                <TouchableOpacity
                  onPress={() => setShowSortFilterModal(false)}
                >
                  <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.pinterestTitle}>Sort & Filter</Text>
                <View style={{ width: 28 }} />
              </View>

              <ScrollView style={styles.pinterestBody} contentContainerStyle={styles.pinterestBodyContent} showsVerticalScrollIndicator={false}>
              {/* Sort Options */}
              <View style={styles.sortSection}>
                <Text style={styles.sortSectionTitle}>Sort By</Text>
                {[
                  { id: 'personalized', label: 'For You', icon: 'sparkles', desc: 'Personalized recommendations' },
                  { id: 'recent', label: 'Most Recent', icon: 'time', desc: 'Newest uploads first' },
                  { id: 'trending', label: 'Trending', icon: 'flame', desc: 'High engagement artworks' },
                  { id: 'most_liked', label: 'Most Liked', icon: 'heart', desc: 'Most popular artworks' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.sortOption,
                      sortOption === option.id && styles.sortOptionActive
                    ]}
                    onPress={() => handleSortChange(option.id)}
                  >
                    <View style={styles.sortOptionContent}>
                      <View style={[
                        styles.sortOptionIcon,
                        sortOption === option.id && styles.sortOptionIconActive
                      ]}>
                        <Ionicons 
                          name={option.icon} 
                          size={20} 
                          color={sortOption === option.id ? colors.text.primary : colors.text.secondary} 
                        />
                      </View>
                      <View style={styles.sortOptionText}>
                        <Text style={[
                          styles.sortOptionLabel,
                          sortOption === option.id && styles.sortOptionLabelActive
                        ]}>
                          {option.label}
                        </Text>
                        <Text style={styles.sortOptionDesc}>{option.desc}</Text>
                      </View>
                    </View>
                    {sortOption === option.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Style Filters (for all users) - Organized by Sections */}
              {token && styleSections.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.sortSectionTitle}>Filter by Style</Text>
                  
                  {/* All Styles button */}
                  <View style={styles.styleFilterGrid}>
                    <TouchableOpacity
                      style={[
                        styles.styleFilterChip,
                        !selectedStyleFilter && styles.styleFilterChipActive
                      ]}
                      onPress={() => {
                        setSelectedStyleFilter(null);
                        setShowSortFilterModal(false);
                        fetchArtworks(true, sortOption);
                      }}
                    >
                      <Text style={[
                        styles.styleFilterChipText,
                        !selectedStyleFilter && styles.styleFilterChipTextActive
                      ]}>
                        All Styles
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Sections with headers */}
                  {styleSections.map((section) => (
                    <View key={section.name} style={styles.modalStyleSection}>
                      {/* Section Header */}
                      <View style={styles.modalSectionHeader}>
                        <Text style={styles.modalSectionTitle}>{section.name}</Text>
                        {section.hasPreferred && (
                          <View style={styles.preferredBadge}>
                            <Ionicons name="star" size={10} color={colors.primary} />
                          </View>
                        )}
                      </View>
                      
                      {/* Section Styles */}
                      <View style={styles.styleFilterGrid}>
                        {section.styles.map((style) => {
                          const isSelected = selectedStyleFilter === style.id;
                          const isCurated = curatedStyles.some(cs => cs.id === style.id);
                          return (
                            <TouchableOpacity
                              key={style.id}
                              style={[
                                styles.styleFilterChip,
                                isSelected && styles.styleFilterChipActive,
                                isCurated && !isSelected && styles.styleFilterChipCurated
                              ]}
                              onPress={() => {
                                setSelectedStyleFilter(isSelected ? null : style.id);
                                setShowSortFilterModal(false);
                                fetchArtworks(true, sortOption);
                              }}
                            >
                              <Text style={[
                                styles.styleFilterChipText,
                                isSelected && styles.styleFilterChipTextActive,
                                isCurated && !isSelected && styles.styleFilterChipTextCurated
                              ]}>
                                {style.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Search Modal */}
      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />

      {!isArtist && (
        <>
          <StylePreferenceQuiz
            visible={showStyleQuiz}
            onClose={() => setShowStyleQuiz(false)}
            token={token}
            onComplete={() => {
              // Optionally refresh or navigate
            }}
          />
          <ArtistFilters
            visible={showFilters}
            onClose={() => setShowFilters(false)}
            filters={artistFilters}
            onApplyFilters={handleApplyFilters}
            token={token}
          />
        </>
      )}

      {/* Create Board Modal */}
      <CreateBoardModal
        visible={showCreateBoard}
        onClose={() => {
          setShowCreateBoard(false);
          setNewBoardName('');
          setNewBoardIsPublic(false);
        }}
        onCreateBoard={handleCreateBoard}
        boardName={newBoardName}
        setBoardName={setNewBoardName}
        isPublic={newBoardIsPublic}
        setIsPublic={setNewBoardIsPublic}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 2 + spacing.md, // Base padding, will be overridden by inline style with safe area
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, // Soft Pinterest-style shadow
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
  },
  likeButtonOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent', // No background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 0,
  },
  likeIcon: {
    textShadowColor: colors.overlayLight,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trendingBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 87, 34, 0.95)', // Keep trending badge orange
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    zIndex: 10,
    gap: spacing.xs,
  },
  trendingBadgeText: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadMoreContainer: {
    width: '100%',
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  profileButton: {
    width: IS_SMALL_SCREEN ? 36 : 38,
    height: IS_SMALL_SCREEN ? 36 : 38,
    borderRadius: IS_SMALL_SCREEN ? 18 : 19,
    overflow: 'hidden',
    backgroundColor: 'transparent', // No background
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: IS_SMALL_SCREEN ? 36 : 38,
    height: IS_SMALL_SCREEN ? 36 : 38,
    borderRadius: IS_SMALL_SCREEN ? 18 : 19,
  },
  // TikTok-style styles
  tikTokCard: {
    width: width,
    height: height - 180,
    position: 'relative',
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  tikTokImageWrapper: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    bottom: 125,
    overflow: 'hidden',
    borderRadius: 20, // Pinterest-style soft rounding
    backgroundColor: colors.surface,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, // Soft shadow
    shadowRadius: 12,
    elevation: 3,
  },
  tikTokImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  tikTokImage: {
    width: '100%',
    height: '100%',
  },
  tikTokTopBadges: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 5,
  },
  tikTokInfoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 100, // Slightly taller for better gradient
    zIndex: 1,
    borderBottomLeftRadius: 20, // Match tikTokImageWrapper
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  tikTokProfileCard: {
    position: 'absolute',
    bottom: 40,
    left: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    zIndex: 2,
    ...shadows.small,
  },
  tikTokProfileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
  },
  tikTokAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 0, // Remove border for cleaner look
  },
  tikTokAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0, // Remove border for cleaner look
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tikTokArtistText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  tikTokArtistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  tikTokArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  tikTokVerifiedBadge: {
    marginLeft: spacing.xs / 2,
  },
  tikTokStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  tikTokStatusBadgeOpen: {
    backgroundColor: colors.success + '20', // Softer tinted background
  },
  tikTokStatusBadgeClosed: {
    backgroundColor: colors.error + '20', // Softer tinted background
  },
  tikTokStatusBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600', // Pinterest-style
  },
  tikTokArtistStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
  },
  tikTokStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  tikTokStatDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  tikTokStatText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500', // Pinterest-style
  },
  tikTokActions: {
    position: 'absolute',
    right: spacing.md,
    bottom: 130,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 10,
    elevation: 10,
    pointerEvents: 'box-none',
  },
  tikTokActionButton: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    minWidth: 64,
    minHeight: 64,
    justifyContent: 'center',
    backgroundColor: 'transparent', // No background
  },
  tikTokActionLabel: {
    ...typography.caption,
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: colors.overlay,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.2,
  },
  viewCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 0,
  },
  viewCountText: {
    ...typography.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600', // Pinterest-style
  },
  commissionBadgeOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.full,
    borderWidth: 0,
  },
  commissionBadgeText: {
    ...typography.caption,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600', // Pinterest-style
  },
  textContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs - 2,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600', // Pinterest-style
    flex: 1,
    marginRight: spacing.xs,
  },
  artistName: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: '400', // Pinterest-style
  },
  menuButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.full, // Circular button
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    fontSize: 16,
    fontWeight: '400', // Pinterest-style
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingTop: IS_SMALL_SCREEN ? spacing.xxl + spacing.lg : spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 24 : 26,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '400', // Pinterest-style
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
  },
  exploreButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: IS_SMALL_SCREEN ? spacing.lg : spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, // Soft shadow
    shadowRadius: 8,
    elevation: 3,
  },
  exploreButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600', // Pinterest-style
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer Pinterest-style overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  sortFilterModal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    height: '85%',
    width: '100%',
  },
  sortFilterContent: {
    padding: spacing.lg,
  },
  sortSection: {
    marginBottom: spacing.xl,
  },
  sortSectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sortOptionActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  sortOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sortOptionIconActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sortOptionText: {
    flex: 1,
  },
  sortOptionLabel: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 16,
    fontWeight: '500', // Pinterest-style
    marginBottom: 2,
  },
  sortOptionLabelActive: {
    color: colors.text.primary,
    fontWeight: '600', // Pinterest-style
  },
  sortOptionDesc: {
    ...typography.caption,
    color: colors.text.disabled,
    fontSize: 13,
    fontWeight: '400', // Pinterest-style
  },
  filterSection: {
    marginBottom: spacing.lg,
  },
  styleFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  styleFilterChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  styleFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: 'transparent',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  styleFilterChipCurated: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
  },
  styleFilterChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500', // Pinterest-style
  },
  styleFilterChipTextActive: {
    color: colors.background,
    fontWeight: '600', // Pinterest-style
  },
  styleFilterChipTextCurated: {
    color: colors.primary,
    fontWeight: '600', // Pinterest-style
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
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: IS_SMALL_SCREEN ? spacing.md : spacing.md + 4,
    color: colors.text.primary,
    ...typography.body,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md + 4,
  },
  createBoardActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.full, // Pill shape
    backgroundColor: colors.background,
    borderWidth: 0, // Remove border for cleaner look
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text.secondary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '600', // Pinterest-style
  },
  createButton: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.full, // Pill shape
    backgroundColor: colors.primary,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 15 : 16,
    fontWeight: '600', // Pinterest-style
  },
  // Filter Sections
  // Modal Style Sections
  modalStyleSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600', // Pinterest-style
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginRight: spacing.xs,
  },
  preferredBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Pinterest-style Filter Bar
  pinterestFilterBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  pinterestFilterContent: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  pinterestFilterItem: {
    marginRight: spacing.lg,
    paddingVertical: spacing.xs - 2,
    position: 'relative',
  },
  pinterestFilterText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 15,
    fontWeight: '500', // Pinterest-style
  },
  pinterestFilterTextActive: {
    color: colors.text.primary,
    fontWeight: '600', // Pinterest-style
  },
  pinterestFilterTextCurated: {
    color: colors.primary,
  },
  pinterestFilterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  // Artists you might like card - Simple style
  suggestedArtistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.small,
  },
  suggestedArtistHeader: {
    marginBottom: spacing.md,
  },
  suggestedArtistTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 17 : 18,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.2,
    marginBottom: spacing.xs / 2,
  },
  suggestedArtistSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400', // Pinterest-style
  },
  suggestedArtistScrollContent: {
    gap: spacing.md,
  },
  suggestedArtistCardItem: {
    alignItems: 'center',
    width: IS_SMALL_SCREEN ? 80 : 90,
  },
  suggestedArtistAvatar: {
    width: IS_SMALL_SCREEN ? 64 : 72,
    height: IS_SMALL_SCREEN ? 64 : 72,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  suggestedArtistName: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: IS_SMALL_SCREEN ? 13 : 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs / 2,
  },
  suggestedArtistRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  suggestedArtistRatingText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
  // Filter styles
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeFiltersBar: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15', // Softer border
    paddingVertical: spacing.md,
  },
  filtersScroll: {
    paddingHorizontal: spacing.md,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  activeFilterText: {
    ...typography.small,
    color: colors.primary,
    fontSize: 12,
  },
  clearAllFilters: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  clearAllText: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '500', // Pinterest-style
  },
  // Discover Artists Section
  discoverSection: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15', // Softer border
    paddingVertical: spacing.lg,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  discoverTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.3,
  },
  discoverLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  discoverEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  discoverEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  discoverEmptySubtext: {
    ...typography.small,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  discoverScroll: {
    paddingLeft: spacing.md,
  },
  discoverArtistCard: {
    width: 120,
    marginRight: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  discoverArtistAvatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  discoverArtistName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  discoverArtistStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  discoverArtistRating: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 12,
  },
  discoverArtistPrice: {
    ...typography.small,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md, // Extra padding for notch
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent', // Clean Pinterest style - no background
    borderRadius: 0,
    padding: 0,
    alignItems: 'center',
    gap: spacing.xl, // Space between tabs
  },
  tab: {
    paddingHorizontal: 0,
    paddingVertical: spacing.sm,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // For underline
  },
  tabActive: {
    backgroundColor: 'transparent', // Clean Pinterest style - no background
  },
  tabText: {
    ...typography.h3,
    color: colors.text.disabled,
    fontSize: 20,
    fontWeight: '600', // Pinterest-style
    letterSpacing: -0.3,
  },
  tabTextActive: {
    color: colors.text.primary, // Dark text for active tab
    fontWeight: '700', // Pinterest-style
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.text.primary,
    borderRadius: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'transparent', // No background
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
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

  // Save to Board Modal Styles
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 24, // Pinterest-style soft rounding
    height: Dimensions.get('window').height * 0.6, // Fixed height that leaves room for keyboard
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15', // Softer border
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
    fontSize: 22,
    fontWeight: '700', // Pinterest-style
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardList: {
    maxHeight: 300,
    paddingHorizontal: spacing.lg,
  },
  boardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border + '40',
    gap: spacing.md,
  },
  boardOptionText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  createBoardSection: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '15', // Softer border
  },
  createBoardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.full, // Pill shape
    borderWidth: 0, // Remove border for cleaner look
    gap: spacing.sm,
  },
  createBoardButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontWeight: '600', // Pinterest-style
  },
  createBoardText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontWeight: '600', // Pinterest-style
  },
  createBoardForm: {
    padding: spacing.lg,
    flex: 1,
  },
  createBoardHeader: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  createBoardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  createBoardSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  createBoardInput: {
    backgroundColor: colors.background,
    borderRadius: 16, // Pinterest-style soft rounding
    padding: spacing.lg,
    color: colors.text.primary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border + '40', // Softer border
    fontSize: 16,
    marginTop: spacing.sm,
  },
  createBoardActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border + '15', // Softer border
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.full, // Pill shape
    alignItems: 'center',
    borderWidth: 0, // Remove border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cancelButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontWeight: '600', // Pinterest-style
  },
  createButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.full, // Pill shape
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  createButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '600', // Pinterest-style
  },

  // Pinterest-Style Save to Board Modal
  saveBoardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer Pinterest overlay
  },
  saveBoardModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24, // Pinterest-style soft rounding
    borderTopRightRadius: 24,
    height: '92%',
    paddingTop: spacing.lg,
  },
  saveBoardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '15', // Soft border
  },
  saveBoardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700', // Pinterest-style
    fontSize: 22,
    letterSpacing: -0.3,
  },
  saveBoardList: {
    flex: 1,
  },
  saveBoardListContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  saveBoardOption: {
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
  saveBoardThumbnail: {
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
  saveBoardInfo: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },
  saveBoardName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontSize: 17,
    fontWeight: '600', // Pinterest-style
    marginBottom: 3,
  },
  saveBoardMeta: {
    ...typography.small,
    color: colors.text.secondary,
    fontSize: 14,
    fontWeight: '400', // Pinterest-style
  },
  createNewBoardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 16, // Pinterest-style soft rounding
    backgroundColor: colors.primary + '10', // Soft tinted background
  },
  createNewBoardThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12, // Softer rounding
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0, // Remove border for cleaner look
  },
  createNewBoardText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '600', // Pinterest-style
  },

  // Pinterest-Style Modal Styles
  pinterestModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pinterestModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: '92%',
    paddingTop: spacing.md,
  },
  pinterestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  pinterestTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  pinterestSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: 13,
  },
  pinterestBody: {
    flex: 1,
  },
  pinterestBodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  pinterestFooter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border + '30',
    backgroundColor: colors.background,
  },
  pinterestSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  pinterestSubmitButtonDisabled: {
    backgroundColor: colors.text.disabled,
    opacity: 0.5,
  },
  pinterestSubmitButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pinterestFooterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pinterestSecondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinterestSecondaryButtonText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    fontSize: 15,
  },
  pinterestPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.small,
  },
  pinterestPrimaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});