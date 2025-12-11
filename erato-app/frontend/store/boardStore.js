import { create } from 'zustand';
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from './authStore';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.verrocio.com/api';

export const useBoardStore = create((set, get) => ({
  boards: [],
  currentBoard: null,
  isLoading: false,
  error: null,

  fetchBoards: async (type = null, { skipCache = true } = {}) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const params = type ? { type } : {};
      if (skipCache) params.skipCache = 'true';
      
      const response = await axios.get(`${API_URL}/boards`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      set({ boards: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.error || error.message, isLoading: false });
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

  saveArtworkToBoard: async (boardId, artworkId) => {
    try {
      const token = useAuthStore.getState().token;

      const response = await axios.post(
        `${API_URL}/boards/${boardId}/artworks`,
        { artwork_id: artworkId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update the board in the store to reflect the new artwork count
      // Use the most accurate count: from board_artworks array length if available
      set((state) => ({
        boards: state.boards.map(board => {
          if (board.id === boardId) {
            // Get updated board_artworks from response or use existing
            const updatedBoardArtworks = response.data.board_artworks || board.board_artworks || [];
            const newCount = updatedBoardArtworks.length;
            
            return {
              ...board,
              artworks: [{ count: newCount }],
              board_artworks: updatedBoardArtworks,
            };
          }
          return board;
        }),
        // Also update currentBoard if it's the one being modified
        currentBoard: state.currentBoard?.id === boardId 
          ? { 
              ...state.currentBoard, 
              artworks: [{ count: (response.data.board_artworks || state.currentBoard.board_artworks || []).length }],
              board_artworks: response.data.board_artworks || state.currentBoard.board_artworks || [],
            }
          : state.currentBoard,
      }));

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

  reset: () => set({ boards: [], currentBoard: null, isLoading: false, error: null }),
}));