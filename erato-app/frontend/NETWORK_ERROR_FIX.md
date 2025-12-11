# Network Error Fix

## Issue
"Network error: Could not reach server" when uploading images

## Root Cause
The API URL might not be correctly configured in the Android build, or there's a mismatch between different fallback URLs in the code.

## Fixes Applied

### 1. ✅ Standardized API URL Fallback
- Changed all hardcoded fallbacks from `http://3.18.213.189:3000/api` to `https://api.verrocio.com/api`
- This matches the URL in `eas.json`

### 2. ✅ Added Debug Logging
- Added console logs to show which API URL is being used
- This will help identify if the environment variable is set correctly

### 3. ✅ Better Error Messages
- More detailed error messages showing the API URL attempted
- Clearer network error messages

## Files Changed
- `store/index.js` - Updated API URL fallback
- `utils/imageUpload.js` - Updated API URL fallback and added logging
- `app/artwork/upload.js` - Updated API URL fallback and added logging

## Debugging Steps

1. **Check if API URL is set in build:**
   - Look for console log: `📡 API URL configured: https://api.verrocio.com...`
   - If it shows "NOT SET", the environment variable isn't being injected

2. **Verify backend is accessible:**
   - Check if `https://api.verrocio.com/api` is accessible from your device
   - Try opening it in a browser on the same network

3. **Check EAS secrets:**
   ```bash
   cd erato-app/frontend
   eas secret:list
   ```
   - Should see `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL`

4. **Rebuild with correct environment:**
   ```bash
   cd erato-app/frontend
   ./build-all.sh
   ```

## Common Issues

### Issue 1: API URL not set in build
**Symptom:** Logs show "NOT SET" or fallback URL
**Fix:** Run `setup-env.sh` to set EAS secrets, then rebuild

### Issue 2: Backend not accessible
**Symptom:** Network error even with correct URL
**Fix:** 
- Check if backend server is running
- Check firewall/security group settings
- Verify SSL certificate is valid

### Issue 3: Wrong build profile
**Symptom:** Using development URL in production build
**Fix:** Make sure you're building with the correct profile:
```bash
eas build --platform android --profile production
```

## Next Steps

1. Rebuild the app
2. Check console logs for API URL
3. Test upload again
4. If still failing, check backend server status
