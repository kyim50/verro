# EC2 Environment Variables Setup Guide

This guide will help you set up PayPal environment variables on your EC2 instance.

## Prerequisites

- SSH access to your EC2 instance
- PayPal credentials (Client ID, Client Secret, Webhook ID)
- Access to the backend `.env` file on EC2

## Step 1: Connect to EC2

You can use the provided SSH script:

```bash
cd erato-app
./ssh-ec2.sh
```

Or manually SSH:
```bash
ssh -i /Users/kimanimcleish/Desktop/Projects/verro/erato-app/verro.pem ubuntu@3.18.213.189
```

## Step 2: Navigate to Backend Directory

Once connected to EC2:

```bash
# Navigate to your project directory (adjust path if different)
cd ~/verro/erato-app/backend

# Or if using Docker Compose, navigate to the project root
cd ~/verro/erato-app
```

## Step 3: Edit the .env File

```bash
# If using Docker Compose (recommended)
nano backend/.env

# Or if running directly
nano .env
```

## Step 4: Add PayPal Environment Variables

Add the following lines to your `.env` file:

```env
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here  # Optional, for webhook verification

# Environment (should already be set)
NODE_ENV=production
```

**Important Notes:**
- Replace `your_paypal_client_id_here` with your actual PayPal Client ID
- Replace `your_paypal_client_secret_here` with your actual PayPal Client Secret
- Replace `your_webhook_id_here` with your PayPal Webhook ID (if you set up webhooks)
- For production, use **Live** credentials from PayPal Developer Dashboard
- For testing, use **Sandbox** credentials and set `NODE_ENV=development`

## Step 5: Restart Services

### If using Docker Compose:

```bash
# Navigate to project root
cd ~/verro/erato-app

# Restart the backend service
docker-compose -f docker-compose.prod.yml restart backend

# Or rebuild if needed
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### If running directly:

```bash
# Restart your Node.js process (adjust based on your process manager)
pm2 restart erato-backend
# or
systemctl restart erato-backend
# or kill and restart manually
```

## Step 6: Verify Environment Variables

Check that the environment variables are loaded:

```bash
# If using Docker Compose
docker-compose -f docker-compose.prod.yml exec backend env | grep PAYPAL

# Or check the .env file
cat backend/.env | grep PAYPAL
```

## Step 7: Test the Integration

1. Check backend logs for any errors:
   ```bash
   # Docker Compose
   docker-compose -f docker-compose.prod.yml logs backend
   
   # Or if running directly
   pm2 logs erato-backend
   ```

2. Test a payment flow in your app
3. Check PayPal Dashboard for transaction logs

## Quick Setup Script

You can also use this one-liner to add the variables (replace with your actual values):

```bash
cat >> backend/.env << EOF

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_WEBHOOK_ID=your_webhook_id_here
EOF
```

Then restart the backend service.

## Troubleshooting

### Variables not loading?
- Make sure `.env` file is in the correct location (`backend/.env`)
- Check Docker Compose `env_file` path matches your `.env` location
- Restart the service after adding variables

### PayPal errors?
- Verify credentials are correct (no extra spaces)
- Check if using sandbox credentials in production mode
- Ensure `NODE_ENV` matches your PayPal environment (production vs sandbox)

### Permission issues?
- Make sure you have write access to the `.env` file
- Check file permissions: `ls -la backend/.env`

## Security Notes

⚠️ **Important Security Reminders:**

1. Never commit `.env` files to version control
2. Keep your PayPal credentials secure
3. Use different credentials for development and production
4. Regularly rotate your API keys
5. Use environment-specific credentials (sandbox for dev, live for prod)

## Additional Resources

- See `PAYPAL_SETUP.md` for PayPal integration details
- PayPal Developer Dashboard: https://developer.paypal.com/
- Check `docker-compose.prod.yml` for environment variable configuration

