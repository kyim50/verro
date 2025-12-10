import { io } from 'socket.io-client';
import Constants from 'expo-constants';

// Socket.io connects to the base server URL (without /api)
// Temporarily hardcoded for EC2 testing - remove this after confirming it works
const SOCKET_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SOCKET_URL || 
                   process.env.EXPO_PUBLIC_SOCKET_URL || 
                   'http://3.18.213.189:3000';

let socket = null;

/**
 * Initialize Socket.io connection
 * @param {string} token - JWT authentication token
 * @returns {Socket} Socket.io instance
 */
export const initSocket = (token) => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: {
      token: token
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  return socket;
};

/**
 * Get current socket instance
 * @returns {Socket|null}
 */
export const getSocket = () => {
  return socket;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default socket;


