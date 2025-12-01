import { create } from 'zustand';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL;

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

  reset: () => set({ profile: null, isLoading: false, error: null }),
}));