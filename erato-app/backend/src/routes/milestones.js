import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { NotificationService } from '../utils/redisServices.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

const router = express.Router();

/**
 * @route   GET /api/milestones/templates
 * @desc    Get available milestone stage templates
 * @access  Private
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from('milestone_stage_templates')
      .select('*')
      .order('typical_order', { ascending: true });

    if (error) throw error;

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching milestone templates:', error);
    res.status(500).json({ error: 'Failed to fetch milestone templates' });
  }
});

/**
 * @route   POST /api/milestones/commission/:commissionId/generate
 * @desc    Generate default milestones for a commission (hybrid approach)
 * @access  Private (Artist only)
 */
router.post('/commission/:commissionId/generate', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;

    // Verify commission exists and user is the artist
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, artist_id, client_id, final_price, budget, package_id, status')
      .eq('id', commissionId)
      .single();

    if (commissionError || !commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can generate milestones' });
    }

    // Use final_price if set, otherwise use budget
    const price = commission.final_price || commission.budget;
    if (!price) {
      return res.status(400).json({ error: 'Commission must have a price or budget set' });
    }

    // Check if milestones already exist
    const { data: existingMilestones } = await supabaseAdmin
      .from('commission_milestones')
      .select('id')
      .eq('commission_id', commissionId);

    if (existingMilestones && existingMilestones.length > 0) {
      return res.status(400).json({ error: 'Milestones already exist for this commission' });
    }

    // Get milestone templates
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('milestone_stage_templates')
      .select('*')
      .order('typical_order', { ascending: true });

    if (templatesError) throw templatesError;

    // Generate milestones based on templates
    const totalPrice = parseFloat(price);
    const milestones = templates.map((template, index) => {
      const percentage = parseFloat(template.default_percentage);
      const amount = (totalPrice * percentage) / 100;

      return {
        commission_id: commissionId,
        milestone_number: index + 1,
        stage: template.stage,
        title: template.display_name,
        description: template.description,
        amount: amount.toFixed(2),
        percentage: percentage.toFixed(2),
        payment_status: 'unpaid',
        payment_required_before_work: true,
        is_locked: index === 0 ? false : true // Only first milestone is unlocked
      };
    });

    // Insert milestones
    const { data: createdMilestones, error: insertError } = await supabaseAdmin
      .from('commission_milestones')
      .insert(milestones)
      .select();

    if (insertError) throw insertError;

    // Set the first milestone as current
    await supabaseAdmin
      .from('commissions')
      .update({ current_milestone_id: createdMilestones[0].id })
      .eq('id', commissionId);

    res.status(201).json({
      message: 'Milestones generated successfully',
      milestones: createdMilestones
    });
  } catch (error) {
    console.error('Error generating milestones:', error);
    res.status(500).json({ error: 'Failed to generate milestones' });
  }
});

/**
 * @route   GET /api/milestones/commission/:commissionId
 * @desc    Get all milestones for a commission
 * @access  Private (Client or Artist)
 */
router.get('/commission/:commissionId', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;

    // Verify user is part of the commission
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, artist_id, client_id')
      .eq('id', commissionId)
      .single();

    if (commissionError || !commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.artist_id !== req.user.id && commission.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get milestones with payment transaction details
    const { data: milestones, error } = await supabaseAdmin
      .from('commission_milestones')
      .select(`
        *,
        payment_transaction:payment_transactions(
          id,
          amount,
          status,
          paypal_order_id,
          processed_at
        ),
        progress_update:commission_progress_updates(
          id,
          update_type,
          image_url,
          notes,
          approval_status,
          created_at
        )
      `)
      .eq('commission_id', commissionId)
      .order('milestone_number', { ascending: true });

    if (error) throw error;

    res.json({ milestones });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

/**
 * @route   PUT /api/milestones/:milestoneId
 * @desc    Update milestone details (artist can edit before confirmation)
 * @access  Private (Artist only)
 */
router.put('/:milestoneId', authenticate, async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { title, description, amount, percentage, stage } = req.body;

    // Get milestone and verify ownership
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from('commission_milestones')
      .select('*, commission:commissions(id, artist_id, milestone_plan_confirmed)')
      .eq('id', milestoneId)
      .single();

    if (milestoneError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can edit milestones' });
    }

    // Check if milestone plan is already confirmed
    if (milestone.commission.milestone_plan_confirmed) {
      return res.status(400).json({ error: 'Cannot edit milestones after plan is confirmed by client' });
    }

    // Check if milestone is already paid
    if (milestone.payment_status === 'paid') {
      return res.status(400).json({ error: 'Cannot edit paid milestones' });
    }

    // Update milestone
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = amount;
    if (percentage !== undefined) updates.percentage = percentage;
    if (stage !== undefined) updates.stage = stage;
    updates.updated_at = new Date().toISOString();

    const { data: updatedMilestone, error: updateError } = await supabaseAdmin
      .from('commission_milestones')
      .update(updates)
      .eq('id', milestoneId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: 'Milestone updated successfully',
      milestone: updatedMilestone
    });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

/**
 * @route   POST /api/milestones/commission/:commissionId/confirm
 * @desc    Client confirms the milestone plan
 * @access  Private (Client only)
 */
router.post('/commission/:commissionId/confirm', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.params;

    // Verify commission exists and user is the client
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, artist_id, client_id, milestone_plan_confirmed, final_price')
      .eq('id', commissionId)
      .single();

    if (commissionError || !commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    if (commission.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the client can confirm the milestone plan' });
    }

    if (commission.milestone_plan_confirmed) {
      return res.status(400).json({ error: 'Milestone plan is already confirmed' });
    }

    // Verify milestones exist and add up to 100%
    const { data: milestones, error: milestonesError } = await supabaseAdmin
      .from('commission_milestones')
      .select('percentage, amount')
      .eq('commission_id', commissionId);

    if (milestonesError) throw milestonesError;

    if (!milestones || milestones.length === 0) {
      return res.status(400).json({ error: 'No milestones have been created yet' });
    }

    const totalPercentage = milestones.reduce((sum, m) => sum + parseFloat(m.percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({
        error: `Milestones must add up to 100%. Current total: ${totalPercentage.toFixed(2)}%`
      });
    }

    // Confirm the plan
    const { error: updateError } = await supabaseAdmin
      .from('commissions')
      .update({
        milestone_plan_confirmed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', commissionId);

    if (updateError) throw updateError;

    // Send notification to artist
    const { data: artist } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', commission.artist_id)
      .single();

    if (artist) {
      await NotificationService.createNotification(
        artist.id,
        'milestone_plan_confirmed',
        `Client confirmed the milestone payment plan for commission`,
        `/commissions/${commissionId}`,
        { commission_id: commissionId }
      );

      await sendPushToUser(artist.id, {
        title: 'Milestone Plan Confirmed',
        body: 'Your client confirmed the milestone payment plan',
        data: { type: 'milestone_plan_confirmed', commissionId }
      });
    }

    res.json({
      message: 'Milestone plan confirmed successfully'
    });
  } catch (error) {
    console.error('Error confirming milestone plan:', error);
    res.status(500).json({ error: 'Failed to confirm milestone plan' });
  }
});

/**
 * @route   POST /api/milestones/:milestoneId/start
 * @desc    Artist marks a milestone as started (requires payment if payment_required_before_work)
 * @access  Private (Artist only)
 */
router.post('/:milestoneId/start', authenticate, async (req, res) => {
  try {
    const { milestoneId } = req.params;

    // Get milestone with commission details
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from('commission_milestones')
      .select('*, commission:commissions(id, artist_id, current_milestone_id, milestone_plan_confirmed)')
      .eq('id', milestoneId)
      .single();

    if (milestoneError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can start a milestone' });
    }

    if (!milestone.commission.milestone_plan_confirmed) {
      return res.status(400).json({ error: 'Client must confirm the milestone plan first' });
    }

    if (milestone.is_locked) {
      return res.status(400).json({ error: 'This milestone is locked. Complete previous milestones first.' });
    }

    // Check if payment is required before work
    if (milestone.payment_required_before_work && milestone.payment_status !== 'paid') {
      return res.status(400).json({
        error: 'Payment must be received before starting work on this milestone',
        requires_payment: true,
        milestone_id: milestoneId
      });
    }

    // Set this as the current milestone
    const { error: updateError } = await supabaseAdmin
      .from('commissions')
      .update({
        current_milestone_id: milestoneId,
        updated_at: new Date().toISOString()
      })
      .eq('id', milestone.commission_id);

    if (updateError) throw updateError;

    res.json({
      message: 'Milestone started successfully',
      milestone_id: milestoneId
    });
  } catch (error) {
    console.error('Error starting milestone:', error);
    res.status(500).json({ error: 'Failed to start milestone' });
  }
});

/**
 * @route   POST /api/milestones/:milestoneId/complete
 * @desc    Artist marks a milestone as complete (creates approval checkpoint)
 * @access  Private (Artist only)
 */
router.post('/:milestoneId/complete', authenticate, async (req, res) => {
  try {
    const { milestoneId } = req.params;
    const { image_url, notes, additional_images = [] } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'Image URL is required for milestone completion' });
    }

    // Get milestone with commission details
    const { data: milestone, error: milestoneError } = await supabaseAdmin
      .from('commission_milestones')
      .select('*, commission:commissions(id, artist_id, client_id, current_milestone_id)')
      .eq('id', milestoneId)
      .single();

    if (milestoneError || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.commission.artist_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the artist can complete a milestone' });
    }

    // Create approval checkpoint progress update
    const { data: progressUpdate, error: progressError } = await supabaseAdmin
      .from('commission_progress_updates')
      .insert({
        commission_id: milestone.commission_id,
        update_type: 'approval_checkpoint',
        created_by: req.user.id,
        image_url,
        metadata: additional_images.length > 0 ? { additional_images } : null,
        notes: notes || `Milestone ${milestone.milestone_number}: ${milestone.title} - Ready for approval`,
        requires_approval: true,
        approval_status: 'pending',
        milestone_id: milestoneId,
        milestone_stage: milestone.stage
      })
      .select()
      .single();

    if (progressError) throw progressError;

    // Update milestone with progress update reference
    await supabaseAdmin
      .from('commission_milestones')
      .update({
        progress_update_id: progressUpdate.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', milestoneId);

    // Send notification to client
    const { data: client } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', milestone.commission.client_id)
      .single();

    if (client) {
      await NotificationService.createNotification(
        client.id,
        'milestone_approval_needed',
        `Artist completed ${milestone.title} - approval needed`,
        `/commissions/${milestone.commission_id}`,
        {
          commission_id: milestone.commission_id,
          milestone_id: milestoneId,
          progress_update_id: progressUpdate.id
        }
      );

      await sendPushToUser(client.id, {
        title: 'Milestone Ready for Review',
        body: `${milestone.title} is ready for your approval`,
        data: {
          type: 'milestone_approval_needed',
          commissionId: milestone.commission_id,
          milestoneId
        }
      });
    }

    res.status(201).json({
      message: 'Milestone marked as complete and sent for approval',
      progress_update: progressUpdate
    });
  } catch (error) {
    console.error('Error completing milestone:', error);
    res.status(500).json({ error: 'Failed to complete milestone' });
  }
});

/**
 * @route   GET /api/milestones/:milestoneId/payment-status
 * @desc    Check if a milestone can be paid
 * @access  Private (Client only)
 */
router.get('/:milestoneId/payment-status', authenticate, async (req, res) => {
  try {
    const { milestoneId } = req.params;

    const { data: milestone, error } = await supabaseAdmin
      .from('commission_milestones')
      .select('*, commission:commissions(id, client_id, milestone_plan_confirmed)')
      .eq('id', milestoneId)
      .single();

    if (error || !milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (milestone.commission.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the client can check payment status' });
    }

    const canPay = milestone.payment_status === 'unpaid' &&
                   !milestone.is_locked &&
                   milestone.commission.milestone_plan_confirmed;

    res.json({
      milestone_id: milestoneId,
      payment_status: milestone.payment_status,
      is_locked: milestone.is_locked,
      can_pay: canPay,
      amount: milestone.amount,
      title: milestone.title
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

export default router;
