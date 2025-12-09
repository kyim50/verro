# Share Your App with Friends (iOS & Android)

## Option 1: Expo Go (Easiest - No Build Needed!) 📱

**Best for**: Quick testing, development, sharing with friends

### How It Works:
1. Your friend downloads **Expo Go** from App Store (free)
2. You run your dev server
3. Share QR code or link
4. Friend opens it in Expo Go
5. Done! 🎉

### Steps:

#### On Your Computer:

1. **Start your dev server**:
   ```bash
   cd erato-app/frontend
   npx expo start
   ```

2. **Choose connection method**:

   **Option A: Same WiFi (Fastest)**
   - Make sure phone and computer are on same WiFi
   - Just run: `npx expo start`
   - Share the QR code shown in terminal

   **Option B: Tunnel Mode (Works from anywhere)**
   - Run: `npx expo start --tunnel`
   - Works even if friend is on different network
   - Slower but more flexible
   - Share the QR code or URL shown

#### On Friend's iPhone:

1. **Download Expo Go**:
   - Open App Store
   - Search "Expo Go"
   - Install (free)

2. **Connect to your app**:
   - Open Expo Go app
   - Tap "Scan QR Code"
   - Scan the QR code from your terminal
   - Or enter the URL manually (like `exp://192.168.1.100:8081`)

3. **Your app loads!**
   - Wait for it to download
   - App appears in Expo Go
   - Works perfectly for testing

### Pros ✅:
- **Completely free**
- **No Apple Developer account needed**
- **Works on iOS and Android**
- **Instant updates** (when you save code, friend sees changes)
- **Easy to share** (just send QR code)

### Cons ⚠️:
- Friend needs Expo Go installed
- Your computer must be running (`npx expo start`)
- Some native modules might not work
- Shows "Expo Go" branding

---

## Option 2: EAS Build for Android (Standalone App)

**Best for**: Android phones, want a standalone app

### Steps:

1. **Build Android app**:
   ```bash
   cd erato-app/frontend
   eas build --platform android --profile preview
   ```
   - First time: Set up credentials (say "yes" to generate keystore)
   - Wait 10-20 minutes for build

2. **Get shareable link**:
   - EAS will give you a download link
   - Looks like: `https://expo.dev/artifacts/...`

3. **Share with friend**:
   - Send them the link
   - Friend clicks on Android phone
   - Downloads APK file
   - Enables "Install from unknown sources" (one-time)
   - Installs app

### Pros ✅:
- **Standalone app** (no Expo Go needed)
- **Works when your computer is off**
- **Completely free**
- **Looks professional**

---

## Option 3: Paid Apple Developer Account ($99/year)

**Only if you want iOS standalone apps**

- Get Apple Developer account ($99/year)
- Build with EAS: `eas build --platform ios --profile preview`
- Distribute via TestFlight (Apple's testing platform)
- Friends get invitation via email
- Professional solution for iOS

---

## Recommendation for You 🎯

**For iOS friends**: Use **Expo Go** (Option 1)
- Free ✅
- No account needed ✅
- Works immediately ✅
- Easy to share ✅

**For Android friends**: Use **EAS Build** (Option 2)
- Free ✅
- Standalone app ✅
- Professional ✅

---

## Quick Start: Share via Expo Go Right Now

```bash
cd erato-app/frontend
npx expo start --tunnel
```

Then:
1. Share the QR code with your friend
2. Friend downloads Expo Go
3. Friend scans QR code
4. Done! They're testing your app! 🚀

---

## Troubleshooting

### Friend can't connect
- **Same WiFi issue**: Use `--tunnel` mode instead
- **Tunnel slow**: Normal, first load takes time
- **QR code not scanning**: Share the URL manually

### App doesn't load
- Make sure your computer is running `expo start`
- Check your API URL is correct in `app.json`
- Verify Render backend is running

### Friend needs to test when you're not online
- Use EAS Build instead (creates standalone app)
- Or pay for Apple Developer account for iOS

---

**TL;DR**: For iOS friends without paid account → Use Expo Go. Just send them the QR code! 📸


