# Testing the Review System

## Current Status

### ✅ Backend Implementation - COMPLETE
1. **Database table created** - `pending_reviews` table exists with 6 pending reviews
2. **Commission completion logic** - Creates pending reviews when commission status = 'completed'
3. **Review submission logic** - Removes pending reviews when review is submitted
4. **GET /reviews/pending endpoint** - Returns pending reviews for authenticated user

### ✅ Frontend Implementation - COMPLETE
1. **ReviewPromptModal component** - Beautiful modal for submitting reviews
2. **Home screen integration** - Checks for pending reviews on focus
3. **Messages screen** - Already has ReviewModal that appears after marking complete

## Why Reviews Aren't Appearing Yet

The system is fully implemented, but there are TWO review modals that need to work together:

1. **ReviewModal** (existing) - Shows in messages screen when YOU mark a commission complete
2. **ReviewPromptModal** (new) - Shows on home screen for ALL pending reviews

### The Issue:
- When an artist marks a commission as complete in the messages screen, they see ReviewModal immediately ✅
- But the CLIENT doesn't see anything until they open the home screen ❌
- The home screen ReviewPromptModal integration is complete but needs testing

## How to Test

### Test 1: Artist Completes Commission
1. As an artist, go to a commission in Messages
2. Mark it as "Complete"
3. **Expected:** Review modal should appear immediately asking you to review the client
4. **Expected:** Backend creates 2 pending reviews (one for artist, one for client)

### Test 2: Client Opens App After Completion
1. As the client from Test 1, open the app
2. Go to the Home tab
3. **Expected:** ReviewPromptModal should appear asking you to review the artist
4. **Expected:** After submitting or skipping, if there are more pending reviews, next one appears

### Test 3: Multiple Pending Reviews
1. Complete multiple commissions as an artist
2. Log in as a client who has multiple completed commissions
3. **Expected:** ReviewPromptModal cycles through all pending reviews one by one

## Verification Commands

### Check Pending Reviews in Database:
```bash
node -e "
import { supabaseAdmin } from './src/config/supabase.js';

const check = async () => {
  const { data } = await supabaseAdmin
    .from('pending_reviews')
    .select('*, commissions(details, status), users!pending_reviews_user_id_fkey(username)');
  console.log(JSON.stringify(data, null, 2));
};
check();
"
```

### Test API Endpoint (replace TOKEN with real JWT):
```bash
curl -X GET "https://api.verrocio.com/api/reviews/pending" \\
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Files Modified

### Backend:
- `backend/src/routes/commissions.js` - Lines 632-682: Creates pending reviews on completion
- `backend/src/routes/reviews.js` - Lines 117-128: Removes pending review on submission
- `backend/src/routes/reviews.js` - Lines 393-452: New GET /reviews/pending endpoint
- `backend/migrations/create_pending_reviews_table.sql` - Database schema

### Frontend:
- `frontend/components/ReviewPromptModal.js` - New component for review prompts
- `frontend/app/(tabs)/home.js` - Lines 76-78: State for pending reviews
- `frontend/app/(tabs)/home.js` - Lines 562-605: Load and display pending reviews
- `frontend/app/(tabs)/home.js` - Lines 2092-2101: ReviewPromptModal in render

## Troubleshooting

### If reviews don't appear on home screen:
1. Check browser/app console for API errors
2. Verify the API_URL is correct (should be https://api.verrocio.com/api)
3. Check that user is authenticated (token exists)
4. Verify pending_reviews table has data for that user

### If backend errors occur:
1. Restart backend server: `npm start`
2. Check logs for errors
3. Verify Supabase connection is working

## Current Database State

As of 2025-12-14, there are 6 pending reviews in the system:
- 3 completed commissions
- Each commission has 2 pending reviews (artist → client, client → artist)
- These will be perfect for testing!

## Next Steps

1. **Reload the frontend app** to get the new ReviewPromptModal component
2. **Test as a client** - Open home screen and see if review prompts appear
3. **Complete a new commission** - Verify both artist and client get review prompts
4. **Submit reviews** - Verify pending reviews are removed from database

The system is fully built and ready to test!
