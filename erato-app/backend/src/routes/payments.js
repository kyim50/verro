import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import Stripe from 'stripe';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Platform fee percentage (e.g., 10% = 0.10)
const PLATFORM_FEE_PERCENTAGE = 0.10;

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a Stripe payment intent for a commission
 * @access  Private (Client)
 */
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { commissionId, paymentType, amount } = req.body;
    const userId = req.user.id;

    // Validate payment type
    const validTypes = ['deposit', 'milestone', 'final', 'full'];
    if (!validTypes.includes(paymentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment type'
      });
    }

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select(`
        id,
        client_id,
        artist_id,
        final_price,
        payment_type,
        payment_status,
        deposit_percentage,
        total_paid
      `)
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    // Verify user is the client
    if (commission.client_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the client can make payments'
      });
    }

    // Calculate amount based on payment type
    let calculatedAmount = amount;
    if (!amount) {
      if (paymentType === 'deposit') {
        calculatedAmount = commission.final_price * (commission.deposit_percentage / 100);
      } else if (paymentType === 'full') {
        calculatedAmount = commission.final_price;
      } else if (paymentType === 'final') {
        calculatedAmount = commission.final_price - commission.total_paid;
      }
    }

    // Validate amount
    if (calculatedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount'
      });
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(calculatedAmount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        commissionId,
        clientId: userId,
        artistId: commission.artist_id,
        paymentType
      },
      description: `Commission Payment - ${paymentType}`,
      automatic_payment_methods: {
        enabled: true
      }
    });

    // Create transaction record
    const platformFee = calculatedAmount * PLATFORM_FEE_PERCENTAGE;
    const artistPayout = calculatedAmount - platformFee;

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        commission_id: commissionId,
        transaction_type: paymentType,
        amount: calculatedAmount,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        payer_id: userId,
        recipient_id: commission.artist_id,
        platform_fee: platformFee,
        artist_payout: artistPayout,
        description: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} payment for commission`
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: calculatedAmount,
        transactionId: transaction.id
      }
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle Stripe webhook events
 * @access  Public (Stripe)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  const { commissionId, paymentType } = paymentIntent.metadata;

  // Update transaction status
  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from('payment_transactions')
    .update({
      status: 'succeeded',
      stripe_charge_id: paymentIntent.latest_charge,
      processed_at: new Date().toISOString()
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select()
    .single();

  if (transactionError) {
    console.error('Error updating transaction:', transactionError);
    return;
  }

  // Update commission payment status
  let newPaymentStatus = 'pending';
  if (paymentType === 'deposit') {
    newPaymentStatus = 'deposit_paid';
  } else if (paymentType === 'full' || paymentType === 'final') {
    newPaymentStatus = 'fully_paid';
  }

  const { error: commissionError } = await supabaseAdmin
    .from('commissions')
    .update({
      payment_status: newPaymentStatus,
      stripe_payment_intent_id: paymentIntent.id,
      escrow_status: 'held' // Funds held in escrow until work is approved
    })
    .eq('id', commissionId);

  if (commissionError) {
    console.error('Error updating commission:', commissionError);
  }

  // If milestone payment, update milestone status
  if (paymentType === 'milestone') {
    // Find the associated milestone
    const { data: milestone } = await supabaseAdmin
      .from('commission_milestones')
      .select('id')
      .eq('commission_id', commissionId)
      .eq('payment_status', 'unpaid')
      .order('milestone_number', { ascending: true })
      .limit(1)
      .single();

    if (milestone) {
      await supabaseAdmin
        .from('commission_milestones')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          payment_transaction_id: transaction.id
        })
        .eq('id', milestone.id);
    }
  }

  console.log(`Payment succeeded for commission ${commissionId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  await supabaseAdmin
    .from('payment_transactions')
    .update({ status: 'failed' })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  console.log(`Payment failed: ${paymentIntent.id}`);
}

/**
 * Handle refund
 */
async function handleRefund(charge) {
  const { data: transaction } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, commission_id')
    .eq('stripe_charge_id', charge.id)
    .single();

  if (transaction) {
    await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: 'refunded',
        refunded_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    // Update commission escrow status
    await supabaseAdmin
      .from('commissions')
      .update({ escrow_status: 'refunded' })
      .eq('id', transaction.commission_id);
  }

  console.log(`Refund processed for charge ${charge.id}`);
}

/**
 * @route   POST /api/payments/release-escrow
 * @desc    Release escrowed funds to artist after client approval
 * @access  Private (Client or System)
 */
router.post('/release-escrow', authenticate, async (req, res) => {
  try {
    const { commissionId } = req.body;
    const userId = req.user.id;

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select(`
        id,
        client_id,
        artist_id,
        escrow_status,
        status,
        artists (
          user_id,
          users (
            stripe_account_id
          )
        )
      `)
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    // Verify user is the client
    if (commission.client_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the client can release escrow'
      });
    }

    // Verify commission is completed
    if (commission.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Commission must be completed before releasing escrow'
      });
    }

    // Verify escrow is held
    if (commission.escrow_status !== 'held') {
      return res.status(400).json({
        success: false,
        error: 'No funds are currently held in escrow'
      });
    }

    // Get all succeeded transactions for this commission
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('commission_id', commissionId)
      .eq('status', 'succeeded')
      .is('stripe_transfer_id', null);

    if (transactionsError) throw transactionsError;

    // Transfer funds to artist (in production, you'd use Stripe Connect)
    // For now, we'll just update the records
    const transferPromises = transactions.map(async (transaction) => {
      // In production:
      // const transfer = await stripe.transfers.create({
      //   amount: Math.round(transaction.artist_payout * 100),
      //   currency: 'usd',
      //   destination: commission.artists.users.stripe_account_id,
      //   transfer_group: commissionId,
      // });

      return supabaseAdmin
        .from('payment_transactions')
        .update({
          stripe_transfer_id: `transfer_${Date.now()}` // Placeholder
        })
        .eq('id', transaction.id);
    });

    await Promise.all(transferPromises);

    // Update commission escrow status
    await supabaseAdmin
      .from('commissions')
      .update({ escrow_status: 'released' })
      .eq('id', commissionId);

    res.json({
      success: true,
      message: 'Funds released to artist successfully'
    });
  } catch (error) {
    console.error('Error releasing escrow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/payments/tip
 * @desc    Add a tip to a completed commission
 * @access  Private (Client)
 */
router.post('/tip', authenticate, async (req, res) => {
  try {
    const { commissionId, amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Tip amount must be greater than 0'
      });
    }

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, client_id, artist_id, status')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    // Verify user is the client
    if (commission.client_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the client can add a tip'
      });
    }

    // Verify commission is completed
    if (commission.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only tip completed commissions'
      });
    }

    // Create Stripe Payment Intent for tip
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      metadata: {
        commissionId,
        clientId: userId,
        artistId: commission.artist_id,
        paymentType: 'tip'
      },
      description: 'Commission Tip',
      automatic_payment_methods: {
        enabled: true
      }
    });

    // Create transaction record (no platform fee on tips)
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        commission_id: commissionId,
        transaction_type: 'tip',
        amount,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        payer_id: userId,
        recipient_id: commission.artist_id,
        platform_fee: 0, // No fee on tips
        artist_payout: amount,
        description: 'Tip for excellent work'
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        transactionId: transaction.id
      }
    });
  } catch (error) {
    console.error('Error processing tip:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/payments/commission/:commissionId/transactions
 * @desc    Get all transactions for a commission
 * @access  Private (Client or Artist)
 */
router.get('/commission/:commissionId/transactions', authenticate, async (req, res) => {
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
        error: 'You do not have permission to view these transactions'
      });
    }

    // Get all transactions
    const { data, error } = await supabaseAdmin
      .from('payment_transactions')
      .select('*')
      .eq('commission_id', commissionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/payments/milestones
 * @desc    Create milestones for a commission
 * @access  Private (Artist)
 */
router.post('/milestones', authenticate, async (req, res) => {
  try {
    const { commissionId, milestones } = req.body;
    const userId = req.user.id;

    // Get commission details
    const { data: commission, error: commissionError } = await supabaseAdmin
      .from('commissions')
      .select('id, artist_id, final_price')
      .eq('id', commissionId)
      .single();

    if (commissionError) throw commissionError;

    // Verify user is the artist
    if (commission.artist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the artist can create milestones'
      });
    }

    // Validate milestones
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Milestones must be a non-empty array'
      });
    }

    // Calculate total percentage
    const totalPercentage = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Milestone percentages must add up to 100%'
      });
    }

    // Create milestones
    const milestoneRecords = milestones.map((milestone, index) => ({
      commission_id: commissionId,
      milestone_number: index + 1,
      title: milestone.title,
      description: milestone.description,
      amount: commission.final_price * (milestone.percentage / 100),
      percentage: milestone.percentage,
      due_date: milestone.dueDate || null
    }));

    const { data, error } = await supabaseAdmin
      .from('commission_milestones')
      .insert(milestoneRecords)
      .select();

    if (error) throw error;

    // Update commission payment type
    await supabaseAdmin
      .from('commissions')
      .update({ payment_type: 'milestone' })
      .eq('id', commissionId);

    res.json({
      success: true,
      message: 'Milestones created successfully',
      data
    });
  } catch (error) {
    console.error('Error creating milestones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/payments/milestones/:commissionId
 * @desc    Get milestones for a commission
 * @access  Private (Client or Artist)
 */
router.get('/milestones/:commissionId', authenticate, async (req, res) => {
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
        error: 'You do not have permission to view these milestones'
      });
    }

    // Get milestones
    const { data, error } = await supabaseAdmin
      .from('commission_milestones')
      .select('*')
      .eq('commission_id', commissionId)
      .order('milestone_number', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
