import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.'));
    }
  },
});

/**
 * POST /api/uploads/artwork
 * Upload an artwork image to Supabase Storage
 * Requires authentication
 */
router.post(
  '/artwork',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(7);
      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `${timestamp}-${randomString}.${ext}`;

      // Upload to Supabase Storage using admin client (bypasses RLS)
      const { data, error } = await supabaseAdmin.storage
        .from('artworks')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({
          error: 'Failed to upload file to storage',
          details: error.message
        });
      }

      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('artworks')
        .getPublicUrl(fileName);

      res.json({
        success: true,
        url: publicUrlData.publicUrl,
        fileName: fileName,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/uploads/profile
 * Upload a profile picture to Supabase Storage
 * Requires authentication
 */
router.post(
  '/profile',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Generate filename with user ID
      const timestamp = Date.now();
      const ext = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `${req.user.id}-${timestamp}.${ext}`;

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from('profiles')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true, // Allow overwriting old profile pictures
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return res.status(500).json({
          error: 'Failed to upload file to storage',
          details: error.message
        });
      }

      // Get public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('profiles')
        .getPublicUrl(fileName);

      res.json({
        success: true,
        url: publicUrlData.publicUrl,
        fileName: fileName,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/uploads/portfolio
 * Upload portfolio images to Supabase Storage
 * Requires authentication
 * Accepts multiple files
 */
router.post(
  '/portfolio',
  authenticate,
  upload.array('files', 6), // Max 6 portfolio images
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploadedUrls = [];
      const userId = req.user.id;

      // Upload each file
      for (const file of req.files) {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const ext = file.originalname.split('.').pop() || 'jpg';
        const fileName = `${userId}/${timestamp}-${randomString}.${ext}`;

        const { data, error } = await supabaseAdmin.storage
          .from('portfolios')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) {
          console.error('Supabase upload error:', error);
          // Continue with other uploads even if one fails
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('portfolios')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrlData.publicUrl);
      }

      if (uploadedUrls.length === 0) {
        return res.status(500).json({ error: 'All uploads failed' });
      }

      res.json({
        success: true,
        urls: uploadedUrls,
        count: uploadedUrls.length,
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }
);

export default router;
