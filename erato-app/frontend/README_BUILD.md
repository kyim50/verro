# Build Setup - Quick Reference

## 🚀 One Command Build

```bash
cd erato-app/frontend
./build-all.sh
```

That's it! The script will:
1. ✅ Automatically read Supabase credentials from your backend `.env` file (if it exists)
2. ✅ Set up all environment variables in EAS
3. ✅ Build your app with everything configured

## 📋 How It Works

### Backend vs Frontend Supabase

**Backend uses:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key (for RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (backend only, never expose!)

**Frontend needs:**
- `EXPO_PUBLIC_SUPABASE_URL` - Same as backend `SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Same as backend `SUPABASE_ANON_KEY`

### Automatic Setup

The `setup-env.sh` script automatically:
1. ✅ Reads from `../backend/.env` if it exists
2. ✅ Extracts `SUPABASE_URL` → sets as `EXPO_PUBLIC_SUPABASE_URL`
3. ✅ Extracts `SUPABASE_ANON_KEY` → sets as `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. ✅ If not found, prompts you to enter them

So if your backend is already configured, **you don't need to enter anything!**

## 🔧 Manual Setup (if needed)

If the automatic setup doesn't work, you can manually set:

```bash
./setup-env.sh
```

Then enter your Supabase credentials when prompted.

## 📱 Build Options

```bash
./build-all.sh                    # Android preview (default)
./build-all.sh ios                # iOS preview
./build-all.sh android production # Android production
```

## ✅ What Gets Configured

All of these are set automatically:

- ✅ `EXPO_PUBLIC_API_URL` → `https://api.verrocio.com/api`
- ✅ `EXPO_PUBLIC_SOCKET_URL` → `https://api.verrocio.com`
- ✅ `EXPO_PUBLIC_SUPABASE_URL` → From backend `.env` or prompt
- ✅ `EXPO_PUBLIC_SUPABASE_ANON_KEY` → From backend `.env` or prompt

## 🎯 That's It!

Just run `./build-all.sh` and everything is handled automatically! 🚀
