# Quick Deployment Checklist

## Before You Start
- [ ] Backend code is in a GitHub repository
- [ ] All environment variables documented (see `ENV_VARIABLES.md`)
- [ ] Supabase credentials ready
- [ ] AWS credentials ready (if using S3)

## Step 1: Deploy Backend to Render (10 minutes)

1. **Sign up/Login to Render**: https://render.com
2. **New Web Service** → Connect GitHub repo
3. **Configure**:
   - Name: `erato-backend-api`
   - Environment: `Node`
   - Build: `npm install`
   - Start: `npm start`
   - Root Directory: `backend` (if backend is in subfolder)
4. **Add Environment Variables** (from `ENV_VARIABLES.md`):
   - `NODE_ENV=production`
   - `PORT=10000`
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_KEY=...`
   - `SUPABASE_ANON_KEY=...`
   - `JWT_SECRET=...` (generate new one!)
   - `FRONTEND_URL=...`
   - `AWS_ACCESS_KEY_ID=...` (if using S3)
   - `AWS_SECRET_ACCESS_KEY=...` (if using S3)
   - `AWS_REGION=us-east-1` (if using S3)
   - `AWS_S3_BUCKET=...` (if using S3)
5. **Deploy** → Wait ~5 minutes
6. **Copy your API URL**: `https://erato-backend-api.onrender.com`

## Step 2: Update Frontend (5 minutes)

1. **Update `frontend/app.json`**:
   ```json
   "extra": {
     "EXPO_PUBLIC_API_URL": "https://your-render-url.onrender.com/api"
   }
   ```

2. **Restart Expo**:
   ```bash
   cd frontend
   npx expo start --clear
   ```

3. **Rebuild app** (for production):
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

## Step 3: Test

1. **Check health endpoint**: Visit `https://your-api-url.onrender.com/health`
2. **Test login/signup** from your app
3. **Check Render logs** if something fails

## Common Issues

### ❌ Service won't start
- Check Render logs for errors
- Verify all environment variables are set
- Ensure `PORT=10000`

### ❌ CORS errors
- Update `FRONTEND_URL` in Render environment variables
- Make sure it matches your frontend URL exactly

### ❌ Slow first request
- Normal on free tier (cold starts ~30 seconds)
- Upgrade to paid plan for always-on

### ❌ Database connection failed
- Verify Supabase credentials are correct
- Check Supabase project is active

## Your API URL Format

- Base URL: `https://erato-backend-api.onrender.com`
- Full endpoint: `https://erato-backend-api.onrender.com/api/auth/login`

## Auto-Deploy

Render automatically deploys when you push to `main` branch! 🎉

Just push your changes:
```bash
git add .
git commit -m "Update API"
git push origin main
```

## Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure monitoring/alerting
- [ ] Set up database backups
- [ ] Consider upgrading to paid plan for production

