# EAS Environment Variables Setup Guide

## Quick Setup (Recommended)

You have **two options** for setting environment variables in EAS builds:

### Option 1: EAS Secrets (Most Secure) ✅ Recommended

Use EAS secrets for sensitive values like Supabase keys. These are encrypted and stored securely.

```bash
# Set API URLs (these are public, but using secrets keeps everything consistent)
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.verrocio.com/api" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SOCKET_URL --value "https://api.verrocio.com" --type string

# Set Supabase credentials (sensitive - use secrets!)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key-here" --type string
```

**To view your secrets:**
```bash
eas secret:list
```

**To update a secret:**
```bash
eas secret:delete --name EXPO_PUBLIC_SUPABASE_URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "new-value" --type string
```

### Option 2: In eas.json (Simpler, but less secure)

I've already added your API URLs to `eas.json`. For Supabase, you can either:

**A. Add to eas.json directly:**
```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.verrocio.com/api",
        "EXPO_PUBLIC_SOCKET_URL": "https://api.verrocio.com",
        "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

**B. Use EAS secrets (recommended for Supabase):**
- Keep API URLs in `eas.json` (they're public anyway)
- Use EAS secrets for Supabase credentials

## Current Configuration

I've already set up:
- ✅ `EXPO_PUBLIC_API_URL` in `eas.json` → `https://api.verrocio.com/api`
- ✅ `EXPO_PUBLIC_SOCKET_URL` in `eas.json` → `https://api.verrocio.com`
- ⚠️ `EXPO_PUBLIC_SUPABASE_URL` → **You need to add this**
- ⚠️ `EXPO_PUBLIC_SUPABASE_ANON_KEY` → **You need to add this**

## Step-by-Step Setup

### 1. Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

### 2. Set Up EAS Secrets

```bash
cd erato-app/frontend

# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --type string

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." --type string
```

### 3. Verify Secrets

```bash
eas secret:list
```

You should see:
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SOCKET_URL` (if you added it)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 4. Build Your App

```bash
eas build --platform android --profile preview
```

EAS will automatically use:
- Environment variables from `eas.json`
- EAS secrets (if they exist)
- Values from `app.json` (as fallback)

## Environment Variable Priority

EAS uses this priority order (highest to lowest):
1. **EAS Secrets** (most secure)
2. **eas.json env** (what I just added)
3. **app.json extra** (fallback)

## For Different Build Profiles

You can set different values for different profiles:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.verrocio.com/api"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.verrocio.com/api"
      }
    }
  }
}
```

Or use secrets with different values per profile:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.verrocio.com/api" --type string --environment preview
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.verrocio.com/api" --type string --environment production
```

## Troubleshooting

### "Secret not found" error
- Make sure you created the secret with `--scope project`
- Check spelling: `EXPO_PUBLIC_` prefix is required
- Verify with `eas secret:list`

### Variables not appearing in build
- Check `eas.json` syntax
- Make sure variable names start with `EXPO_PUBLIC_`
- Rebuild after adding secrets

### Want to test locally?
Environment variables from `app.json` are used in development. For local testing, you can also create a `.env` file (but don't commit it!):

```bash
# .env (don't commit this!)
EXPO_PUBLIC_API_URL=https://api.verrocio.com/api
EXPO_PUBLIC_SOCKET_URL=https://api.verrocio.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## Summary

✅ **Already configured:**
- API URLs in `eas.json` and `app.json`

⚠️ **You need to add:**
- Supabase URL (use EAS secrets)
- Supabase Anon Key (use EAS secrets)

**Next step:**
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_SUPABASE_URL"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_SUPABASE_KEY"
```

Then rebuild and all your environment variables will be included! 🚀
