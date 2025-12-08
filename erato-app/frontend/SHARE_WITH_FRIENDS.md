# Share Your App with Friends (iOS & Android)

## ❌ Issue: Expo Go Doesn't Support SDK 52 Yet

Your project uses Expo SDK 52, which is very new. Expo Go in the App Store might not support it yet.

## ✅ Solution: Use Development Build (Better Anyway!)

Since you have `expo-dev-client` installed, you're already set up for development builds. This is actually **better** than Expo Go because:
- ✅ Supports all SDK versions (including SDK 52)
- ✅ Supports custom native modules
- ✅ More control and features
- ✅ Works exactly like Expo Go for your friends

---

## Option 1: Development Build (Recommended) 🚀

### For iOS (No Paid Account Needed for Testing!)

#### Step 1: Build Development Build
```bash
cd erato-app/frontend
eas build --profile development --platform ios
```

When prompted:
- **"Do you want to log in to your Apple account?"** → **yes**
- Use your Apple ID (free account works!)
- **"Generate a new keystore?"** → Let it generate automatically

#### Step 2: Install on Your Phone (and Friends' Phones)
- After build completes (~15-20 min), you'll get a link
- Open the link on iPhone
- Install the development build app
- This is a **custom Expo app** for your project

#### Step 3: Connect to Dev Server
```bash
npx expo start --dev-client
```

Then:
- Open your development build app on iPhone
- Shake device → "Enter URL manually"
- Enter the URL from terminal (like `exp://192.168.1.100:8081`)
- Or scan QR code if on same network

#### Step 4: Share with Friends
1. Build once: `eas build --profile development --platform ios`
2. Send them the download link
3. They install your custom development build app
4. When you're developing, run: `npx expo start --dev-client --tunnel`
5. Share the URL with friends
6. They open your dev build app and enter the URL

**Pros:**
- ✅ Works on iOS without paid account (free Apple ID works)
- ✅ Supports SDK 52
- ✅ Works when you're developing
- ✅ Can share with multiple friends

**Cons:**
- ⚠️ First build takes 15-20 minutes
- ⚠️ App expires after 7 days (need to rebuild, but only takes 5 min)

---

## Option 2: Android Development Build (Easier!)

### Step 1: Build for Android
```bash
cd erato-app/frontend
eas build --profile development --platform android
```

### Step 2: Share the Link
- Get download link from EAS
- Friend clicks on Android phone
- Downloads and installs APK
- Done!

### Step 3: Connect When Developing
```bash
npx expo start --dev-client --tunnel
```
- Friend opens your dev build app
- Enters the URL from your terminal
- They're testing! 🎉

---

## Quick Comparison

| Method | SDK 52 Support | iOS Free? | Setup Time | Best For |
|--------|---------------|-----------|------------|----------|
| **Expo Go** | ❌ No (too new) | ✅ Yes | 0 min | Old SDKs only |
| **Dev Build iOS** | ✅ Yes | ✅ Yes (free Apple ID) | 20 min | iOS + SDK 52 |
| **Dev Build Android** | ✅ Yes | N/A | 10 min | Android + SDK 52 |

---

## Your Current Setup

You're already configured for development builds! ✅
- `expo-dev-client` installed ✅
- `eas.json` configured ✅
- Just need to build once and share

---

## Recommended Workflow

1. **Build once**: `eas build --profile development --platform ios` (or `android`)
2. **Share download link** with friends
3. **When testing**: Run `npx expo start --dev-client --tunnel`
4. **Friends connect**: Open your dev build app → Enter URL

---

## Note About SDK 52

SDK 52 is very new (November 2024). Expo Go in the App Store might take a few weeks to update. Development builds work immediately with any SDK version!

---

**TL;DR**: Build a development build (one-time, 15-20 min), share the link with friends, then use `expo start --dev-client` when you're developing. Much better than Expo Go! 🚀

