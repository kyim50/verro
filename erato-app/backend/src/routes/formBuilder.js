import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * @route   GET /api/form-builder/package/:packageId
 * @desc    Get custom form fields for a commission package
 * @access  Public
 */
router.get('/package/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('commission_packages')
      .select('custom_form_fields, title, description')
      .eq('id', packageId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        packageId,
        title: data.title,
        description: data.description,
        formFields: data.custom_form_fields || []
      }
    });
  } catch (error) {
    console.error('Error fetching form fields:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/form-builder/package/:packageId
 * @desc    Update custom form fields for a commission package
 * @access  Private (Artist who owns the package)
 */
router.put('/package/:packageId', authenticate, async (req, res) => {
  try {
    const { packageId } = req.params;
    const { formFields } = req.body;
    const userId = req.user.id;

    // Verify package belongs to the authenticated artist
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('commission_packages')
      .select('artist_id')
      .eq('id', packageId)
      .single();

    if (packageError) throw packageError;

    // Check if user owns this package
    const { data: artist, error: artistError } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('user_id', userId)
      .eq('id', packageData.artist_id)
      .single();

    if (artistError || !artist) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to edit this package'
      });
    }

    // Validate form fields structure
    if (!Array.isArray(formFields)) {
      return res.status(400).json({
        success: false,
        error: 'formFields must be an array'
      });
    }

    // Validate each field
    for (const field of formFields) {
      if (!field.id || !field.type || !field.label) {
        return res.status(400).json({
          success: false,
          error: 'Each field must have id, type, and label'
        });
      }

      // Validate field type
      const validTypes = [
        'text', 'textarea', 'number', 'select', 'multiselect',
        'checkbox', 'radio', 'date', 'file', 'color', 'url'
      ];
      if (!validTypes.includes(field.type)) {
        return res.status(400).json({
          success: false,
          error: `Invalid field type: ${field.type}`
        });
      }
    }

    // Update the package with new form fields
    const { data, error } = await supabaseAdmin
      .from('commission_packages')
      .update({ custom_form_fields: formFields })
      .eq('id', packageId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Form fields updated successfully',
      data: {
        packageId,
        formFields: data.custom_form_fields
      }
    });
  } catch (error) {
    console.error('Error updating form fields:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/form-builder/commission/:commissionId/submit
 * @desc    Submit form responses for a commission
 * @access  Private (Client)
 */
router.post('/commission/:commissionId/submit', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;
    const { responses } = req.body;
    const userId = req.user.id;

    // Verify commission belongs to the authenticated user (as client)
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('client_id, package_id, status')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    if (commission.client_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to submit this form'
      });
    }

    // Get the package form fields for validation
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('commission_packages')
      .select('custom_form_fields')
      .eq('id', commission.package_id)
      .single();

    if (packageError) throw packageError;

    const formFields = packageData.custom_form_fields || [];

    // Validate responses against form fields
    const validationErrors = [];
    for (const field of formFields) {
      if (field.required && !responses[field.id]) {
        validationErrors.push(`${field.label} is required`);
      }

      // Type-specific validation
      if (responses[field.id]) {
        const value = responses[field.id];

        switch (field.type) {
          case 'number':
            if (isNaN(value)) {
              validationErrors.push(`${field.label} must be a number`);
            }
            if (field.min !== undefined && value < field.min) {
              validationErrors.push(`${field.label} must be at least ${field.min}`);
            }
            if (field.max !== undefined && value > field.max) {
              validationErrors.push(`${field.label} must be at most ${field.max}`);
            }
            break;

          case 'url':
            try {
              new URL(value);
            } catch {
              validationErrors.push(`${field.label} must be a valid URL`);
            }
            break;

          case 'file':
            if (!Array.isArray(value) || value.length === 0) {
              if (field.required) {
                validationErrors.push(`${field.label} requires at least one file`);
              }
            }
            if (field.maxFiles && value.length > field.maxFiles) {
              validationErrors.push(`${field.label} accepts maximum ${field.maxFiles} files`);
            }
            break;

          case 'multiselect':
            if (!Array.isArray(value)) {
              validationErrors.push(`${field.label} must be an array of selections`);
            }
            break;
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: validationErrors
      });
    }

    // Save responses to commission
    const { data, error } = await supabaseAdmin
      .from('commissions')
      .update({ form_responses: responses })
      .eq('id', commissionId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: {
        commissionId,
        responses: data.form_responses
      }
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/form-builder/commission/:commissionId/responses
 * @desc    Get form responses for a commission
 * @access  Private (Client or Artist involved in commission)
 */
router.get('/commission/:commissionId/responses', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;
    const userId = req.user.id;

    // Get commission with form responses
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select(`
        id,
        client_id,
        artist_id,
        package_id,
        form_responses,
        commission_packages (
          custom_form_fields
        )
      `)
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    // Verify user is involved in the commission
    if (commission.client_id !== userId && commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this form'
      });
    }

    res.json({
      success: true,
      data: {
        commissionId,
        formFields: commission.commission_packages?.custom_form_fields || [],
        responses: commission.form_responses || {}
      }
    });
  } catch (error) {
    console.error('Error fetching form responses:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/form-builder/templates
 * @desc    Get predefined form field templates
 * @access  Private (Artists)
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const templates = {
      basic: [
        {
          id: 'description',
          type: 'textarea',
          label: 'Commission Description',
          placeholder: 'Describe what you want me to draw...',
          required: true,
          rows: 4
        },
        {
          id: 'deadline',
          type: 'date',
          label: 'Preferred Deadline',
          required: false
        },
        {
          id: 'references',
          type: 'file',
          label: 'Reference Images',
          required: true,
          accept: 'image/*',
          maxFiles: 10,
          helpText: 'Upload up to 10 reference images'
        }
      ],
      character: [
        {
          id: 'character_name',
          type: 'text',
          label: 'Character Name',
          required: true
        },
        {
          id: 'character_type',
          type: 'select',
          label: 'Character Type',
          required: true,
          options: ['Human', 'Anthro/Furry', 'Fantasy Creature', 'Robot/Mech', 'Other']
        },
        {
          id: 'character_gender',
          type: 'select',
          label: 'Gender',
          required: false,
          options: ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say']
        },
        {
          id: 'character_sheet',
          type: 'file',
          label: 'Character Reference Sheet',
          required: true,
          accept: 'image/*',
          maxFiles: 5
        },
        {
          id: 'pose',
          type: 'select',
          label: 'Desired Pose',
          required: false,
          options: ['Standing', 'Sitting', 'Action Pose', 'Portrait', 'Full Body', 'Artist Choice']
        },
        {
          id: 'expression',
          type: 'text',
          label: 'Expression/Mood',
          placeholder: 'e.g., Happy, serious, excited...',
          required: false
        },
        {
          id: 'outfit',
          type: 'textarea',
          label: 'Outfit Description',
          placeholder: 'Describe what the character should wear...',
          required: false,
          rows: 3
        },
        {
          id: 'color_palette',
          type: 'textarea',
          label: 'Color Palette/Preferences',
          placeholder: 'Hex codes or color names...',
          required: false,
          rows: 2
        }
      ],
      background: [
        {
          id: 'background_type',
          type: 'select',
          label: 'Background Type',
          required: true,
          options: ['Simple/Solid Color', 'Abstract', 'Detailed Scene', 'Transparent', 'Artist Choice']
        },
        {
          id: 'background_description',
          type: 'textarea',
          label: 'Background Description',
          placeholder: 'Describe the background scene...',
          required: false,
          rows: 3,
          conditional: {
            field: 'background_type',
            value: 'Detailed Scene'
          }
        },
        {
          id: 'mood_references',
          type: 'file',
          label: 'Mood Board/Inspiration',
          required: false,
          accept: 'image/*',
          maxFiles: 10
        }
      ],
      commercial: [
        {
          id: 'usage_type',
          type: 'multiselect',
          label: 'Intended Usage',
          required: true,
          options: ['Personal Use', 'Social Media', 'Streaming/VTubing', 'Merchandise', 'Book Cover', 'Album Art', 'Commercial Marketing']
        },
        {
          id: 'print_size',
          type: 'select',
          label: 'Print Size (if applicable)',
          required: false,
          options: ['Not for print', 'A4', 'A3', 'A2', 'A1', 'Custom Size']
        },
        {
          id: 'custom_size',
          type: 'text',
          label: 'Custom Size',
          placeholder: 'e.g., 3000x4000px or 24x36 inches',
          required: false,
          conditional: {
            field: 'print_size',
            value: 'Custom Size'
          }
        },
        {
          id: 'commercial_details',
          type: 'textarea',
          label: 'Commercial Usage Details',
          placeholder: 'Explain how you plan to use this artwork commercially...',
          required: false,
          rows: 4
        }
      ]
    };

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
