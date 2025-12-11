/**
 * Android-specific upload fix
 * React Native FormData on Android can be finicky, this provides a more reliable approach
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Get file URI in the correct format for the platform
 * @param {string} uri - Original URI from ImagePicker
 * @returns {string} Formatted URI
 */
export function getFormattedFileUri(uri) {
  if (Platform.OS === 'android') {
    // Android REQUIRES file:// prefix for FormData
    if (!uri.startsWith('file://')) {
      return `file://${uri}`;
    }
    return uri;
  } else {
    // iOS - remove file:// if present (some versions prefer without)
    if (uri.startsWith('file://')) {
      return uri.replace('file://', '');
    }
    return uri;
  }
}

/**
 * Verify file exists and is accessible
 * @param {string} uri - File URI
 * @returns {Promise<boolean>}
 */
export async function verifyFileAccess(uri) {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      console.error('File does not exist:', uri);
      return false;
    }
    if (fileInfo.size === 0) {
      console.error('File is empty:', uri);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error verifying file:', error);
    return false;
  }
}
