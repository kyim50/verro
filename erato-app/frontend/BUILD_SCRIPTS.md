# Build Scripts Guide

I've created automated scripts to handle everything from environment setup to building your app.

## 🚀 Quick Start

**One command to do everything:**
```bash
cd erato-app/frontend
./build-all.sh
```

This will:
1. ✅ Set up all environment variables (if needed)
2. ✅ Build your Android app for testing

## 📜 Available Scripts

### 1. `build-all.sh` - Master Script (Recommended)
**Does everything in one go:**
```bash
./build-all.sh                    # Android preview (default)
./build-all.sh ios                # iOS preview
./build-all.sh android production # Android production
```

### 2. `setup-env.sh` - Environment Setup
**Sets up EAS environment variables:**
```bash
./setup-env.sh
```

This will:
- Set up API URLs automatically
- Prompt you for Supabase credentials
- Create all EAS secrets

### 3. `build.sh` - Build Script
**Main build script with options:**
```bash
./build.sh                        # Android preview (default)
./build.sh --ios                  # iOS
./build.sh --platform android --profile production
./build.sh --help                 # See all options
```

**Options:**
- `--platform <android|ios>` - Build platform
- `--profile <preview|production|development>` - Build profile
- `--skip-env-check` - Skip environment variable check

### 4. `quick-build.sh` - Quick Build
**Simple one-command build:**
```bash
./quick-build.sh                  # Android
./quick-build.sh ios              # iOS
```

## 📋 Step-by-Step Usage

### First Time Setup

1. **Navigate to frontend directory:**
   ```bash
   cd erato-app/frontend
   ```

2. **Run the master script:**
   ```bash
   ./build-all.sh
   ```

3. **When prompted, enter your Supabase credentials:**
   - Get them from: https://app.supabase.com → Your Project → Settings → API
   - Enter Supabase URL (e.g., `https://xxxxx.supabase.co`)
   - Enter Supabase Anon Key (starts with `eyJ...`)

4. **Wait for build to complete** (10-15 minutes)

5. **Share the download link** with your testers!

### Subsequent Builds

Just run:
```bash
./build-all.sh
```

Or if you just want to build (skip setup):
```bash
./build.sh
```

## 🔧 What Gets Configured

### Automatically Set:
- ✅ `EXPO_PUBLIC_API_URL` → `https://api.verrocio.com/api`
- ✅ `EXPO_PUBLIC_SOCKET_URL` → `https://api.verrocio.com`

### You Need to Provide:
- ⚠️ `EXPO_PUBLIC_SUPABASE_URL` → Your Supabase project URL
- ⚠️ `EXPO_PUBLIC_SUPABASE_ANON_KEY` → Your Supabase anon key

## 🎯 Common Workflows

### Build for Testing (Android)
```bash
./build-all.sh android preview
```

### Build for Production (Android)
```bash
./build-all.sh android production
```

### Build for iOS Testing
```bash
./build-all.sh ios preview
```

### Build for iOS Production (TestFlight)
```bash
./build-all.sh ios production
```

## 🔍 Troubleshooting

### "EAS CLI not found"
```bash
npm install -g eas-cli
```

### "Not logged in"
The script will prompt you to login automatically.

### "Missing environment variables"
Run `./setup-env.sh` to set them up.

### "Permission denied"
Make scripts executable:
```bash
chmod +x *.sh
```

## 📱 After Build

1. **Get the download link** from the build output
2. **Share with testers** - they just click and install
3. **For Android:** Testers need to enable "Install from unknown sources"

## 🎉 That's It!

The scripts handle:
- ✅ Environment variable setup
- ✅ EAS secret management
- ✅ Build configuration
- ✅ Error checking
- ✅ User prompts

Just run `./build-all.sh` and you're done! 🚀
