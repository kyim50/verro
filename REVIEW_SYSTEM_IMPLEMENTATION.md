# Review System Implementation

## Overview
Implemented an automatic review prompt system that appears after a commission is marked as complete. Both artists and clients are prompted to leave reviews for each other.

## What Was Fixed

### 1. **Fixed "Post" Button Text Color** ([app/artwork/upload.js](erato-app/frontend/app/artwork/upload.js))
- Changed the "Post" button text color from gray to black (`colors.background`)
- Text now clearly visible against the red primary button background
- Also fixed disabled text color to use theme constant

### 2. **Fixed "Completed" Text Wrapping** ([app/client/[id].js](erato-app/frontend/app/client/[id].js))
- Added `numberOfLines={1}` to the status badge Text component
- Added `flexShrink: 0` to the statusBadge style to prevent shrinking
- Status text like "Completed", "In Progress" no longer wraps awkwardly

### 3. **Commission History Filter**
- Verified that the client profile page already correctly filters commissions by client_id
- The commission history shows only that specific client's commissions

## New Review System Features

### Backend Changes

#### 1. **Database Migration** ([backend/migrations/create_pending_reviews_table.sql](erato-app/backend/migrations/create_pending_reviews_table.sql))
Created `pending_reviews` table to track reviews that need to be submitted:
- Stores commission_id, user_id, and review_type
- Has RLS policies for security
- Automatically cleaned up when reviews are submitted

#### 2. **Updated Commission Completion Logic** ([backend/src/routes/commissions.js](erato-app/backend/src/routes/commissions.js))
When an artist marks a commission as complete:
- Sends notification to client about completion
- **NEW:** Sends review prompts to both artist and client
- **NEW:** Creates pending review records for tracking

#### 3. **Updated Review Creation** ([backend/src/routes/reviews.js](erato-app/backend/src/routes/reviews.js))
When a review is submitted:
- Removes the corresponding pending review record
- Prevents duplicate review prompts

#### 4. **New Endpoint: Get Pending Reviews** ([backend/src/routes/reviews.js](erato-app/backend/src/routes/reviews.js))
- `GET /reviews/pending` - Returns all pending reviews for the authenticated user
- Includes commission details and information about the other party
- Used to show review prompts when users log in

### Frontend Changes

#### 1. **ReviewPromptModal Component** ([frontend/components/ReviewPromptModal.js](erato-app/frontend/components/ReviewPromptModal.js))
Beautiful modal that prompts users to leave reviews:
- Shows user avatar and name
- Commission title
- 5-star rating selector
- Optional comment field
- "Submit Review" and "Maybe Later" buttons
- Auto-closes and moves to next pending review if multiple exist

#### 2. **Home Screen Integration** ([frontend/app/(tabs)/home.js](erato-app/frontend/app/(tabs)/home.js))
- Checks for pending reviews when screen comes into focus
- Shows ReviewPromptModal automatically when pending reviews exist
- Cycles through multiple pending reviews one at a time
- User can skip reviews and they'll be prompted again next time

## How It Works

### Flow for Commission Completion:

1. **Artist marks commission as complete:**
   ```
   PATCH /api/commissions/:id/status
   { status: 'completed' }
   ```

2. **Backend creates pending reviews:**
   - One for artist to review client (`artist_to_client`)
   - One for client to review artist (`client_to_artist`)

3. **Notifications sent:**
   - Client gets "Commission Completed" notification
   - Artist gets "Leave a Review" notification
   - Client gets "Leave a Review" notification

4. **User opens app:**
   - Home screen loads pending reviews via `GET /reviews/pending`
   - ReviewPromptModal appears if any pending reviews exist
   - User can submit review or skip ("Maybe Later")

5. **User submits review:**
   ```
   POST /api/reviews
   {
     commission_id: "...",
     rating: 5,
     comment: "Great work!",
     review_type: "client_to_artist"
   }
   ```
   - Review is created
   - Pending review record is deleted
   - Modal closes or moves to next pending review

### For Clients Not on the App:
- When they sign in, the home screen will automatically check for pending reviews
- The review prompt modal will appear immediately
- They can choose to review now or skip and be reminded later

## Database Schema

### pending_reviews table:
```sql
CREATE TABLE pending_reviews (
  id UUID PRIMARY KEY,
  commission_id UUID REFERENCES commissions(id),
  user_id UUID REFERENCES users(id),
  review_type VARCHAR(50) CHECK (review_type IN ('client_to_artist', 'artist_to_client')),
  created_at TIMESTAMP
);
```

## Next Steps

### To Deploy:
1. **Run the migration:**
   ```sql
   -- Execute: erato-app/backend/migrations/create_pending_reviews_table.sql
   ```

2. **Restart the backend server** to pick up the new review logic

3. **Reload the frontend app** to get the new ReviewPromptModal component

### Testing:
1. Have an artist mark a commission as complete
2. Check that both artist and client receive review prompt notifications
3. Open the app as either user
4. Verify ReviewPromptModal appears
5. Submit a review
6. Verify the pending review is removed and modal closes

## Benefits

✅ **Automatic prompts** - No manual intervention needed
✅ **Persistent** - Reviews are tracked until submitted
✅ **Non-intrusive** - Users can skip and be reminded later
✅ **Beautiful UI** - Matches the app's Pinterest-style design
✅ **Two-way reviews** - Both artists and clients can review each other
✅ **Scalable** - Handles multiple pending reviews gracefully
