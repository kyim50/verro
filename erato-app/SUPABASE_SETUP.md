# Supabase Configuration Guide

## Why Supabase is Required

Your backend uses Supabase for:
- Database (PostgreSQL)
- Storage (for images)
- Authentication (if used)

The frontend needs Supabase credentials to:
- Access Supabase features (if you add them later)
- Connect to Supabase Storage directly (optional, currently using backend API)

## Configuration Options

### Option 1: Add to app.json (Recommended for Testing)

Add these to your `app.json` in the `extra` section:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_SUPABASE_URL": "your-supabase-project-url",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-supabase-anon-key"
    }
  }
}
```

**Where to find these values:**
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Option 2: EAS Environment Variables (Recommended for Production)

Set environment variables in EAS for each build profile:

```bash
# For preview builds
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-supabase-url" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-supabase-anon-key" --type string

# Or set per build profile
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-supabase-url" --type string --environment preview
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-supabase-anon-key" --type string --environment preview
```

Then update `eas.json`:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your-supabase-url",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-supabase-anon-key"
      }
    }
  }
}
```

## Current Status

Right now, the app **won't crash** if Supabase isn't configured, but it will log an error. 

The app currently:
- ✅ Uses backend API for image uploads (works without frontend Supabase)
- ✅ Backend uses Supabase (configured separately)
- ⚠️ Frontend Supabase is optional but recommended for future features

## Quick Setup

1. **Get your Supabase credentials** from your Supabase dashboard
2. **Add to app.json** (see Option 1 above)
3. **Rebuild the app**

The app will now initialize Supabase properly!
