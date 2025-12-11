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
      
      // Ensure baseline shape for new board
      const createdBoard = {
        ...response.data,
        board_artworks: response.data?.board_artworks || [],
        artworks: response.data?.artworks || [{ count: 0 }],
      };

      set((state) => ({
        boards: [createdBoard, ...state.boards],
        isLoading: false
      }));
      
      return createdBoard;
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

      await axios.post(
        `${API_URL}/boards/${boardId}/artworks`,
        { artwork_id: artworkId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Fetch full board detail to get accurate count and latest thumbnails
      const detail = await axios.get(`${API_URL}/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { skipCache: 'true' },
      });

      const boardData = detail.data;
      const updatedBoardArtworks = boardData.board_artworks || [];
      const newCount = boardData.artworks?.[0]?.count || updatedBoardArtworks.length || 0;

      set((state) => ({
        boards: state.boards.map((board) => {
          const isMatch = String(board.id) === String(boardId);
          if (!isMatch) return board;
          return {
            ...board,
            artworks: [{ count: newCount }],
            board_artworks: updatedBoardArtworks,
          };
        }),
        currentBoard:
          state.currentBoard && String(state.currentBoard.id) === String(boardId)
            ? {
                ...state.currentBoard,
                artworks: [{ count: newCount }],
                board_artworks: updatedBoardArtworks,
              }
            : state.currentBoard,
      }));

      return boardData;
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