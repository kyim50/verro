import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

// Auth store
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setToken: async (token) => {
    if (token) {
      await SecureStore.setItemAsync('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      await SecureStore.deleteItemAsync('authToken');
      delete axios.defaults.headers.common['Authorization'];
    }
    set({ token, isAuthenticated: !!token });
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
    }
    set({ isLoading: false });
    return null;
  },

  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      const { token, user } = response.data;
      await useAuthStore.getState().setToken(token);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  },

  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      const { token, user } = response.data;
      await useAuthStore.getState().setToken(token);
      set({ user, isAuthenticated: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  },

  logout: async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await useAuthStore.getState().setToken(null);
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchUser: async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      set({ user: response.data.user });
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  },
}));

// Feed store for artworks
export const useFeedStore = create((set, get) => ({
  artworks: [],
  page: 1,
  hasMore: true,
  isLoading: false,

  fetchArtworks: async (reset = false) => {
    if (get().isLoading || (!reset && !get().hasMore)) return;

    set({ isLoading: true });
    const page = reset ? 1 : get().page;

    try {
      const response = await axios.get(`${API_URL}/artworks`, {
        params: { page, limit: 20 },
      });

      const newArtworks = response.data.artworks;
      const hasMore = response.data.pagination.page < response.data.pagination.totalPages;

      set({
        artworks: reset ? newArtworks : [...get().artworks, ...newArtworks],
        page: page + 1,
        hasMore,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching artworks:', error);
      set({ isLoading: false });
    }
  },

  reset: () => set({ artworks: [], page: 1, hasMore: true }),
}));

// Swipe store for Tinder-style feature
export const useSwipeStore = create((set, get) => ({
  artists: [],
  currentIndex: 0,
  isLoading: false,

  fetchArtists: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_URL}/artists`);
      set({ artists: response.data.artists, currentIndex: 0, isLoading: false });
    } catch (error) {
      console.error('Error fetching artists:', error);
      set({ isLoading: false });
    }
  },

  swipe: async (artistId, direction) => {
    try {
      await axios.post(`${API_URL}/swipes`, {
        artistId,
        direction,
      });
      set({ currentIndex: get().currentIndex + 1 });
    } catch (error) {
      console.error('Error recording swipe:', error);
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
      
      const response = await axios.post(`${API_URL}/boards`, boardData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      set((state) => ({
        boards: [response.data, ...state.boards],
        isLoading: false
      }));
      
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
      throw error;
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

  fetchProfile: async (userId, token = null) => {
    set({ isLoading: true, error: null });
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API_URL}/users/${userId}`, { headers });
      
      set({ profile: response.data, isLoading: false });
      return response.data;
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
      const response = await axios.put(`${API_URL}/users/me/artist`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      });

      set((state) => ({
        profile: {
          ...state.profile,
          artist: response.data
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