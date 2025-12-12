import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * @route   POST /api/user-preferences
 * @desc    Save or update user preferences from style quiz
 * @access  Private
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      preferred_styles,
      interests,
      budget_range,
      commission_frequency,
      completed_quiz
    } = req.body;

    // Validate that user is not an artist
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (artist) {
      return res.status(403).json({
        success: false,
        error: 'Artists cannot set client preferences'
      });
    }

    // Prepare preferences data
    const preferencesData = {
      user_id: userId,
      preferred_styles: Array.isArray(preferred_styles) ? preferred_styles : [],
      interests: Array.isArray(interests) ? interests : [],
      budget_range: budget_range || null,
      commission_frequency: commission_frequency || null,
      completed_quiz: completed_quiz !== undefined ? completed_quiz : true,
      updated_at: new Date().toISOString()
    };

    // Upsert preferences
    const { data: preferences, error } = await supabaseAdmin
      .from('user_preferences')
      .upsert(preferencesData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Preferences saved successfully',
      data: preferences
    });
  } catch (error) {
    console.error('Error in POST /user-preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-preferences
 * @desc    Get user's preferences
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: preferences, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user preferences:', error);
      throw error;
    }

    res.json({
      success: true,
      data: preferences || null
    });
  } catch (error) {
    console.error('Error in GET /user-preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/user-preferences
 * @desc    Update specific preference fields
 * @access  Private
 */
router.put('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Remove user_id if provided (shouldn't be updated)
    delete updates.user_id;

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString();

    // Update preferences
    const { data: preferences, error } = await supabaseAdmin
      .from('user_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    console.error('Error in PUT /user-preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/user-preferences
 * @desc    Delete user preferences
 * @access  Private
 */
router.delete('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting user preferences:', error);
      throw error;
    }

    res.json({
      success: true,
      message: 'Preferences deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /user-preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/user-preferences/check-quiz
 * @desc    Check if user has completed the style quiz
 * @access  Private
 */
router.get('/check-quiz', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: preferences, error } = await supabaseAdmin
      .from('user_preferences')
      .select('completed_quiz')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking quiz completion:', error);
      throw error;
    }

    res.json({
      success: true,
      completed: preferences?.completed_quiz || false
    });
  } catch (error) {
    console.error('Error in GET /user-preferences/check-quiz:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
