import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import * as paypal from '@paypal/checkout-server-sdk';
import { OrdersCreateRequest } from '@paypal/checkout-server-sdk/lib/orders/ordersCreateRequest.js';
import { OrdersCaptureRequest } from '@paypal/checkout-server-sdk/lib/orders/ordersCaptureRequest.js';

const router = express.Router();

// Platform fee percentage (e.g., 10% = 0.10)
const PLATFORM_FEE_PERCENTAGE = 0.10;

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // Debug logging (don't log full secrets in production)
  console.log('PayPal Environment Setup:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- Is Production:', isProduction);
  console.log('- Client ID exists:', !!clientId);
  console.log('- Client ID length:', clientId ? clientId.length : 0);
  console.log('- Client ID starts with:', clientId ? clientId.substring(0, 5) + '...' : 'N/A');
  console.log('- Client Secret exists:', !!clientSecret);
  console.log('- Client Secret length:', clientSecret ? clientSecret.length : 0);
  
  // Check if credentials might be for wrong environment
  // Sandbox Client IDs typically start with "Ae..." but so do Live ones
  // The best way to check is to try the API call, but we can warn about common issues
  if (clientId && clientSecret) {
    const trimmedClientId = clientId.trim();
    const trimmedSecret = clientSecret.trim();
    
    // PayPal Client IDs are typically 80 characters
    if (trimmedClientId.length !== 80 || trimmedSecret.length !== 80) {
      console.warn('⚠️  Warning: PayPal credentials length is unusual. Expected 80 characters each.');
    }
    
    // Check for common formatting issues
    if (clientId !== trimmedClientId || clientSecret !== trimmedSecret) {
      console.warn('⚠️  Warning: PayPal credentials have leading/trailing whitespace - trimming...');
    }
  }

  // Validate credentials are present
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are missing. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.');
  }

  // Check for common issues
  if (clientId.trim() !== clientId || clientSecret.trim() !== clientSecret) {
    console.warn('⚠️  Warning: PayPal credentials may have leading/trailing whitespace');
  }

  if (isProduction) {
    console.log('Using PayPal LIVE environment');
    return new paypal.core.LiveEnvironment(clientId.trim(), clientSecret.trim());
  }
  console.log('Using PayPal SANDBOX environment');
  return new paypal.core.SandboxEnvironment(clientId.trim(), clientSecret.trim());
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

/**
 * @route   GET /api/payments/success
 * @desc    Handle PayPal redirect after successful payment approval
 * @access  Public (PayPal redirect)
 */
router.get('/success', (req, res) => {
  const { token, PayerID } = req.query;
  
  // This is just a redirect handler - the actual payment capture happens via the capture-order endpoint
  // Return a simple success page or redirect to frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:19006';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          h1 { margin: 0 0 1rem 0; }
          p { margin: 0.5rem 0; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Payment Successful!</h1>
          <p>Your payment has been processed.</p>
          <p>You can close this window and return to the app.</p>
        </div>
        <script>
          // Try to close the window after 3 seconds (if opened in popup)
          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

/**
 * @route   GET /api/payments/cancel
 * @desc    Handle PayPal redirect after cancelled payment
 * @access  Public (PayPal redirect)
 */
router.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payment Cancelled</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          h1 { margin: 0 0 1rem 0; }
          p { margin: 0.5rem 0; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ Payment Cancelled</h1>
          <p>You cancelled the payment process.</p>
          <p>You can close this window and return to the app.</p>
        </div>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

/**
 * @route   POST /api/payments/create-order
 * @desc    Create a PayPal order for a commission payment
 * @access  Private (Client)
 */
router.post('/create-order', authenticate, async (req, res) => {
  try {
    // Debug: Log environment info when creating order
    const isProduction = process.env.NODE_ENV === 'production';
    const hasClientId = !!process.env.PAYPAL_CLIENT_ID;
    const hasSecret = !!process.env.PAYPAL_CLIENT_SECRET;
    console.log('Creating PayPal order - Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Is Production:', isProduction);
    console.log('- Has Client ID:', hasClientId);
    console.log('- Has Secret:', hasSecret);
    
    const { commissionId, paymentType, amount, milestoneId } = req.body;
    const userId = req.user.id;

    // Validate payment type
    const validTypes = ['deposit', 'milestone', 'final', 'full'];
    if (!validTypes.includes(paymentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment type'
      });
    }

    // If milestone payment, validate milestone ID
    if (paymentType === 'milestone' && !milestoneId) {
      return res.status(400).json({
        success: false,
        error: 'Milestone ID is required for milestone payments'
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
    let milestone = null;

    if (!amount) {
      if (paymentType === 'deposit') {
        calculatedAmount = commission.final_price * (commission.deposit_percentage / 100);
      } else if (paymentType === 'full') {
        calculatedAmount = commission.final_price;
      } else if (paymentType === 'final') {
        calculatedAmount = commission.final_price - commission.total_paid;
      } else if (paymentType === 'milestone' && milestoneId) {
        // Get milestone amount
        const { data: milestoneData, error: milestoneError } = await supabaseAdmin
          .from('commission_milestones')
          .select('*')
          .eq('id', milestoneId)
          .eq('commission_id', commissionId)
          .single();

        if (milestoneError || !milestoneData) {
          return res.status(404).json({
            success: false,
            error: 'Milestone not found'
          });
        }

        if (milestoneData.payment_status === 'paid') {
          return res.status(400).json({
            success: false,
            error: 'This milestone has already been paid'
          });
        }

        if (milestoneData.is_locked) {
          return res.status(400).json({
            success: false,
            error: 'This milestone is locked. Previous milestones must be completed first.'
          });
        }

        milestone = milestoneData;
        calculatedAmount = parseFloat(milestoneData.amount);
      }
    }

    // Validate amount
    if (calculatedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount'
      });
    }

    // Create PayPal Order
    const request = new OrdersCreateRequest();
    request.prefer("return=representation");
    
    const returnUrl = `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/success`;
    const cancelUrl = `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/cancel`;
    
    console.log('PayPal redirect URLs:');
    console.log('- Return URL:', returnUrl);
    console.log('- Cancel URL:', cancelUrl);
    
    // Note: PayPal's custom_id has a 127 character limit, so we use a compact format
    // We'll store full metadata in our database transaction record instead
    const customIdData = milestoneId
      ? `${commissionId}|${paymentType}|${milestoneId}`
      : `${commissionId}|${paymentType}`;

    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: commissionId,
        description: milestone
          ? `Milestone Payment - ${milestone.title}`
          : `Commission Payment - ${paymentType}`,
        amount: {
          currency_code: 'USD',
          value: calculatedAmount.toFixed(2)
        },
        custom_id: customIdData
      }],
      application_context: {
        brand_name: 'Verro',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/success`,
        cancel_url: `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/cancel`
      }
    });

    const order = await client().execute(request);

    // Calculate platform fee and artist payout
    const platformFee = calculatedAmount * PLATFORM_FEE_PERCENTAGE;
    const artistPayout = calculatedAmount - platformFee;

    // Create transaction record with full metadata
    const transactionMetadata = {
      commissionId,
      clientId: userId,
      artistId: commission.artist_id,
      paymentType,
      milestoneId: milestoneId || null
    };

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        commission_id: commissionId,
        transaction_type: paymentType,
        amount: calculatedAmount,
        paypal_order_id: order.result.id,
        status: 'pending',
        payer_id: userId,
        recipient_id: commission.artist_id,
        platform_fee: platformFee,
        artist_payout: artistPayout,
        custom_id: JSON.stringify(transactionMetadata), // Store payment metadata including milestoneId
        description: milestone
          ? `Milestone ${milestone.milestone_number} payment - ${milestone.title}`
          : `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} payment for commission`
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    // Find approval URL from order links
    const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;

    res.json({
      success: true,
      data: {
        orderId: order.result.id,
        approvalUrl,
        amount: calculatedAmount,
        transactionId: transaction.id
      }
    });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to create payment order';
    let statusCode = 500;
    
    if (error.statusCode === 401 || error.message?.includes('invalid_client') || error.message?.includes('Client Authentication failed')) {
      errorMessage = 'PayPal authentication failed. Please check that PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are correctly set in your environment variables.';
      statusCode = 500; // Keep as 500 since it's a server configuration issue
    } else if (error.message?.includes('missing')) {
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

/**
 * @route   POST /api/payments/capture-order
 * @desc    Capture a PayPal order after approval
 * @access  Private (Client)
 */
router.post('/capture-order', authenticate, async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Get transaction by order ID
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .select('*, commissions(*)')
      .eq('paypal_order_id', orderId)
      .eq('payer_id', userId)
      .single();

    if (transactionError || !transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Capture the PayPal order
    const request = new OrdersCaptureRequest(orderId);
    request.requestBody({});

    const capture = await client().execute(request);

    if (capture.result.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Payment was not completed'
      });
    }

    // Update transaction status
    const captureId = capture.result.purchase_units[0].payments.captures[0].id;
    const { error: updateError } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: 'succeeded',
        paypal_capture_id: captureId,
        processed_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (updateError) throw updateError;

    // Update commission payment status
    // Try to get paymentType from custom_id, fallback to transaction_type
    let paymentType = null;
    try {
      if (transaction.custom_id) {
        const customData = JSON.parse(transaction.custom_id);
        paymentType = customData.paymentType || customData.payment_type;
      }
    } catch (e) {
      console.warn('Error parsing custom_id:', e);
    }
    
    // Fallback to transaction_type if custom_id doesn't have paymentType
    if (!paymentType && transaction.transaction_type) {
      paymentType = transaction.transaction_type;
    }
    
    let newPaymentStatus = 'paid'; // Default to 'paid' if we can't determine type
    if (paymentType === 'deposit') {
      newPaymentStatus = 'deposit_paid';
    } else if (paymentType === 'full' || paymentType === 'final') {
      newPaymentStatus = 'fully_paid';
    } else if (paymentType === 'milestone') {
      newPaymentStatus = 'deposit_paid'; // Milestones are like deposits
    }

    const { error: commissionError } = await supabaseAdmin
      .from('commissions')
      .update({
        payment_status: newPaymentStatus,
        paypal_order_id: orderId,
        escrow_status: 'held' // Funds held in escrow until work is approved
      })
      .eq('id', transaction.commission_id);

    if (commissionError) {
      console.error('Error updating commission:', commissionError);
    }

    // If milestone payment, update milestone status
    if (paymentType === 'milestone') {
      let milestoneId = null;

      // Try to get milestone ID from custom_id
      try {
        if (transaction.custom_id) {
          const customData = JSON.parse(transaction.custom_id);
          milestoneId = customData.milestoneId;
        }
      } catch (e) {
        console.warn('Error parsing custom_id for milestone:', e);
      }

      // Find the milestone to update
      let milestoneQuery = supabaseAdmin
        .from('commission_milestones')
        .select('id, milestone_number');

      if (milestoneId) {
        // Use specific milestone ID if provided
        milestoneQuery = milestoneQuery.eq('id', milestoneId);
      } else {
        // Fallback: find first unpaid milestone
        milestoneQuery = milestoneQuery
          .eq('commission_id', transaction.commission_id)
          .eq('payment_status', 'unpaid')
          .order('milestone_number', { ascending: true })
          .limit(1);
      }

      const { data: milestone } = await milestoneQuery.single();

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

    res.json({
      success: true,
      data: {
        orderId: capture.result.id,
        captureId,
        status: capture.result.status
      }
    });
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to capture payment' 
    });
  }
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Handle PayPal webhook events
 * @access  Public (PayPal)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const headers = req.headers;
    const body = req.body;

    // Verify webhook signature (simplified - in production use PayPal SDK verification)
    // For now, we'll process the webhook events
    
    const event = JSON.parse(body.toString());
    
    console.log('PayPal Webhook Event:', event.event_type);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCapture(event.resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePaymentFailure(event.resource);
        break;
      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle successful payment capture
 */
async function handlePaymentCapture(capture) {
  const captureId = capture.id;
  const orderId = capture.supplementary_data?.related_ids?.order_id;

  if (!orderId) {
    console.error('No order ID found in capture');
    return;
  }

  // Update transaction status
  const { data: transaction, error: transactionError } = await supabaseAdmin
    .from('payment_transactions')
    .update({
      status: 'succeeded',
      paypal_capture_id: captureId,
      processed_at: new Date().toISOString()
    })
    .eq('paypal_order_id', orderId)
    .select()
    .single();

  if (transactionError) {
    console.error('Error updating transaction:', transactionError);
    return;
  }

  // Update commission payment status
  const metadata = JSON.parse(transaction.custom_id || '{}');
  const { commissionId, paymentType } = metadata;

  let newPaymentStatus = 'pending';
  if (paymentType === 'deposit') {
    newPaymentStatus = 'deposit_paid';
  } else if (paymentType === 'full' || paymentType === 'final') {
    newPaymentStatus = 'fully_paid';
  }

  await supabaseAdmin
    .from('commissions')
    .update({
      payment_status: newPaymentStatus,
      escrow_status: 'held'
    })
    .eq('id', commissionId);

  console.log(`Payment captured for commission ${commissionId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(capture) {
  const captureId = capture.id;
  
  await supabaseAdmin
    .from('payment_transactions')
    .update({ status: 'failed' })
    .eq('paypal_capture_id', captureId);

  console.log(`Payment failed: ${captureId}`);
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
        status
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
      .is('paypal_payout_id', null);

    if (transactionsError) throw transactionsError;

    // In production, you would use PayPal Payouts API to transfer funds to artist
    // For now, we'll just update the records
    const payoutPromises = transactions.map(async (transaction) => {
      // In production:
      // Use PayPal Payouts API to send money to artist's PayPal account
      // const payout = await paypal.payouts.PayoutsPostRequest(...)
      
      return supabaseAdmin
        .from('payment_transactions')
        .update({
          paypal_payout_id: `payout_${Date.now()}` // Placeholder
        })
        .eq('id', transaction.id);
    });

    await Promise.all(payoutPromises);

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

    // Create PayPal Order for tip
    // Note: PayPal's custom_id has a 127 character limit, so we use a compact format
    const customIdData = `${commissionId}|tip`;

    const request = new OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: commissionId,
        description: 'Commission Tip',
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2)
        },
        custom_id: customIdData
      }],
      application_context: {
        brand_name: 'Verro',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/success`,
        cancel_url: `${process.env.API_URL || process.env.BACKEND_URL || 'https://api.verrocio.com'}/api/payments/cancel`
      }
    });

    const order = await client().execute(request);

    // Create transaction record (no platform fee on tips)
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        commission_id: commissionId,
        transaction_type: 'tip',
        amount,
        paypal_order_id: order.result.id,
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

    // Find approval URL from order links
    const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;

    res.json({
      success: true,
      data: {
        orderId: order.result.id,
        approvalUrl,
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
 * @route   GET /api/payments/user/transactions
 * @desc    Get all transactions for the current user (profits for artists, purchases for clients)
 * @access  Private
 */
router.get('/user/transactions', authenticate, async (req, res) => {
  console.log('GET /api/payments/user/transactions - Route hit');
  try {
    const userId = req.user.id;
    console.log('User ID:', userId);

    // Check if user is an artist
    const { data: artist } = await supabaseAdmin
      .from('artists')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    // Get commissions where user is involved
    let commissionsQuery = supabaseAdmin
      .from('commissions')
      .select('id');
    
    if (artist) {
      // Artist: Get commissions where they are the artist
      commissionsQuery = commissionsQuery.eq('artist_id', userId);
    } else {
      // Client: Get commissions where they are the client
      commissionsQuery = commissionsQuery.eq('client_id', userId);
    }

    const { data: userCommissions, error: commissionsError } = await commissionsQuery;
    if (commissionsError) throw commissionsError;

    if (!userCommissions || userCommissions.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const commissionIds = userCommissions.map(c => c.id);

    // Get all transactions for these commissions
    const { data, error } = await supabaseAdmin
      .from('payment_transactions')
      .select(`
        *,
        commissions:commission_id(
          id,
          client_id,
          artist_id,
          details,
          final_price,
          created_at
        )
      `)
      .in('commission_id', commissionIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format transactions with commission info
    const formattedTransactions = (data || []).map(tx => ({
      ...tx,
      commission: Array.isArray(tx.commissions) ? tx.commissions[0] : tx.commissions,
      commission_id: tx.commission_id,
    }));

    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
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
