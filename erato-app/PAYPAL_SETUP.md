# PayPal Payment Integration Setup Guide

This guide will walk you through setting up PayPal payments for your Verro commission platform.

## Prerequisites

- A PayPal Business Account
- Access to PayPal Developer Dashboard
- Backend server with environment variables configured

## Step 1: Create PayPal Application

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Log in with your PayPal Business Account
3. Navigate to **Dashboard** → **My Apps & Credentials**
4. Click **Create App**
5. Fill in the details:
   - **App Name**: Verro Commission Platform (or your preferred name)
   - **Merchant**: Select your business account
   - **Features**: Enable **Accept Payments**
6. Click **Create App**

## Step 2: Get API Credentials

After creating the app, you'll see two sets of credentials:

### Sandbox Credentials (for testing)
- **Client ID**: Starts with `Ae...`
- **Client Secret**: Starts with `EF...`

### Live Credentials (for production)
- **Client ID**: Starts with `Ae...`
- **Client Secret**: Starts with `EF...`

**Important**: Keep these credentials secure! Never commit them to version control.

## Step 3: Configure Environment Variables

Add the following environment variables to your backend `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here  # Optional, for webhook verification

# Environment
NODE_ENV=development  # Use 'production' for live PayPal
```

### For Production

When ready for production:

1. Switch to **Live** credentials in PayPal Developer Dashboard
2. Update your `.env`:
   ```env
   NODE_ENV=production
   PAYPAL_CLIENT_ID=your_live_client_id
   PAYPAL_CLIENT_SECRET=your_live_client_secret
   ```

## Step 4: Install PayPal SDK (if not already installed)

The backend already includes `@paypal/checkout-server-sdk`. Verify it's installed:

```bash
cd erato-app/backend
npm install @paypal/checkout-server-sdk
```

## Step 5: Set Up PayPal Webhook (Optional but Recommended)

Webhooks allow PayPal to notify your server of payment events.

1. In PayPal Developer Dashboard, go to your app
2. Scroll to **Webhooks** section
3. Click **Add Webhook**
4. Enter your webhook URL:
   - Development: `https://api.verrocio.com/api/payments/webhook`
   - Production: `https://your-production-url.com/api/payments/webhook`
5. Select events to listen for:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
6. Copy the **Webhook ID** and add it to your `.env`:
   ```env
   
   ```

## Step 6: Test the Integration

### Test with Sandbox Accounts

1. Create test accounts in PayPal Sandbox:
   - Go to **Dashboard** → **Accounts** → **Create Account**
   - Create a **Personal** account (for testing client payments)
   - Create a **Business** account (for testing merchant side)

2. Test the payment flow:
   - Create a commission request
   - Accept the commission (as artist)
   - Make a payment (as client)
   - Use sandbox test card: `4032034816716173` (exp: 12/25, CVV: 123)

### Test Payment Flow

1. **Client makes deposit payment**:
   - Commission status: `accepted`
   - Payment status: `unpaid`
   - "Make Deposit Payment" button should appear

2. **After deposit**:
   - Payment status changes to: `deposit_paid`
   - Status shows: "Deposit Paid - Waiting for Commission to Complete"
   - Artist can start working

3. **After completion**:
   - Commission status: `completed`
   - Payment status: `deposit_paid`
   - "Make Final Payment" button appears
   - Status shows: "Waiting for Final Payment"

4. **After final payment**:
   - Payment status: `fully_paid`
   - Status shows: "Fully Paid"

## Step 7: Payment Flow Logic

The payment flow follows this logic:

### For Clients:
1. **Commission Accepted** → Payment button appears (deposit)
2. **Deposit Paid** → Status: "Deposit Paid - Waiting for Commission to Complete"
3. **Commission Completed** → Payment button appears (final payment)
4. **Final Payment Made** → Status: "Fully Paid"

### For Artists:
- View transaction history showing all earnings
- See platform fee deductions
- Track profits vs. gross payments

## Step 8: Platform Fee Configuration

The platform fee is currently set to **10%** in `erato-app/backend/src/routes/payments.js`:

```javascript
const PLATFORM_FEE_PERCENTAGE = 0.10; // 10%
```

To change this, modify the constant in the payments route file.

## Step 9: Go Live Checklist

Before going live:

- [ ] Switch to Live credentials
- [ ] Set `NODE_ENV=production`
- [ ] Test with real PayPal accounts (small amounts)
- [ ] Verify webhook is working
- [ ] Set up monitoring/alerts for failed payments
- [ ] Review PayPal's terms of service
- [ ] Set up proper error handling and logging
- [ ] Test refund flow
- [ ] Verify escrow release functionality

## Troubleshooting

### Common Issues

1. **"Invalid Client ID"**
   - Verify credentials are correct
   - Check if using sandbox credentials in production mode

2. **"Payment not completed"**
   - Check PayPal order status
   - Verify webhook is receiving events
   - Check backend logs for errors

3. **"Webhook verification failed"**
   - Verify webhook URL is accessible
   - Check webhook ID matches
   - Ensure webhook events are subscribed

### Testing Tips

- Use PayPal's [Sandbox Testing Guide](https://developer.paypal.com/docs/api-basics/sandbox/)
- Check transaction logs in PayPal Dashboard
- Monitor backend logs for API errors
- Test with different payment amounts
- Test refund scenarios

## Additional Resources

- [PayPal REST API Documentation](https://developer.paypal.com/docs/api/overview/)
- [PayPal Checkout SDK](https://developer.paypal.com/docs/checkout/)
- [Webhook Events Reference](https://developer.paypal.com/docs/api-basics/notifications/webhooks/event-names/)

## Support

For PayPal-specific issues, contact PayPal Developer Support or check their documentation.

For application-specific issues, check the backend logs and ensure all environment variables are correctly set.

