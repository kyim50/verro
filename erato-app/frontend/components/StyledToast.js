import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

export const showToast = (message, type = 'info', duration = 3000) => {
  // This will integrate with react-native-toast-message or a custom implementation
  // For now, we'll use Toast from react-native-toast-message
  if (typeof Toast !== 'undefined' && Toast.show) {
    Toast.show({
      type: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
      text1: message,
      visibilityTime: duration,
      autoHide: true,
    });
  }
};

export const showAlert = (title, message, buttons = [], type = 'info') => {
  // For styled alerts, we'll use a custom modal component
  // This is a placeholder - will be implemented with styled modals
  if (typeof Alert !== 'undefined' && Alert.alert) {
    Alert.alert(title, message, buttons);
  }
};


