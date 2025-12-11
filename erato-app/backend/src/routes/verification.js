import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   GET /api/verification/artist/:artistId/status
 * @desc    Get verification status for an artist
 * @access  Public
 */
router.get('/artist/:artistId/status', async (req, res) => {
  try {
    const { artistId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('artists')
      .select('verified, verification_status, verification_type, verified_at')
      .eq('id', artistId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        verified: data.verified || false,
        status: data.verification_status || 'unverified',
        type: data.verification_type,
        verifiedAt: data.verified_at
      }
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/verification/submit
 * @desc    Submit verification request
 * @access  Private (Artist)
 */
router.post('/submit', authenticate, upload.array('files', 10), async (req, res) => {
  try {
    const userId = req.user.id;
    const { verificationType, portfolioLinks, notes } = req.body;

    // Get artist profile
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id, verification_status')
      .eq('user_id', userId)
      .single();

    if (artistError) {
      return res.status(404).json({
        success: false,
        error: 'Artist profile not found'
      });
    }

    // Validate verification type
    const validTypes = ['portfolio', 'payment', 'identity'];
    if (!validTypes.includes(verificationType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification type'
      });
    }

    // Upload verification files to Supabase Storage
    const uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${artist.id}/${verificationType}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('verification-documents')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabaseAdmin.storage
          .from('verification-documents')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          fileName: file.originalname,
          url: urlData.publicUrl,
          size: file.size,
          type: file.mimetype
        });
      }
    }

    // Prepare submission data
    const submissionData = {
      files: uploadedFiles,
      notes: notes || null
    };

    if (verificationType === 'portfolio') {
      submissionData.portfolioLinks = portfolioLinks ? JSON.parse(portfolioLinks) : [];
    }

    // Check for existing pending submission
    const { data: existingSubmission } = await supabaseAdmin
      .from('verification_submissions')
      .select('id, status')
      .eq('artist_id', artist.id)
      .eq('verification_type', verificationType)
      .single();

    let result;
    if (existingSubmission && existingSubmission.status === 'pending') {
      // Update existing pending submission
      const { data, error } = await supabaseAdmin
        .from('verification_submissions')
        .update({
          submission_data: submissionData,
          submitted_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new submission
      const { data, error } = await supabaseAdmin
        .from('verification_submissions')
        .insert({
          artist_id: artist.id,
          verification_type: verificationType,
          submission_data: submissionData,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Update artist verification status
    await supabaseAdmin
      .from('artists')
      .update({ verification_status: 'pending' })
      .eq('id', artist.id);

    res.json({
      success: true,
      message: 'Verification submission received. We will review it shortly.',
      data: result
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/verification/my-submissions
 * @desc    Get artist's own verification submissions
 * @access  Private (Artist)
 */
router.get('/my-submissions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get artist profile
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (artistError) {
      return res.status(404).json({
        success: false,
        error: 'Artist profile not found'
      });
    }

    // Get all submissions
    const { data, error } = await supabaseAdmin
      .from('verification_submissions')
      .select('*')
      .eq('artist_id', artist.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/verification/pending
 * @desc    Get all pending verification submissions (Admin only)
 * @access  Private (Admin)
 */
router.get('/pending', authenticate, async (req, res) => {
  try {
    // TODO: Add admin role check
    // For now, this is open to all authenticated users
    // In production, add: if (!req.user.isAdmin) return res.status(403)...

    const { data, error } = await supabaseAdmin
      .from('verification_submissions')
      .select(`
        *,
        artists (
          id,
          user_id,
          bio,
          users (
            username,
            email,
            profile_picture
          )
        )
      `)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/verification/review/:submissionId
 * @desc    Approve or reject a verification submission (Admin only)
 * @access  Private (Admin)
 */
router.post('/review/:submissionId', authenticate, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { action, adminNotes } = req.body; // action: 'approve' or 'reject'
    const reviewerId = req.user.id;

    // TODO: Add admin role check
    // For now, this is open to all authenticated users
    // In production, add: if (!req.user.isAdmin) return res.status(403)...

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be either "approve" or "reject"'
      });
    }

    // Get submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('verification_submissions')
      .select('artist_id, verification_type')
      .eq('id', submissionId)
      .single();

    if (submissionError) throw submissionError;

    // Update submission
    const { data: updatedSubmission, error: updateError } = await supabaseAdmin
      .from('verification_submissions')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerId
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update artist verification status
    if (action === 'approve') {
      await supabaseAdmin
        .from('artists')
        .update({
          verified: true,
          verification_status: 'verified',
          verification_type: submission.verification_type,
          verified_at: new Date().toISOString()
        })
        .eq('id', submission.artist_id);
    } else {
      await supabaseAdmin
        .from('artists')
        .update({
          verification_status: 'rejected',
          verification_notes: adminNotes
        })
        .eq('id', submission.artist_id);
    }

    res.json({
      success: true,
      message: `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: updatedSubmission
    });
  } catch (error) {
    console.error('Error reviewing verification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/verification/badge-requirements
 * @desc    Get requirements for each verification badge
 * @access  Public
 */
router.get('/badge-requirements', async (req, res) => {
  try {
    const requirements = {
      portfolio: {
        name: 'Portfolio Verified',
        description: 'Artist has proven ownership of their portfolio',
        icon: 'shield-check',
        color: '#3B82F6',
        requirements: [
          'Link to at least one professional portfolio (ArtStation, DeviantArt, etc.)',
          'Provide verification code or screenshot showing account ownership',
          'Portfolio must contain at least 5 artworks',
          'Account must be at least 3 months old'
        ]
      },
      payment: {
        name: 'Payment Verified',
        description: 'Artist has completed at least 5 paid commissions on Erato',
        icon: 'credit-card-check',
        color: '#10B981',
        requirements: [
          'Complete at least 5 paid commissions',
          'Maintain an average rating of 4+ stars',
          'No disputes or chargebacks',
          'Account in good standing'
        ]
      },
      identity: {
        name: 'Identity Verified',
        description: 'Artist has verified their identity with Erato',
        icon: 'user-check',
        color: '#8B5CF6',
        requirements: [
          'Provide government-issued ID',
          'Complete video verification call (optional)',
          'Verify payment details match identity',
          'Pass background check (for commercial tiers)'
        ]
      }
    };

    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    console.error('Error fetching badge requirements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/verification/stats/:artistId
 * @desc    Get verification-related stats for an artist
 * @access  Public
 */
router.get('/stats/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;

    // Get artist verification info
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('verified, verification_status, verification_type, verified_at, user_id')
      .eq('id', artistId)
      .single();

    if (artistError) throw artistError;

    // Get completed commissions count
    const { count: completedCommissions, error: commissionsError } = await supabaseAdmin
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .eq('status', 'completed');

    if (commissionsError) throw commissionsError;

    // Get average rating
    const { data: reviews, error: reviewsError } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('artist_id', artistId);

    if (reviewsError) throw reviewsError;

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    // Calculate verification progress
    const verificationProgress = {
      portfolio: artist.verification_type === 'portfolio' && artist.verified,
      payment: completedCommissions >= 5 && averageRating >= 4.0,
      identity: artist.verification_type === 'identity' && artist.verified
    };

    res.json({
      success: true,
      data: {
        verified: artist.verified,
        status: artist.verification_status,
        type: artist.verification_type,
        verifiedAt: artist.verified_at,
        stats: {
          completedCommissions,
          averageRating: averageRating.toFixed(1),
          eligibleForPaymentBadge: completedCommissions >= 5 && averageRating >= 4.0
        },
        progress: verificationProgress
      }
    });
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
