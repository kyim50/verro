import { create } from 'zustand';
import axios from 'axios';
import Constants from 'expo-constants';

// Optional SecureStore import with fallback
let SecureStore = null;
try {
  // Use require with error handling
  const secureStoreModule = require('expo-secure-store');
  SecureStore = secureStoreModule.default || secureStoreModule;
} catch (e) {
  // Fallback if module not available
  console.warn('expo-secure-store not available, using fallback storage');
  SecureStore = {
    setItemAsync: async () => {},
    getItemAsync: async () => null,
    deleteItemAsync: async () => {},
  };
}

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || 
                process.env.EXPO_PUBLIC_API_URL || 
                'https://api.verrocio.com/api';

// Log API URL for debugging (first 30 chars only for security)
if (__DEV__) {
  console.log('📡 API URL configured:', API_URL ? API_URL.substring(0, 30) + '...' : 'NOT SET');
}

// Configure axios defaults
axios.defaults.timeout = 15000; // 15 second timeout for all requests
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Axios interceptor to handle 401 errors globally
// This will be set up after the store is created to avoid circular imports
let authStoreRef = null;
export const setAuthStoreRef = (store) => {
  authStoreRef = store;
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle network errors gracefully
    if (!error.response) {
      console.warn('Network error - no response from server:', error.message);
      // Don't crash on network errors, just log them
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401 && authStoreRef) {
      // Token is invalid, clear it
      try {
        const authStore = authStoreRef.getState();
        if (authStore.token) {
          console.log('401 detected, clearing invalid token...');
          await authStore.setToken(null);
          authStore.setUser(null);
        }
      } catch (clearError) {
        console.error('Error clearing token on 401:', clearError);
        // Don't crash if clearing token fails
      }
    }
    return Promise.reject(error);
  }
);

// Auth store
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: async (token) => {
    try {
      if (token) {
        await SecureStore.setItemAsync('authToken', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        try {
          await SecureStore.deleteItemAsync('authToken');
        } catch (deleteError) {
          // Ignore if item doesn't exist
          console.log('Token not found in SecureStore (already deleted)');
        }
        delete axios.defaults.headers.common['Authorization'];
      }
      set({ token, isAuthenticated: !!token });
    } catch (error) {
      console.error('Error setting token:', error);
      // Still update state even if SecureStore fails
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } else {
        delete axios.defaults.headers.common['Authorization'];
      }
      set({ token, isAuthenticated: !!token });
    }
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token, isAuthenticated: true, isLoading: false });
        return token;
      }
    } catch (error) {
      console.error('Error loading token:', error);
      // Don't crash if SecureStore fails - just continue without token
    }
    set({ isLoading: false });
    return null;
  },

  login: async (emailOrUsername, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: emailOrUsername, // Backend accepts this as email or username
        password,
      }, {
        timeout: 15000,
      });
      const { token, user } = response.data;
      await useAuthStore.getState().setToken(token);
      set({ user, isAuthenticated: true });
      // Fetch full user data including artists array
      try {
        await useAuthStore.getState().fetchUser();
      } catch (fetchError) {
        console.warn('Failed to fetch user after login, but login succeeded:', fetchError);
        // Don't fail login if fetchUser fails
      }
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error 
        || (error.code === 'ECONNABORTED' ? 'Request timed out. Please check your connection.' : 'Network error. Please check your connection.')
        || error.message 
        || 'Login failed';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  register: async (userData) => {
    try {
      // Map frontend field names to backend expected field names
      const backendData = {
        email: userData.email,
        username: userData.username,
        password: userData.password,
        fullName: userData.fullName || '',
        userType: userData.userType || 'client',
        avatar_url: userData.avatar_url || '',
      };

      console.log('Registering user with data:', { ...backendData, password: '***' });
      
      const response = await axios.post(`${API_URL}/auth/register`, backendData, {
        timeout: 15000,
      });
      const { token, user } = response.data;
      await useAuthStore.getState().setToken(token);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      console.error('Registration error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      const errorMessage = error.response?.data?.error 
        || error.response?.data?.errors?.[0]?.msg 
        || error.response?.data?.message
        || (error.code === 'ECONNABORTED' ? 'Request timed out. Please check your connection.' : 'Network error. Please check your connection.')
        || error.message 
        || 'Registration failed';
        
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  logout: async () => {
    try {
      // Clear user immediately to prevent flash
      set({ user: null, isAuthenticated: false });
      // Clear stores immediately to prevent seeing old data
      try {
        useProfileStore.getState().reset();
        useBoardStore.getState().reset();
        useFeedStore.getState().reset();
        useSwipeStore.getState().reset();
        await useAuthStore.getState().setToken(null);
      } catch (clearError) {
        console.error('Error clearing stores on logout:', clearError);
        // Don't crash - continue
      }
      // Make API call after clearing state (fire and forget)
      // Suppress 401 errors since token is already cleared
      axios.post(`${API_URL}/auth/logout`, {}, {
        timeout: 5000,
      }).catch((error) => {
        // Only log non-401 errors (401 is expected since token is cleared)
        if (error.response?.status !== 401) {
          console.error('Logout API error (non-critical):', error);
        }
      });
    } catch (error) {
      console.error('Logout error (continuing anyway):', error);
      // Ensure state is cleared even if something fails
      set({ user: null, isAuthenticated: false });
      try {
        await useAuthStore.getState().setToken(null);
      } catch (tokenError) {
        console.error('Error clearing token:', tokenError);
      }
    }
  },

  fetchUser: async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        timeout: 10000, // 10 second timeout
      });
      set({ user: response.data.user });
    } catch (error) {
      console.error('Error fetching user:', error);
      // If token is invalid (401), clear it and logout
      if (error.response?.status === 401) {
        console.log('Token invalid, clearing and logging out...');
        try {
          await useAuthStore.getState().setToken(null);
          set({ user: null, isAuthenticated: false });
        } catch (clearError) {
          console.error('Error clearing token:', clearError);
          // Don't crash if clearing token fails
        }
      }
      // Don't throw - allow app to continue without user data
    }
  },
}));

// Set up the auth store reference for the interceptor
setAuthStoreRef(useAuthStore);

// Feed store for artworks
export const useFeedStore = create((set, get) => ({
  artworks: [],
  page: 1,
  hasMore: true,
  isLoading: false,
  removedIds: [],
  likedArtworks: new Set(), // Shared liked artworks state
  likedArtworksLoaded: false,

  // Update liked artworks state
  setLikedArtwork: (artworkId, isLiked) => {
    const id = String(artworkId);
    console.log('Store: setLikedArtwork called', { artworkId: id, isLiked, currentState: Array.from(get().likedArtworks) });
    set((state) => {
      const newSet = new Set(state.likedArtworks);
      if (isLiked) {
        newSet.add(id);
        console.log('Store: Added artwork to liked set', id);
      } else {
        newSet.delete(id);
        console.log('Store: Removed artwork from liked set', id);
      }
      // Always create a new Set instance to ensure Zustand detects the change
      const updatedSet = new Set(newSet);
      console.log('Store: Updated liked artworks:', Array.from(updatedSet));
      return { likedArtworks: updatedSet };
    });
  },

  // Load liked artworks from board
  loadLikedArtworks: async (boards, token, forceReload = false) => {
    if (get().likedArtworksLoaded && !forceReload) {
      console.log('Skipping loadLikedArtworks - already loaded and not forcing reload');
      return;
    }
    
    try {
      const likedBoard = boards.find(b => b.name === 'Liked');
      if (likedBoard) {
        console.log('Loading liked artworks from board:', likedBoard.id);
        const response = await axios.get(`${API_URL}/boards/${likedBoard.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const artworkIds = response.data.board_artworks?.map(ba => String(ba.artwork_id)) || [];
        console.log('Loaded liked artworks from server:', artworkIds);
        
        // Merge with existing liked artworks instead of replacing
        // This prevents overwriting artworks that were just liked but aren't in server response yet
        const currentLiked = get().likedArtworks;
        const mergedSet = new Set([...currentLiked, ...artworkIds]);
        console.log('Merged liked artworks (current + server):', Array.from(mergedSet));
        
        set({ 
          likedArtworks: mergedSet,
          likedArtworksLoaded: true 
        });
        console.log('Store state after loading:', Array.from(get().likedArtworks));
      } else {
        console.log('No Liked board found');
        set({ likedArtworksLoaded: true });
      }
    } catch (error) {
      console.error('Error loading liked artworks:', error);
      set({ likedArtworksLoaded: true });
    }
  },

  fetchArtworks: async (reset = false, sortBy = 'personalized') => {
    if (get().isLoading || (!reset && !get().hasMore)) return;

    set({ isLoading: true });
    const page = reset ? 1 : get().page;

    try {
      // Check if user is a client (not an artist) - use personalized feed for clients
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      const isClient = token && user && user.user_type !== 'artist' && !user.artists;
      
      let response;
      const params = { page, limit: 20 };
      
      if (isClient && sortBy === 'personalized') {
        // Use personalized feed for clients
        try {
          response = await axios.get(`${API_URL}/artworks/personalized/feed`, {
            params,
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000,
          });
          // Ensure response has artworks array
          if (!response.data.artworks && Array.isArray(response.data)) {
            response.data = { artworks: response.data };
          }
          
          // If personalized feed returns empty, fall back to regular feed
          const personalizedArtworks = response.data.artworks || response.data.data || [];
          if (personalizedArtworks.length === 0 && reset) {
            console.log('Personalized feed empty, falling back to regular feed');
            response = await axios.get(`${API_URL}/artworks`, {
              params,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              timeout: 15000,
            });
          }
        } catch (personalizedError) {
          // Fallback to regular feed if personalized fails
          console.warn('Personalized feed failed, falling back to regular feed:', personalizedError);
          response = await axios.get(`${API_URL}/artworks`, {
            params,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 15000,
          });
        }
      } else {
        // Use regular feed with sorting
        if (sortBy === 'recent') {
          params.sort = 'created_at';
          params.order = 'desc';
        } else if (sortBy === 'trending') {
          params.sort = 'engagement_score';
          params.order = 'desc';
        } else if (sortBy === 'most_liked') {
          params.sort = 'like_count';
          params.order = 'desc';
        }
        // If sortBy is 'personalized' but user is not client, default to recent
        else if (sortBy === 'personalized') {
          params.sort = 'created_at';
          params.order = 'desc';
        }
        
        response = await axios.get(`${API_URL}/artworks`, {
          params,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 15000,
        });
      }

      const removedIds = get().removedIds || [];
      // Handle different response formats
      let artworksArray = response.data.artworks || response.data.data || [];
      if (Array.isArray(response.data) && !response.data.artworks) {
        artworksArray = response.data;
      }
      
      let newArtworks = artworksArray.filter(
        (a) => !removedIds.includes(String(a.id))
      );

      // Client-side sorting if needed (for personalized feed)
      if (isClient && sortBy !== 'personalized' && newArtworks.length > 0) {
        if (sortBy === 'recent') {
          newArtworks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortBy === 'trending') {
          newArtworks.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0));
        } else if (sortBy === 'most_liked') {
          newArtworks.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        }
      }

      // Handle pagination - check multiple possible formats
      const pagination = response.data.pagination || response.data;
      const hasMore = pagination?.page < pagination?.totalPages || 
                     (pagination?.hasMore !== false && newArtworks.length === 20);

      set({
        artworks: reset
          ? newArtworks
          : [...get().artworks.filter((a) => !removedIds.includes(String(a.id))), ...newArtworks],
        page: page + 1,
        hasMore,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching artworks:', error);
      // Don't crash - just stop loading and keep existing artworks
      set({ isLoading: false });
    }
  },

  removeArtwork: (artworkId) =>
    set((state) => {
      const id = String(artworkId);
      const removed = state.removedIds.includes(id) ? state.removedIds : [...state.removedIds, id];
      return {
        removedIds: removed,
        artworks: state.artworks.filter((a) => String(a.id) !== id),
      };
    }),

  updateArtworkLikeCount: (artworkId, likeCount) =>
    set((state) => ({
      artworks: state.artworks.map((a) =>
        String(a.id) === String(artworkId)
          ? { ...a, like_count: likeCount }
          : a
      ),
    })),

  reset: () => set({ artworks: [], page: 1, hasMore: true, isLoading: false, likedArtworks: new Set(), likedArtworksLoaded: false }),
}));

// Swipe store for Tinder-style feature
export const useSwipeStore = create((set, get) => ({
  artists: [],
  currentIndex: 0,
  isLoading: false,

  fetchArtists: async () => {
    set({ isLoading: true });
    try {
      // Get token from auth store to exclude swiped artists
      const token = useAuthStore.getState().token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_URL}/artists`, { 
        headers,
        timeout: 15000,
      });
      set({ artists: response.data.artists || [], currentIndex: 0, isLoading: false });
    } catch (error) {
      console.error('Error fetching artists:', error);
      // Don't crash - just show empty list
      set({ artists: [], isLoading: false });
    }
  },

  swipe: async (artistId, direction, updateIndex = true) => {
    // Update index ONLY if requested (default true for backward compatibility)
    // When called from animation callback, updateIndex should be false to prevent re-render
    if (updateIndex) {
      const newIndex = get().currentIndex + 1;
      set({ currentIndex: newIndex });
    }
    
    // Record swipe in background - ensure it completes
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        console.error('[SWIPE] No auth token for swipe');
        return { success: false, error: 'No token' };
      }
      
      // Validate artistId is not null/undefined
      if (!artistId) {
        console.error('[SWIPE] artistId is null or undefined:', artistId);
        return { success: false, error: 'artistId is required' };
      }
      
      // Backend now accepts UUIDs (updated to handle both UUIDs and numbers)
      // currentArtist.id is a UUID (user_id), which is what the artists table uses as primary key
      // Send it directly - backend will handle it correctly
      const finalArtistId = artistId;
      
      console.log('[SWIPE] Recording swipe:', { 
        artistId: finalArtistId, 
        direction, 
        originalType: typeof artistId,
        originalValue: artistId,
        token: token.substring(0, 20) + '...' 
      });
      
      const response = await axios.post(`${API_URL}/swipes`, {
        artistId: finalArtistId,
        direction,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000, // 10 second timeout
      });
      
      console.log('[SWIPE] Response received:', response.data);
      
      // Verify the response
      if (response.data && response.data.success) {
        console.log('[SWIPE] ✓ Swipe recorded successfully:', {
          artistId: finalArtistId,
          direction,
          swipeData: response.data.swipe
        });
        
        // If it's a right swipe (like), log it prominently
        if (direction === 'right') {
          console.log('[SWIPE] ✓✓✓ ARTIST LIKED VIA SWIPE:', finalArtistId);
        }
        
        return { success: true, artistId: finalArtistId, direction, data: response.data };
      } else {
        console.error('[SWIPE] Unexpected response format:', response.data);
        return { success: false, error: 'Invalid response' };
      }
    } catch (error) {
      console.error('[SWIPE] Error recording swipe:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        artistId,
        direction,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          data: error.config.data,
        } : null,
      });
      // Don't revert index on error - keep optimistic update for smooth UX
      return { success: false, error: error.message };
    }
  },

  reset: () => set({ artists: [], currentIndex: 0 }),
}));

// Board store
export const useBoardStore = create((set, get) => ({
  boards: [],
  currentBoard: null,
  isLoading: false,
  error: null,

  fetchBoards: async (type = null) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const params = type ? { type } : {};
      
      const response = await axios.get(`${API_URL}/boards`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      set({ boards: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      console.error('Fetch boards error:', error);
      throw error;
    }
  },

  fetchBoard: async (boardId) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      
      const response = await axios.get(`${API_URL}/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set({ currentBoard: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  createBoard: async (boardData) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await axios.post(`${API_URL}/boards`, boardData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000, // 15 second timeout
      });
      
      if (!response.data) {
        throw new Error('Invalid response from server');
      }
      
      set((state) => ({
        boards: [response.data, ...state.boards],
        isLoading: false
      }));
      
      return response.data;
    } catch (error) {
      console.error('Error creating board:', error);
      const errorMessage = error.response?.data?.error 
        || (error.code === 'ECONNABORTED' ? 'Request timed out. Please check your connection.' : 'Network error. Please check your connection.')
        || error.message 
        || 'Failed to create board';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateBoard: async (boardId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      
      const response = await axios.put(`${API_URL}/boards/${boardId}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set((state) => ({
        boards: state.boards.map(b => b.id === boardId ? response.data : b),
        currentBoard: state.currentBoard?.id === boardId ? response.data : state.currentBoard,
        isLoading: false
      }));
      
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  deleteBoard: async (boardId) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      
      await axios.delete(`${API_URL}/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set((state) => ({
        boards: state.boards.filter(b => b.id !== boardId),
        isLoading: false
      }));
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  saveArtworkToBoard: async (boardId, artworkId) => {
    try {
      const token = useAuthStore.getState().token;
      
      const response = await axios.post(
        `${API_URL}/boards/${boardId}/artworks`,
        { artwork_id: artworkId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  removeArtworkFromBoard: async (boardId, artworkId) => {
    try {
      const token = useAuthStore.getState().token;
      
      await axios.delete(
        `${API_URL}/boards/${boardId}/artworks/${artworkId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      throw error;
    }
  },

  addCollaborator: async (boardId, userId, role = 'viewer') => {
    try {
      const token = useAuthStore.getState().token;
      
      const response = await axios.post(
        `${API_URL}/boards/${boardId}/collaborators`,
        { user_id: userId, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  removeCollaborator: async (boardId, collaboratorId) => {
    try {
      const token = useAuthStore.getState().token;
      
      await axios.delete(
        `${API_URL}/boards/${boardId}/collaborators/${collaboratorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      throw error;
    }
  },

  reset: () => set({ boards: [], currentBoard: null, isLoading: false, error: null }),
}));

// Profile store
export const useProfileStore = create((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async (userId, token = null, forceRefresh = false) => {
    // If forceRefresh, clear cache by resetting first
    if (forceRefresh) {
      set({ profile: null, isLoading: true, error: null });
    } else {
      set({ isLoading: true, error: null });
    }
    
    try {
      // Add cache-busting query param if force refresh
      const url = forceRefresh 
        ? `${API_URL}/users/${userId}?t=${Date.now()}`
        : `${API_URL}/users/${userId}`;
      
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(url, { headers });
      
      // Filter out empty portfolio images with stricter validation
      const profileData = { ...response.data };
      if (profileData?.artist?.portfolio_images) {
        profileData.artist.portfolio_images = profileData.artist.portfolio_images.filter(img => {
          if (!img || typeof img !== 'string') return false;
          const trimmed = img.trim();
          if (!trimmed) return false;
          // Only keep URLs that start with http:// or https://
          return trimmed.startsWith('http://') || trimmed.startsWith('https://');
        });
      }
      
      set({ profile: profileData, isLoading: false });
      return profileData;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (updates, token) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.put(`${API_URL}/users/me`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set({ profile: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  updateArtistProfile: async (updates, token) => {
    set({ isLoading: true, error: null });
    try {
      // Filter out empty portfolio images before sending
      const cleanedUpdates = { ...updates };
      if (cleanedUpdates.portfolio_images) {
        cleanedUpdates.portfolio_images = cleanedUpdates.portfolio_images.filter(
          img => img && img.trim() !== ''
        );
      }

      const response = await axios.put(`${API_URL}/users/me/artist`, cleanedUpdates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Filter out empty portfolio images in response with stricter validation
      const responseData = { ...response.data };
      if (responseData.portfolio_images) {
        responseData.portfolio_images = responseData.portfolio_images.filter(img => {
          if (!img || typeof img !== 'string') return false;
          const trimmed = img.trim();
          if (!trimmed) return false;
          // Only keep URLs that start with http:// or https://
          return trimmed.startsWith('http://') || trimmed.startsWith('https://');
        });
      }

      set((state) => ({
        profile: {
          ...state.profile,
          artist: responseData
        },
        isLoading: false
      }));

      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  completeArtistOnboarding: async (portfolioImages, token) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(
        `${API_URL}/users/me/artist/onboarding`,
        { portfolio_images: portfolioImages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      set((state) => ({
        profile: {
          ...state.profile,
          artist: response.data.artist
        },
        isLoading: false
      }));

      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
    }
  },

  reset: () => set({ profile: null, isLoading: false, error: null }),
}));

// Search store
export const useSearchStore = create((set, get) => ({
  query: '',
  artworks: [],
  artists: [],
  isLoading: false,
  error: null,
  activeTab: 'artworks', // 'artworks' or 'artists'
  filters: {}, // Enhanced filters for artists

  setQuery: (query) => set({ query }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setFilters: (filters) => set({ filters }),

  search: async (searchQuery, filters = null, preserveTab = null) => {
    const currentFilters = filters || get().filters;
    // Use preserveTab if provided, otherwise get current tab
    const currentActiveTab = preserveTab !== null ? preserveTab : get().activeTab;
    
    if (!searchQuery || searchQuery.trim().length < 2) {
      set({ artworks: [], artists: [], query: searchQuery });
      return;
    }

    set({ isLoading: true, error: null, query: searchQuery });

    try {
      // Build artist search params with filters
      const artistParams = new URLSearchParams({
        search: searchQuery.trim(),
        limit: '20'
      });
      
      if (currentFilters.styles?.length > 0) {
        artistParams.append('styles', currentFilters.styles.join(','));
      }
      if (currentFilters.price_min !== undefined) {
        artistParams.append('price_min', currentFilters.price_min);
      }
      if (currentFilters.price_max !== undefined) {
        artistParams.append('price_max', currentFilters.price_max);
      }
      if (currentFilters.turnaround_max !== undefined) {
        artistParams.append('turnaround_max', currentFilters.turnaround_max);
      }
      if (currentFilters.language) {
        artistParams.append('language', currentFilters.language);
      }

      const artistsUrl = `${API_URL}/artists?${artistParams.toString()}`;
      console.log('Searching artists with URL:', artistsUrl);

      // Search both artworks and artists in parallel
      const [artworksResponse, artistsResponse] = await Promise.all([
        axios.get(`${API_URL}/artworks?search=${encodeURIComponent(searchQuery.trim())}&limit=20`),
        axios.get(artistsUrl)
      ]);

      console.log('Artists search response:', artistsResponse.data);
      console.log('Found artists:', artistsResponse.data?.artists?.length || 0);

      set({
        artworks: artworksResponse.data.artworks || [],
        artists: artistsResponse.data.artists || [],
        isLoading: false,
        activeTab: currentActiveTab, // Preserve active tab
      });
    } catch (error) {
      console.error('Search error:', error);
      set({
        error: error.response?.data?.error || 'Search failed',
        isLoading: false,
        artworks: [],
        artists: [],
        activeTab: currentActiveTab, // Preserve active tab even on error
      });
    }
  },

  searchArtistsWithFilters: async (filters = null) => {
    const currentFilters = filters || get().filters;
    set({ isLoading: true, error: null });

    try {
      const params = new URLSearchParams({ limit: '50' });
      
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

      const response = await axios.get(`${API_URL}/artists?${params.toString()}`);
      set({
        artists: response.data.artists || [],
        isLoading: false,
      });
    } catch (error) {
      console.error('Filter search error:', error);
      set({
        error: error.response?.data?.error || 'Search failed',
        isLoading: false,
        artists: [],
      });
    }
  },

  clearSearch: () => set({
    query: '',
    artworks: [],
    artists: [],
    error: null,
    activeTab: 'artworks',
    filters: {},
  }),
}));