# Supabase Storage Setup Guide (FREE!)

## Why Supabase Storage?

- ✅ **FREE** up to 1GB storage
- ✅ Built-in CDN
- ✅ Direct integration with your Supabase project
- ✅ No credit card required for free tier
- ✅ Automatic image optimization (optional)

## Step 1: Create Storage Buckets

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Verro project
3. Click **Storage** in the left sidebar
4. Click **New bucket**

### Create These Buckets:

#### Bucket 1: `artworks`
- **Name:** `artworks`
- **Public:** ✅ Yes (checked)
- **File size limit:** 10MB
- **Allowed MIME types:** Leave empty (allows all images)
- Click **Create bucket**

#### Bucket 2: `profiles`
- **Name:** `profiles`
- **Public:** ✅ Yes (checked)
- **File size limit:** 5MB
- Click **Create bucket**

#### Bucket 3: `portfolios`
- **Name:** `portfolios`
- **Public:** ✅ Yes (checked)
- **File size limit:** 10MB
- Click **Create bucket**

## Step 2: Set Up Storage Policies

For each bucket, you need to create policies to allow uploads.

### For `artworks` bucket:

1. Click on the `artworks` bucket
2. Go to **Policies** tab
3. Click **New policy**
4. Select **For full customization, create a policy from scratch**

**Insert Policy:**
- **Policy name:** `Allow authenticated uploads`
- **Allowed operation:** INSERT
- **Target roles:** authenticated
- **USING expression:**
  ```sql
  (bucket_id = 'artworks')
  ```
- **WITH CHECK expression:**
  ```sql
  (bucket_id = 'artworks' AND auth.role() = 'authenticated')
  ```
- Click **Review** then **Save policy**

**Select Policy:**
- **Policy name:** `Allow public reads`
- **Allowed operation:** SELECT
- **Target roles:** public, authenticated
- **USING expression:**
  ```sql
  (bucket_id = 'artworks')
  ```
- Click **Review** then **Save policy**

**Delete Policy (for users to delete their own):**
- **Policy name:** `Allow users to delete own images`
- **Allowed operation:** DELETE
- **Target roles:** authenticated
- **USING expression:**
  ```sql
  (bucket_id = 'artworks' AND auth.role() = 'authenticated')
  ```
- Click **Review** then **Save policy**

### For `profiles` bucket:

Repeat the same 3 policies but change `'artworks'` to `'profiles'` in all expressions.

### For `portfolios` bucket:

Repeat the same 3 policies but change `'artworks'` to `'portfolios'` in all expressions.

## Step 3: Install Required Dependencies

```bash
cd erato-app/frontend
npm install @supabase/supabase-js expo-file-system base64-arraybuffer
```

## Step 4: Add Environment Variables

In `erato-app/frontend/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Where to find these:**
1. Supabase Dashboard → Settings → API
2. **URL:** Project URL
3. **Anon key:** `anon` `public` key

## Step 5: Test Upload

Create a test script or use the artwork upload screen to test:

```javascript
import { uploadImage } from './utils/imageUpload';

// After picking an image with ImagePicker
const imageUri = result.assets[0].uri;

try {
  const publicUrl = await uploadImage(imageUri, 'artworks', 'test');
  console.log('Uploaded:', publicUrl);
  // Save publicUrl to database
} catch (error) {
  console.error('Upload failed:', error);
}
```

## Step 6: Verify Upload

1. Go to Storage → `artworks` bucket
2. You should see your uploaded image
3. Click on it to view
4. Copy the public URL - this is what you save in your database

## Storage Structure

```
artworks/
├── {timestamp}-{random}.jpg     # User uploaded artworks
├── {timestamp}-{random}.png
└── thumbnails/                  # Optional: Generated thumbnails
    └── {timestamp}-{random}.jpg

profiles/
├── {user-id}-avatar.jpg         # Profile pictures
└── {user-id}-avatar.png

portfolios/
├── {user-id}/                   # Portfolio images organized by user
│   ├── 1.jpg
│   ├── 2.jpg
│   └── ...
```

## Usage in Your App

### Upload Single Image (Profile Picture):
```javascript
import { uploadImage } from '../utils/imageUpload';

const imageUri = await pickImage();
const publicUrl = await uploadImage(imageUri, 'profiles');
// Save publicUrl to users.avatar_url
```

### Upload Multiple Images (Portfolio):
```javascript
import { uploadMultipleImages } from '../utils/imageUpload';

const imageUris = [uri1, uri2, uri3, uri4, uri5, uri6];
const publicUrls = await uploadMultipleImages(imageUris, 'portfolios', userId);
// Save publicUrls array to artists.portfolio_images
```

### Upload Artwork:
```javascript
const publicUrl = await uploadImage(artworkUri, 'artworks');
// Save publicUrl to artworks.image_url
```

### Delete Image:
```javascript
import { deleteImage } from '../utils/imageUpload';

await deleteImage(oldImageUrl, 'artworks');
```

## Storage Limits (Free Tier)

- **Storage:** 1GB total
- **Bandwidth:** 2GB/month
- **File size:** Up to 50MB per file (we set 10MB max in app)

**Monitoring Usage:**
- Supabase Dashboard → Settings → Usage
- Shows storage used and bandwidth

## Cost-Saving Tips

1. **Compress images before upload** (already set to quality: 0.8)
2. **Delete old/unused images** when users update
3. **Use thumbnails** for lists/previews
4. **Set reasonable file size limits** (10MB is plenty)

## Upgrade Path (If Needed)

If you exceed free tier:
- **Pro Plan:** $25/month
  - 100GB storage
  - 200GB bandwidth
  - Image transformations included

But 1GB should be enough for:
- ~200-500 artworks (depending on size)
- ~1000 profile pictures
- ~100 artist portfolios (6 images each)

## Troubleshooting

### Error: "new row violates row-level security policy"
- Check your storage policies are created correctly
- Make sure user is authenticated before upload

### Error: "File too large"
- Check bucket file size limit
- Reduce image quality in ImagePicker config

### Images not loading
- Check bucket is set to **Public**
- Verify public URL is correct
- Check CORS settings (should be auto-configured)

### Upload slow
- Compress images more (reduce quality to 0.6)
- Consider resizing images before upload
- Check user's internet connection

## Next Steps

Once storage is set up:
1. ✅ Update edit-portfolio.js to use uploadMultipleImages
2. ✅ Update edit.js profile picture to use uploadImage
3. ✅ Create artwork upload screen with uploadImage
4. ✅ Test complete flow end-to-end
