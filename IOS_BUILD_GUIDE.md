# iOS Build Guide for Verro

## Prerequisites

1. **Mac Computer** - Required for iOS builds
2. **Xcode** - Install from App Store (latest version)
3. **Apple Developer Account** - Free or paid ($99/year for App Store distribution)
4. **Physical iPhone** - For testing on your device

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
cd erato-app/frontend
eas login
```

## Step 3: Configure EAS Build

Create `eas.json` in the frontend directory:

```bash
eas build:configure
```

This creates an `eas.json` file. Update it to:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

## Step 4: Update app.json

Make sure your `app.json` has proper iOS configuration:

```json
{
  "expo": {
    "name": "Verro",
    "slug": "verro",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourname.verro",
      "supportsTablet": false,
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "This app needs access to your photo library to upload artworks and profile pictures.",
        "NSCameraUsageDescription": "This app needs access to your camera to take photos for artworks and profile pictures."
      }
    }
  }
}
```

## Step 5: Build for Your iPhone (Development Build)

### Option A: Build for Physical Device (Recommended)

1. **Start the build:**
   ```bash
   eas build --profile development --platform ios
   ```

2. **Follow the prompts:**
   - Sign in with your Apple ID
   - Register your device (it will ask you to scan a QR code on your iPhone)
   - Wait for the build (10-20 minutes)

3. **Install on your iPhone:**
   - You'll get a link when the build is done
   - Open the link on your iPhone
   - Download and install the app

### Option B: Build for Simulator (Mac only, for testing)

```bash
eas build --profile development --platform ios --local
```

## Step 6: Run the Development Server

Once the app is installed on your device:

```bash
# In the frontend directory
npm start
```

Then press `i` for iOS or scan the QR code with your iPhone (if you have Expo Go installed).

## Step 7: Building for TestFlight/App Store

### Preview Build (Internal Testing)

```bash
eas build --profile preview --platform ios
```

This creates an IPA file you can distribute to testers.

### Production Build (App Store)

```bash
eas build --profile production --platform ios
```

Then submit to App Store:

```bash
eas submit --platform ios
```

## Quick Commands Reference

### Development (for your own testing)
```bash
# Build and install on your iPhone
eas build --profile development --platform ios

# Start dev server
npm start
```

### Update the app (after making changes)
```bash
# If you're using Expo Updates
eas update --branch development --message "Your update message"
```

### Check build status
```bash
eas build:list
```

## Troubleshooting

### "No development client available"
- Make sure you built with `--profile development`
- Install Expo Go from App Store as fallback

### "Certificate/Provisioning Profile issues"
```bash
# Reset credentials and try again
eas credentials
```

### Can't install on device
- Make sure your device is registered in your Apple Developer account
- Check Settings > General > VPN & Device Management on your iPhone

## Environment Variables

Make sure your `.env` file has the correct API URL:

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3000/api
```

Replace `YOUR_COMPUTER_IP` with your Mac's local IP address (find it in System Settings > Network).

## Cost-Free Option

If you don't want to pay for Apple Developer Program ($99/year):
- Use the **development** profile
- Install on up to 100 devices
- Apps expire after 7 days and need reinstalling
- Cannot publish to App Store

## Notes

- First build takes 15-30 minutes
- Subsequent builds are faster
- Development builds work for 7 days before needing reinstall
- Production builds never expire but require paid Apple Developer account
