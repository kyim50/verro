import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { getFormattedFileUri, verifyFileAccess } from './androidUploadFix';

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

    // Verify file exists and is accessible
    const fileExists = await verifyFileAccess(uri);
    if (!fileExists) {
      throw new Error('File does not exist or is not accessible');
    }

    // Get file info for size validation
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.size === 0) {
      throw new Error('File is empty');
    }

    // Determine content type
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = getContentType(ext);

    // Determine endpoint and field name based on bucket and authentication
    let endpoint;
    let fieldName = 'file'; // Default field name
    
    if (allowUnauthenticated && bucket === 'profiles') {
      endpoint = `${API_URL}/uploads/register-profile`;
      fieldName = 'file';
    } else if (bucket === 'portfolios') {
      // Portfolio endpoint expects 'files' (plural) even for single uploads
      endpoint = `${API_URL}/uploads/portfolio`;
      fieldName = 'files';
    } else {
      endpoint = `${API_URL}/uploads/${bucket === 'profiles' ? 'profile' : 'artwork'}`;
      fieldName = 'file';
    }

    // Create form data with proper React Native format
    // Use helper function to get correctly formatted URI
    const formData = new FormData();
    const fileUri = getFormattedFileUri(uri);
    
    // React Native FormData file object format: { uri, type, name }
    // The 'name' field is important for backend to identify the file
    const fileData = {
      uri: fileUri,
      type: contentType,
      name: `image.${ext}`, // Use 'image' prefix for better compatibility
    };
    
    console.log('FormData file object:', {
      uri: fileUri.substring(0, 50) + '...',
      type: contentType,
      name: fileData.name,
      platform: Platform.OS,
      hasFilePrefix: fileUri.startsWith('file://'),
      fieldName,
    });
    
    formData.append(fieldName, fileData);

    // Upload to backend API
    // Note: Don't set Content-Type header manually - axios will set it with proper boundary
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Log for debugging
    console.log('Uploading image:', {
      endpoint,
      fieldName,
      uri: uri.substring(0, 50) + '...',
      contentType,
      platform: Platform.OS,
    });
    
    // For Android, ensure we're using the correct axios config
    const axiosConfig = {
      headers: {
        ...headers,
        // CRITICAL: Don't set Content-Type manually - axios will set it with boundary
        // Setting it manually breaks multipart/form-data on Android
      },
      timeout: 30000, // 30 second timeout for uploads
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      transformRequest: (data, headers) => {
        // Ensure Content-Type is not set manually
        // Let axios handle it automatically
        if (headers['Content-Type']) {
          delete headers['Content-Type'];
        }
        return data;
      },
    };
    
    const response = await axios.post(endpoint, formData, axiosConfig);

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Upload failed');
    }

    // Portfolio endpoint returns array of URLs, single file endpoints return single URL
    if (bucket === 'portfolios' && Array.isArray(response.data.urls)) {
      // For single file upload to portfolio, return first URL
      return response.data.urls[0];
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
          // Verify each file before adding
          const fileExists = await verifyFileAccess(uri);
          if (!fileExists) {
            console.warn('Skipping invalid file:', uri);
            continue;
          }
          
          const ext = uri.split('.').pop();
          const contentType = getContentType(ext);
          const fileUri = getFormattedFileUri(uri);
          
          const fileData = {
            uri: fileUri,
            type: contentType,
            name: `image.${ext}`,
          };
          formData.append('files', fileData);
        }
        
        if (formData._parts.length === 0) {
          throw new Error('No valid files to upload');
        }

      const axiosConfig = {
        headers: {
          'Authorization': `Bearer ${token}`,
          // CRITICAL: Don't set Content-Type manually
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        transformRequest: (data, headers) => {
          // Ensure Content-Type is not set manually
          if (headers['Content-Type']) {
            delete headers['Content-Type'];
          }
          return data;
        },
      };
      
      const response = await axios.post(`${API_URL}/uploads/portfolio`, formData, axiosConfig);

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
