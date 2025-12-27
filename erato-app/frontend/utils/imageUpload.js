import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import { getFormattedFileUri, verifyFileAccess } from './androidUploadFix';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.verrocio.com/api';

// Log API URL for debugging (first 30 chars only for security)
console.log('📡 API URL configured:', API_URL ? API_URL.substring(0, 30) + '...' : 'NOT SET');

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
      // Portfolio endpoint expects 'files' (plural) - but for single file, we should use uploadMultipleImages
      // However, if someone calls uploadImage with portfolio, we'll still try to use the portfolio endpoint
      // The backend accepts upload.array('files', 6) which can handle a single file
      endpoint = `${API_URL}/uploads/portfolio`;
      fieldName = 'files'; // Backend expects 'files' field name
    } else {
      endpoint = `${API_URL}/uploads/${bucket === 'profiles' ? 'profile' : 'artwork'}`;
      fieldName = 'file';
    }
    
    console.log('🔗 Upload endpoint:', endpoint);
    console.log('📎 Field name:', fieldName);

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
    console.log('📤 Uploading image:', {
      endpoint,
      fieldName,
      uri: uri.substring(0, 50) + '...',
      contentType,
      platform: Platform.OS,
      apiUrl: API_URL.substring(0, 30) + '...',
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
    
    let response;
    try {
      response = await axios.post(endpoint, formData, axiosConfig);
    } catch (err) {
      // Fallback to fetch on Android if axios returns a generic network error with no response
      if (err.code === 'ERR_NETWORK' && !err.response) {
        console.warn('Axios network error, retrying upload with fetch fallback...');
        const fetchResponse = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: formData,
        });
        if (!fetchResponse.ok) {
          const text = await fetchResponse.text();
          throw new Error(text || 'Upload failed (fetch fallback)');
        }
        response = {
          data: await fetchResponse.json(),
        };
      } else {
        throw err;
      }
    }

    // Log response for debugging
    console.log('📥 Upload response:', {
      success: response.data?.success,
      hasUrl: !!response.data?.url,
      hasUrls: !!response.data?.urls,
      bucket,
      endpoint,
    });

    if (!response || !response.data) {
      throw new Error('Invalid response from server');
    }

    if (!response.data.success) {
      const errorMsg = response.data.error || response.data.message || 'Upload failed';
      throw new Error(errorMsg);
    }

    // Portfolio endpoint returns array of URLs, single file endpoints return single URL
    if (bucket === 'portfolios') {
      // When using uploadImage with portfolio bucket, backend still returns { success: true, urls: [...] }
      if (Array.isArray(response.data.urls) && response.data.urls.length > 0) {
        // For single file upload to portfolio, return first URL
        return response.data.urls[0];
      } else if (response.data.url) {
        // Fallback: some responses might have single url instead of urls array
        return response.data.url;
      } else {
        throw new Error('Portfolio upload returned no URLs');
      }
    }

    // For artwork and profile endpoints, expect a single URL
    if (response.data.url) {
      return response.data.url;
    } else {
      // Check if response has urls array (shouldn't happen for single uploads, but handle it)
      if (Array.isArray(response.data.urls) && response.data.urls.length > 0) {
        return response.data.urls[0];
      }
      throw new Error('Upload succeeded but no URL returned from server');
    }
  } catch (error) {
    // Capture rich diagnostics
    const respData = error.response?.data;
    const networkMsg = `Network error: Could not reach server at ${API_URL}. Please check your internet connection and that the server is running.`;
    const timeoutMsg = 'Upload timeout: The server took too long to respond. Please try again.';
    const defaultMsg = 'Failed to upload image';

    console.error('❌ Error uploading image:', error?.message || error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      responseStatus: error.response?.status,
      responseData: respData,
      request: error.request ? 'Request made but no response' : null,
      apiUrl: API_URL,
      bucket,
    });
    
    // Prefer backend-provided message first
    if (error.response) {
      const backendMsg = respData?.error || respData?.message;
      if (backendMsg) throw new Error(backendMsg);
      throw new Error(defaultMsg);
    }
    // Network layer issues (no response)
    if (error.request) {
      throw new Error(networkMsg);
    }
    // Timeout
    if (error.code === 'ECONNABORTED') {
      throw new Error(timeoutMsg);
    }
    // Fallback
    throw new Error(error.message || defaultMsg);
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
      
      let response;
      try {
        response = await axios.post(`${API_URL}/uploads/portfolio`, formData, axiosConfig);
      } catch (err) {
        if (err.code === 'ERR_NETWORK' && !err.response) {
          console.warn('Axios network error (portfolio), retrying with fetch fallback...');
          const fetchResponse = await fetch(`${API_URL}/uploads/portfolio`, {
            method: 'POST',
            headers: axiosConfig.headers,
            body: formData,
          });
          if (!fetchResponse.ok) {
            const text = await fetchResponse.text();
            throw new Error(text || 'Portfolio upload failed (fetch fallback)');
          }
          response = { data: await fetchResponse.json() };
        } else {
          throw err;
        }
      }

      console.log('📥 Portfolio upload response:', {
        success: response.data?.success,
        urlsCount: response.data?.urls?.length,
        count: response.data?.count,
      });

      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }

      if (!response.data.success) {
        const errorMsg = response.data.error || response.data.message || 'Upload failed';
        throw new Error(errorMsg);
      }

      if (!Array.isArray(response.data.urls) || response.data.urls.length === 0) {
        throw new Error('Portfolio upload returned no URLs');
      }

      return response.data.urls;
    }

    // For other buckets, upload individually in parallel
    const uploadPromises = uris.map(uri => uploadImage(uri, bucket, folder, token));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('❌ Error uploading multiple images:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : null,
      request: error.request ? 'Request made but no response' : null,
    });
    
    if (error.response) {
      const errorMsg = error.response.data?.error || error.response.data?.message || 'Failed to upload images';
      throw new Error(errorMsg);
    }
    if (error.request) {
      throw new Error(`Network error: Could not reach server at ${API_URL}. Please check your internet connection.`);
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Upload timeout: The server took too long to respond. Please try again.');
    }
    throw new Error(error.message || 'Failed to upload images');
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
 * @param {string} uri - Local file URI (string, not object)
 * @returns {Promise<boolean>} True if valid, throws error if invalid
 */
export async function validateImage(uri) {
  try {
    // Ensure uri is a string
    if (typeof uri !== 'string') {
      console.error('validateImage received non-string:', uri);
      throw new Error('Invalid file URI - expected string');
    }

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
