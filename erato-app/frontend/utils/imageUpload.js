import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// Initialize Supabase client for storage
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload an image to Supabase Storage
 * @param {string} uri - Local file URI from ImagePicker
 * @param {string} bucket - Storage bucket name (e.g., 'artworks', 'profiles', 'portfolios')
 * @param {string} folder - Optional folder within bucket
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadImage(uri, bucket = 'artworks', folder = '') {
  try {
    // Generate unique filename
    const ext = uri.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to array buffer
    const arrayBuffer = decode(base64);

    // Determine content type
    const contentType = getContentType(ext);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
}

/**
 * Upload multiple images in parallel
 * @param {string[]} uris - Array of local file URIs
 * @param {string} bucket - Storage bucket name
 * @param {string} folder - Optional folder within bucket
 * @returns {Promise<string[]>} Array of public URLs
 */
export async function uploadMultipleImages(uris, bucket = 'artworks', folder = '') {
  try {
    const uploadPromises = uris.map(uri => uploadImage(uri, bucket, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw new Error('Failed to upload images');
  }
}

/**
 * Delete an image from Supabase Storage
 * @param {string} url - Public URL of the image
 * @param {string} bucket - Storage bucket name
 * @returns {Promise<void>}
 */
export async function deleteImage(url, bucket = 'artworks') {
  try {
    // Extract file path from URL
    const urlParts = url.split(`/storage/v1/object/public/${bucket}/`);
    if (urlParts.length < 2) {
      throw new Error('Invalid URL format');
    }
    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
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
