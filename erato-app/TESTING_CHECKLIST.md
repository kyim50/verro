# Testing Checklist - App Distribution

## ✅ Pre-Build Checklist

- [x] Fixed Supabase crash (made optional)
- [x] Added Error Boundary
- [x] Added global error handlers
- [x] Added timeouts to all API calls (15 seconds)
- [x] Improved SecureStore error handling
- [x] Added network error handling
- [x] Added safety timeout for app initialization (10 seconds max)

## 🚀 Build Steps

1. **Commit all changes:**
   ```bash
   cd erato-app/frontend
   git add .
   git commit -m "fix: add comprehensive error handling and crash prevention"
   git push
   ```

2. **Build for Android:**
   ```bash
   cd erato-app/frontend
   eas build --platform android --profile preview
   ```

3. **Wait for build** (10-15 minutes)

4. **Get download link** from EAS dashboard or build output

## 📱 Testing on Phones

### What to Test

1. **First Launch:**
   - [ ] App opens without crashing
   - [ ] Shows loading screen
   - [ ] Navigates to login/onboarding

2. **Network Scenarios:**
   - [ ] Works with good WiFi
   - [ ] Works with mobile data
   - [ ] Handles offline gracefully (shows error, doesn't crash)
   - [ ] Handles slow connection (timeouts work)

3. **Authentication:**
   - [ ] Can register new account
   - [ ] Can login
   - [ ] Can logout
   - [ ] Invalid credentials show error (don't crash)

4. **Core Features:**
   - [ ] Can browse artworks
   - [ ] Can view profiles
   - [ ] Can swipe artists
   - [ ] Can send messages
   - [ ] Can upload images

5. **Error Handling:**
   - [ ] Network errors show messages (don't crash)
   - [ ] API errors are handled gracefully
   - [ ] App recovers from errors

## 🐛 If App Still Crashes

### Get Logs

**Android:**
```bash
# Connect phone via USB, enable USB debugging
adb logcat | grep -E "FATAL|AndroidRuntime|ReactNative|Error|Exception"
```

**Or use device:**
- Settings → Developer Options → Take Bug Report
- Share the bug report

### Common Issues

1. **"App keeps stopping"**
   - Check logcat for FATAL EXCEPTION
   - Look for specific error message

2. **"Network error"**
   - Verify API is accessible: `curl https://api.verrocio.com/api/health`
   - Check phone's internet connection

3. **"Blank screen"**
   - Check if Error Boundary is showing
   - Check logcat for JavaScript errors

4. **"Can't install"**
   - Enable "Install from unknown sources" on Android
   - Check if APK is corrupted (re-download)

## 📊 What Was Fixed

### Crash Prevention
- ✅ Supabase won't crash if not configured
- ✅ Network errors won't crash app
- ✅ SecureStore errors won't crash app
- ✅ API timeouts won't hang app
- ✅ Unhandled errors caught by Error Boundary

### Error Handling
- ✅ All API calls have 15-second timeouts
- ✅ All async operations wrapped in try-catch
- ✅ Global error handlers for unhandled errors
- ✅ Safety timeout for app initialization (10 seconds)

### User Experience
- ✅ Error messages instead of crashes
- ✅ App continues working even if some features fail
- ✅ Graceful degradation when offline

## 🎯 Success Criteria

The app is ready for testing if:
- ✅ Builds successfully
- ✅ Installs on test phones
- ✅ Opens without crashing
- ✅ Shows login screen (or onboarding)
- ✅ Handles network errors gracefully

## 📞 Next Steps After Testing

1. Collect feedback from testers
2. Note any crashes with logcat output
3. Test on different Android versions
4. Test on different screen sizes
5. Monitor API logs for errors

---

**Remember:** The app should NEVER crash silently. All errors should either:
- Show a user-friendly message
- Be caught by Error Boundary
- Be logged to console/logcat
