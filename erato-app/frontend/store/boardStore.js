import { create } from 'zustand';
import axios from 'axios';
import { useAuthStore } from './authStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
      
      const response = await axios.get(`${API_URL}/api/boards`, {
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
      
      const response = await axios.get(`${API_URL}/api/boards/${boardId}`, {
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
      
      const response = await axios.post(`${API_URL}/api/boards`, boardData, {
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
      
      const response = await axios.put(`${API_URL}/api/boards/${boardId}`, updates, {
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
      
      await axios.delete(`${API_URL}/api/boards/${boardId}`, {
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
        `${API_URL}/api/boards/${boardId}/collaborators`,
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
        `${API_URL}/api/boards/${boardId}/collaborators/${collaboratorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      throw error;
    }
  },

  reset: () => set({ boards: [], currentBoard: null, isLoading: false, error: null }),
}));