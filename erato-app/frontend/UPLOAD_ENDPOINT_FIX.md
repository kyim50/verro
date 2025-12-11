# Upload Endpoint Fix

## Issues Reported

1. **Portfolio upload:** "failed to upload image"
2. **Profile picture/artwork upload:** "property endpoint doesn't exist"

## Root Cause Analysis

The error "property endpoint doesn't exist" is likely a JavaScript error when trying to access `response.data.url` or `response.data.urls` when the response structure is different than expected.

## Fixes Applied

### 1. ✅ Improved Response Handling

**Before:**
```javascript
return response.data.url; // Could fail if url doesn't exist
```

**After:**
```javascript
// Check for both url and urls array
if (response.data.url) {
  return response.data.url;
} else if (Array.isArray(response.data.urls) && response.data.urls.length > 0) {
  return response.data.urls[0]; // Fallback
} else {
  throw new Error('Upload succeeded but no URL returned from server');
}
```

### 2. ✅ Better Error Logging

Added detailed logging to see:
- What endpoint is being called
- What field name is being used
- What the response structure looks like
- Any errors that occur

### 3. ✅ Portfolio Upload Fix

For portfolio uploads, the backend expects:
- Field name: `files` (plural)
- Endpoint: `/api/uploads/portfolio`
- Response: `{ success: true, urls: [...] }`

The code now properly handles:
- Single file uploads to portfolio (returns first URL from array)
- Multiple file uploads (returns all URLs)

### 4. ✅ Safe Area Handling for Bottom Notches

Added `useSafeAreaInsets` to:
- Tab bar layout - adjusts height based on bottom inset
- Profile screen - adds padding to ScrollView content

## Files Changed

1. `utils/imageUpload.js` - Improved response handling
2. `app/(tabs)/_layout.js` - Added safe area insets for tab bar
3. `app/(tabs)/profile.js` - Added safe area padding

## Testing

After rebuild, test:

1. **Profile Picture Upload:**
   - Edit profile → Change picture
   - Should upload successfully
   - Check console logs for endpoint and response

2. **Portfolio Upload:**
   - Edit Portfolio → Add images
   - Should upload all images
   - Check console logs for "files" field name

3. **Artwork Upload:**
   - Upload artwork
   - Should upload successfully
   - Check console logs for endpoint

4. **Bottom Notch:**
   - On device with bottom notch
   - Tab bar should not be cut off
   - Profile screen content should be visible above tab bar

## Debugging

If uploads still fail, check console logs for:
- `🔗 Upload endpoint:` - Shows which endpoint is being called
- `📎 Field name:` - Shows which field name is being used
- `📥 Upload response:` - Shows response structure
- `❌ Error uploading image:` - Shows detailed error info

These logs will help identify if:
- Wrong endpoint is being called
- Wrong field name is being used
- Response structure is unexpected
- Network error occurred
