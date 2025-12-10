# 📱 App Distribution Guide for Testing

This guide covers **free and easy** ways to distribute your app to ~5 testers.

## 🎯 Recommended: EAS Build (Internal Distribution)

**Best for:** Quick, easy distribution - already configured!

### Prerequisites
1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Link project: `cd frontend && eas build:configure` (if not already done)

### Build & Distribute

#### For Android (Easiest)
```bash
cd frontend
eas build --platform android --profile preview
```

After build completes, EAS will give you:
- A download link (share with testers)
- QR code to scan
- Direct install link

**Testers just need to:**
1. Click the link on their Android phone
2. Allow "Install from unknown sources" (one-time)
3. Install the APK

#### For iOS
```bash
cd frontend
eas build --platform ios --profile preview
```

**Requirements:**
- Apple Developer account ($99/year) OR
- Use TestFlight (free with Apple Developer account)

**Testers need to:**
1. Install TestFlight app
2. Accept your invitation email
3. Install from TestFlight

### Cost: **FREE** ✅
- EAS free tier: Unlimited internal distribution builds
- No credit card required

---

## 🔥 Alternative: Firebase App Distribution

**Best for:** More control, analytics, and easy updates

### Setup (One-time)

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project:**
   ```bash
   cd frontend
   firebase init appdistribution
   ```

4. **Add testers:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your project
   - Go to App Distribution
   - Add tester emails

### Build & Upload

#### Android
```bash
# Build APK locally or use EAS
cd frontend
eas build --platform android --profile preview --local

# Upload to Firebase
firebase appdistribution:distribute path/to/app.apk \
  --app YOUR_APP_ID \
  --groups "testers" \
  --release-notes "Version 1.0.0 - Initial test"
```

#### iOS
```bash
# Build IPA
eas build --platform ios --profile preview --local

# Upload to Firebase
firebase appdistribution:distribute path/to/app.ipa \
  --app YOUR_APP_ID \
  --groups "testers" \
  --release-notes "Version 1.0.0"
```

**Testers receive:**
- Email invitation
- Direct download link
- Easy updates (notifications when new builds available)

### Cost: **FREE** ✅
- Firebase free tier: Up to 10,000 testers
- No credit card required

---

## 📲 Alternative: Direct APK/IPA Sharing

**Best for:** Quick one-off testing, no setup needed

### Android (APK)

1. **Build APK:**
   ```bash
   cd frontend
   eas build --platform android --profile preview --local
   ```

2. **Share APK:**
   - Upload to Google Drive / Dropbox
   - Share link with testers
   - Or use [Transfer.sh](https://transfer.sh) for temporary hosting

3. **Testers install:**
   - Download APK
   - Enable "Install from unknown sources"
   - Install

### iOS (IPA)

1. **Build IPA:**
   ```bash
   cd frontend
   eas build --platform ios --profile preview --local
   ```

2. **Distribute via TestFlight:**
   - Upload to App Store Connect
   - Add testers via TestFlight
   - Free with Apple Developer account

**OR use Ad Hoc distribution:**
- Add device UDIDs to Apple Developer account
- Build with ad-hoc provisioning
- Share IPA directly (more complex)

---

## 🚀 Quick Start Scripts

I've created helper scripts in the root directory:
- `build-android.sh` - Build Android for testing
- `build-ios.sh` - Build iOS for testing
- `distribute-firebase.sh` - Upload to Firebase

---

## 📋 Comparison

| Method | Setup Time | Cost | Ease of Use | Best For |
|--------|-----------|------|-------------|----------|
| **EAS Internal** | ⚡ 2 min | FREE | ⭐⭐⭐⭐⭐ | Quick testing |
| **Firebase** | 🕐 10 min | FREE | ⭐⭐⭐⭐ | Ongoing testing |
| **Direct APK** | ⚡ 1 min | FREE | ⭐⭐⭐ | One-off testing |
| **TestFlight** | 🕐 15 min | $99/year | ⭐⭐⭐⭐ | iOS only |

---

## 🎯 Recommended Workflow

For **5 testers**, I recommend:

1. **Start with EAS Internal** (easiest, already configured)
   ```bash
   cd frontend
   eas build --platform android --profile preview
   ```
   Share the link with testers!

2. **If you need more features**, switch to Firebase App Distribution

3. **For iOS**, use TestFlight (requires Apple Developer account)

---

## 🔧 Troubleshooting

### "EAS not configured"
```bash
cd frontend
eas build:configure
```

### "Build failed"
- Check `eas.json` configuration
- Ensure all dependencies are installed
- Check Expo SDK version compatibility

### "Testers can't install"
- **Android:** Enable "Install from unknown sources"
- **iOS:** Ensure device UDID is registered (for ad-hoc) or use TestFlight

### "APK too large"
- Use `eas build` with `--local` flag to build locally
- Or optimize images before building

---

## 📞 Need Help?

- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Firebase App Distribution Docs](https://firebase.google.com/docs/app-distribution)
- [TestFlight Guide](https://developer.apple.com/testflight/)
