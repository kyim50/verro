import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   GET /api/references/commission/:commissionId
 * @desc    Get all references for a commission
 * @access  Private (Client or Artist)
 */
router.get('/commission/:commissionId', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;
    const userId = req.user.id;

    // Verify user is involved in the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, artist_id')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view these references'
      });
    }

    // Get all references for this commission
    const { data, error } = await supabaseAdmin
      .from('commission_references')
      .select(`
        *,
        users:uploaded_by (
          id,
          username,
          avatar_url
        )
      `)
      .eq('commission_id', commissionId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group references by type
    const groupedReferences = {
      images: data.filter(r => r.reference_type === 'image'),
      mood_boards: data.filter(r => r.reference_type === 'mood_board'),
      color_palettes: data.filter(r => r.reference_type === 'color_palette'),
      character_sheets: data.filter(r => r.reference_type === 'character_sheet'),
      links: data.filter(r => r.reference_type === 'link')
    };

    res.json({
      success: true,
      data: {
        all: data,
        grouped: groupedReferences
      }
    });
  } catch (error) {
    console.error('Error fetching references:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/references/commission/:commissionId
 * @desc    Add a reference to a commission
 * @access  Private (Client or Artist)
 */
// Middleware to handle both file uploads and JSON-only requests
const handleFileUpload = (req, res, next) => {
  // If Content-Type is application/json, skip multer (express.json() will handle it)
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return next();
  }
  // Otherwise, use multer for multipart/form-data file uploads
  upload.single('file')(req, res, next);
};

router.post('/commission/:commissionId', authenticate, handleFileUpload, async (req, res) => {
  try {
    const { commissionId } = req.params;
    const userId = req.user.id;
    const { reference_type, title, description, metadata, file_url } = req.body;

    // Verify user is involved in the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, artist_id')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to add references'
      });
    }

    // Validate reference type
    const validTypes = ['image', 'mood_board', 'color_palette', 'character_sheet', 'link'];
    if (!validTypes.includes(reference_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference type'
      });
    }

    let uploadedFileUrl = file_url;
    let thumbnailUrl = null;

    // If file is uploaded, store it in Supabase Storage
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${commissionId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('commission-references')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from('commission-references')
        .getPublicUrl(fileName);

      uploadedFileUrl = urlData.publicUrl;

      // Generate thumbnail for images
      if (req.file.mimetype.startsWith('image/')) {
        thumbnailUrl = uploadedFileUrl; // In production, you'd generate actual thumbnails
      }
    }

    // Get current max display_order
    const { data: maxOrderData } = await supabaseAdmin
      .from('commission_references')
      .select('display_order')
      .eq('commission_id', commissionId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    // Parse metadata if it's a string, otherwise use as-is
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (e) {
        console.warn('Failed to parse metadata, using empty object:', e);
        parsedMetadata = {};
      }
    }

    // Insert reference
    const { data, error } = await supabaseAdmin
      .from('commission_references')
      .insert({
        commission_id: commissionId,
        reference_type,
        title: title || null,
        description: description || null,
        file_url: uploadedFileUrl,
        thumbnail_url: thumbnailUrl,
        metadata: parsedMetadata,
        display_order: nextOrder,
        uploaded_by: userId
      })
      .select(`
        *,
        users:uploaded_by (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Reference added successfully',
      data
    });
  } catch (error) {
    console.error('Error adding reference:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to add reference',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   PUT /api/references/:referenceId
 * @desc    Update a reference
 * @access  Private (Uploader only)
 */
router.put('/:referenceId', authenticate, async (req, res) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user.id;
    const { title, description, metadata, display_order } = req.body;

    // Verify reference belongs to user
    const { data: reference, error: referenceError } = await supabaseAdmin
      .from('commission_references')
      .select('uploaded_by')
      .eq('id', referenceId)
      .single();

    if (referenceError) throw referenceError;

    if (reference.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own references'
      });
    }

    // Update reference
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (display_order !== undefined) updateData.display_order = display_order;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('commission_references')
      .update(updateData)
      .eq('id', referenceId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Reference updated successfully',
      data
    });
  } catch (error) {
    console.error('Error updating reference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/references/:referenceId
 * @desc    Delete a reference
 * @access  Private (Uploader only)
 */
router.delete('/:referenceId', authenticate, async (req, res) => {
  try {
    const { referenceId } = req.params;
    const userId = req.user.id;

    // Verify reference belongs to user
    const { data: reference, error: referenceError } = await supabaseAdmin
      .from('commission_references')
      .select('uploaded_by, file_url')
      .eq('id', referenceId)
      .single();

    if (referenceError) throw referenceError;

    if (reference.uploaded_by !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own references'
      });
    }

    // Delete file from storage if it exists
    if (reference.file_url && reference.file_url.includes('commission-references')) {
      const filePath = reference.file_url.split('/commission-references/')[1];
      if (filePath) {
        await supabaseAdmin.storage
          .from('commission-references')
          .remove([filePath]);
      }
    }

    // Delete reference record
    const { error } = await supabaseAdmin
      .from('commission_references')
      .delete()
      .eq('id', referenceId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Reference deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/references/reorder
 * @desc    Reorder references for a commission
 * @access  Private (Client or Artist)
 */
router.post('/reorder', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { commissionId, referenceOrders } = req.body; // referenceOrders: [{ id, display_order }]

    // Verify user is involved in the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, artist_id')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to reorder references'
      });
    }

    // Update each reference's display order
    const updatePromises = referenceOrders.map(({ id, display_order }) =>
      supabaseAdmin
        .from('commission_references')
        .update({ display_order })
        .eq('id', id)
        .eq('commission_id', commissionId)
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'References reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering references:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/references/color-palette
 * @desc    Create a color palette reference
 * @access  Private (Client or Artist)
 */
router.post('/color-palette', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { commissionId, title, colors } = req.body; // colors: [{ hex, name }]

    // Verify user is involved in the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, artist_id')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to add color palettes'
      });
    }

    // Validate colors
    if (!Array.isArray(colors) || colors.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Colors must be a non-empty array'
      });
    }

    // Get current max display_order
    const { data: maxOrderData } = await supabaseAdmin
      .from('commission_references')
      .select('display_order')
      .eq('commission_id', commissionId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    // Insert color palette reference
    const { data, error } = await supabaseAdmin
      .from('commission_references')
      .insert({
        commission_id: commissionId,
        reference_type: 'color_palette',
        title: title || 'Color Palette',
        metadata: { colors },
        display_order: nextOrder,
        uploaded_by: userId
      })
      .select(`
        *,
        users:uploaded_by (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Color palette created successfully',
      data
    });
  } catch (error) {
    console.error('Error creating color palette:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/references/link
 * @desc    Add a link reference (Pinterest, ArtStation, etc.)
 * @access  Private (Client or Artist)
 */
router.post('/link', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { commissionId, title, url, description } = req.body;

    // Verify user is involved in the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, artist_id')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to add link references'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL'
      });
    }

    // Get current max display_order
    const { data: maxOrderData } = await supabaseAdmin
      .from('commission_references')
      .select('display_order')
      .eq('commission_id', commissionId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    // Insert link reference
    const { data, error } = await supabaseAdmin
      .from('commission_references')
      .insert({
        commission_id: commissionId,
        reference_type: 'link',
        title: title || 'Reference Link',
        description,
        file_url: url,
        metadata: { url },
        display_order: nextOrder,
        uploaded_by: userId
      })
      .select(`
        *,
        users:uploaded_by (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Link reference added successfully',
      data
    });
  } catch (error) {
    console.error('Error adding link reference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
