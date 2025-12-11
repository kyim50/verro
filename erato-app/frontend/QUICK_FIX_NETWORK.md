# Quick Fix: Network Error

## The Problem
You're seeing "Network error: Could not reach server" when uploading.

## Quick Checks

### 1. Check if API URL is set correctly
After rebuilding, check the console logs. You should see:
```
📡 API URL configured: https://api.verrocio.com...
```

If you see the old IP address or "NOT SET", the environment variable isn't being injected.

### 2. Verify EAS Secrets
Run this to check if your secrets are set:
```bash
cd erato-app/frontend
eas secret:list
```

You should see:
- `EXPO_PUBLIC_API_URL` = `https://api.verrocio.com/api`
- `EXPO_PUBLIC_SOCKET_URL` = `https://api.verrocio.com`

### 3. If secrets are missing, set them:
```bash
cd erato-app/frontend
./setup-env.sh
```

### 4. Rebuild
```bash
./build-all.sh
```

## What I Fixed

✅ Updated all hardcoded API URLs from `http://3.18.213.189:3000/api` to `https://api.verrocio.com/api`
✅ Added debug logging to show which API URL is being used
✅ Better error messages that show the attempted URL

## Files Updated
- `store/index.js`
- `store/boardStore.js`
- `utils/imageUpload.js`
- `app/artwork/upload.js`
- `app/profile/edit.js`
- `app/profile/edit-portfolio.js`
- `lib/socket.js`

## Still Not Working?

1. **Check backend server status:**
   - Is `https://api.verrocio.com/api` accessible?
   - Try opening it in a browser

2. **Check network:**
   - Is your device on the same network?
   - Try on WiFi vs mobile data

3. **Check build profile:**
   - Make sure you're building with the correct profile (production/preview/development)

4. **Check console logs:**
   - Look for the `📡 API URL configured:` log
   - This will tell you what URL is actually being used
