# Environment Variables Reference

Copy this file to `.env` and fill in your actual values. **Never commit `.env` to Git!**

## Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=10000

# Supabase Configuration (get from Supabase Dashboard → Settings → API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_random_jwt_secret_here

# Frontend URL (for CORS and Socket.io)
# Development: exp://192.168.1.100:19000 (or your Expo dev server URL)
# Production: https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-url.com

# AWS S3 Configuration (for image uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# Rate Limiting (Optional - for development/testing)
# Set RELAXED_RATE_LIMITS=true on Render to get lenient limits (1000 req/min) for testing
# Production should use default strict limits (100 req/15min)
RELAXED_RATE_LIMITS=false
# Or set custom limits:
# RATE_LIMIT_WINDOW_MS=900000 (15 minutes in milliseconds)
# RATE_LIMIT_MAX_REQUESTS=100
```

## How to Get Each Value

### Supabase
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (keep this secret!)

### JWT Secret
Generate a secure random string:
```bash
openssl rand -base64 32
```

Or use an online generator, but keep it secret!

### AWS Credentials
1. AWS Console → IAM → Users
2. Create a user with S3 access permissions
3. Create access keys → use for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### Frontend URL
- **Development (Expo)**: Your Expo dev server URL (shown when running `expo start`)
- **Production**: Your deployed app domain or Expo published URL


