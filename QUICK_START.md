# Quick Start Guide - Get Running in 15 Minutes

## ✅ What's Ready

All code is complete! You just need to set up Supabase Storage for image uploads.

---

## 🚀 Step-by-Step Setup

### 1. Install Dependencies (2 minutes)

```bash
cd erato-app/frontend
npm install @supabase/supabase-js expo-file-system base64-arraybuffer
```

### 2. Create Supabase Storage Buckets (5 minutes)

1. Go to https://supabase.com/dashboard
2. Select your Verro project
3. Click **Storage** in sidebar
4. Click **New bucket**

Create these 3 buckets (all **Public**):
- `artworks`
- `profiles`
- `portfolios`

### 3. Set Up Storage Policies (5 minutes)

For each bucket, add these 3 policies:

**Policy 1: Allow authenticated uploads**
- Operation: INSERT
- Target roles: authenticated
- USING expression: `(bucket_id = 'artworks')`
- WITH CHECK: `(bucket_id = 'artworks' AND auth.role() = 'authenticated')`

**Policy 2: Allow public reads**
- Operation: SELECT
- Target roles: public, authenticated
- USING expression: `(bucket_id = 'artworks')`

**Policy 3: Allow users to delete own**
- Operation: DELETE
- Target roles: authenticated
- USING expression: `(bucket_id = 'artworks' AND auth.role() = 'authenticated')`

Repeat for `profiles` and `portfolios` buckets (change 'artworks' to bucket name).

### 4. Add Environment Variables (1 minute)

In `erato-app/frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase Dashboard → Settings → API

### 5. Start the App (2 minutes)

**Terminal 1 - Backend:**
```bash
cd erato-app/backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd erato-app/frontend
npm start
```

Press `i` for iOS or `a` for Android

---

## 🎯 Test the New Features

### Test 1: Edit Portfolio (Shows existing images now!)
1. Login as artist
2. Profile → Portfolio Highlights → Tap pencil
3. Should see existing images loaded
4. Add/edit/remove images
5. Tap "Save Portfolio"

### Test 2: Upload Artwork
1. Login as artist
2. Profile → All Artworks → Tap "+"
3. Select image
4. Fill title and description
5. Tap "Post"
6. Image uploads to Supabase Storage
7. Artwork appears in profile

### Test 3: View in For You Page
1. Go to Home tab
2. See artwork in Pinterest grid
3. Tap to view detail
4. Tap "Request Commission"

---

## 📚 Full Documentation

- **Supabase Storage Setup:** [SUPABASE_STORAGE_SETUP.md](SUPABASE_STORAGE_SETUP.md)
- **All Features Status:** [FEATURES_CHECKLIST.md](FEATURES_CHECKLIST.md)
- **Complete Summary:** [IMPLEMENTATION_SUMMARY_FINAL.md](IMPLEMENTATION_SUMMARY_FINAL.md)

---

## 🎉 You're Done!

Everything is ready. Follow the 5 steps above and you'll have:
- ✅ Cloud image storage (FREE 1GB)
- ✅ Portfolio editing with existing images
- ✅ Artwork upload working
- ✅ For You page populated with artworks
- ✅ Complete commission request flow

**Need Help?** Check [SUPABASE_STORAGE_SETUP.md](SUPABASE_STORAGE_SETUP.md) for detailed troubleshooting!
