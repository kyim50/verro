import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://3.18.213.189:3000/api';

/**
 * Upload an image to Supabase Storage via backend API
 * @param {string} uri - Local file URI from ImagePicker
 * @param {string} bucket - Storage bucket name (e.g., 'artworks', 'profiles', 'portfolios')
 * @param {string} folder - Optional folder within bucket (not used with new API)
 * @param {string} token - JWT authentication token
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadImage(uri, bucket = 'artworks', folder = '', token = null, allowUnauthenticated = false) {
  try {
    if (!allowUnauthenticated && !token) {
      throw new Error('Authentication token required for upload');
    }

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Determine content type
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = getContentType(ext);

    // Create form data with proper React Native format
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: contentType,
      name: `upload.${ext}`,
    });

    // Determine endpoint based on bucket and authentication
    let endpoint;
    if (allowUnauthenticated && bucket === 'profiles') {
      endpoint = `${API_URL}/uploads/register-profile`;
    } else {
      endpoint = `${API_URL}/uploads/${bucket === 'profiles' ? 'profile' : bucket === 'portfolios' ? 'portfolio' : 'artwork'}`;
    }

    // Upload to backend API
    // Note: Don't set Content-Type header manually - axios will set it with proper boundary
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await axios.post(endpoint, formData, {
      headers: {
        ...headers,
        // Axios will automatically set Content-Type: multipart/form-data with boundary
      },
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Upload failed');
    }

    return response.data.url;
  } catch (error) {
    console.error('Error uploading image:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      const errorMessage = error.response.data?.error || error.response.data?.message || 'Failed to upload image';
      throw new Error(errorMessage);
    }
    if (error.request) {
      console.error('Request made but no response received:', error.request);
      throw new Error('Network error: Could not reach server');
    }
    throw new Error(error.message || 'Failed to upload image');
  }
}

/**
 * Upload multiple images in parallel
 * @param {string[]} uris - Array of local file URIs
 * @param {string} bucket - Storage bucket name
 * @param {string} folder - Optional folder within bucket (not used with new API)
 * @param {string} token - JWT authentication token
 * @returns {Promise<string[]>} Array of public URLs
 */
export async function uploadMultipleImages(uris, bucket = 'artworks', folder = '', token) {
  try {
    if (!token) {
      throw new Error('Authentication token required for upload');
    }

    // For portfolio, use the multi-file endpoint
    if (bucket === 'portfolios') {
      const formData = new FormData();
      for (const uri of uris) {
        const ext = uri.split('.').pop();
        const contentType = getContentType(ext);
        formData.append('files', {
          uri,
          type: contentType,
          name: `upload.${ext}`,
        });
      }

      const response = await axios.post(`${API_URL}/uploads/portfolio`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          // Axios will automatically set Content-Type: multipart/form-data with boundary
        },
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Upload failed');
      }

      return response.data.urls;
    }

    // For other buckets, upload individually in parallel
    const uploadPromises = uris.map(uri => uploadImage(uri, bucket, folder, token));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to upload images');
    }
    throw new Error('Failed to upload images');
  }
}

/**
 * Delete an image from Supabase Storage
 * Note: This function is deprecated as deletion should be handled server-side
 * @param {string} url - Public URL of the image
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<void>}
 */
export async function deleteImage(url, bucket = 'artworks') {
  try {
    // TODO: Implement backend API endpoint for image deletion
    console.warn('deleteImage function is deprecated - implement backend API endpoint');
    // For now, do nothing - deletion should be handled by backend when artwork/profile is deleted
  } catch (error) {
    console.error('Error in deleteImage:', error);
    // Don't throw - deletion failures shouldn't block the app
  }
}

/**
 * Get content type from file extension
 * @param {string} ext - File extension
 * @returns {string} MIME type
 */
function getContentType(ext) {
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  return types[ext?.toLowerCase()] || 'image/jpeg';
}

/**
 * Create a thumbnail URL from a full image URL
 * Supabase Image Transformation (if enabled)
 * @param {string} url - Original image URL
 * @param {number} width - Thumbnail width
 * @param {number} height - Thumbnail height
 * @returns {string} Thumbnail URL
 */
export function getThumbnailUrl(url, width = 400, height = 400) {
  // Check if Supabase Image Transformation is available
  // If not, return original URL
  if (!url) return '';

  // For now, return original URL
  // To enable transformations, add: ?width=${width}&height=${height}&resize=cover
  return url;
}

/**
 * Validate image file before upload
 * @param {string} uri - Local file URI
 * @returns {Promise<boolean>} True if valid
 */
export async function validateImage(uri) {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);

    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (fileInfo.size > maxSize) {
      throw new Error('Image must be less than 10MB');
    }

    // Check file extension
    const ext = uri.split('.').pop()?.toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!ext || !allowedExts.includes(ext)) {
      throw new Error('Invalid image format. Use JPG, PNG, GIF, or WebP');
    }

    return true;
  } catch (error) {
    console.error('Image validation error:', error);
    throw error;
  }
}
