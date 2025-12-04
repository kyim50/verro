# Verro App - Setup Guide

## Database Migration Steps

### Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Run migrations in this exact order:

#### Step 1: Portfolio Migration
```sql
-- Copy and paste contents from: erato-app/backend/migrations/add_portfolio_images.sql
-- This adds portfolio support to artists table
```

#### Step 2: Commissions & Messages Migration
```sql
-- Copy and paste contents from: erato-app/backend/migrations/add_commissions_messages.sql
-- This creates commissions, conversations, conversation_participants, and messages tables
-- NOTE: The migration has error handling for the artwork foreign key, so it won't fail if artworks table has issues
```

#### Step 3: Verify Migration (Optional but Recommended)
```sql
-- Copy and paste contents from: erato-app/backend/migrations/verify_migration.sql
-- This will show you exactly what tables, constraints, and indexes were created
-- Look for ✓ marks to confirm everything is working
```

### Option 2: Supabase CLI

```bash
cd erato-app/backend
supabase db push
```

## Verify Database Tables

After running migrations, verify in Supabase SQL Editor:

```sql
-- Check all tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Should include:
-- artists
-- artworks
-- commissions
-- conversation_participants
-- conversations
-- messages
-- users

-- Verify artists table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'artists'
AND column_name IN ('portfolio_images', 'onboarding_completed');

-- Should return:
-- portfolio_images | ARRAY
-- onboarding_completed | boolean

-- Verify foreign key constraints exist
SELECT conname
FROM pg_constraint
WHERE conname LIKE 'fk_%';
```

## Start the Backend Server

```bash
cd erato-app/backend
npm install  # if not already installed
npm start
```

Expected output:
```
Server running on port 3000
Connected to Supabase
```

## Start the Frontend App

```bash
cd erato-app/frontend
npm install  # if not already installed
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- Scan QR code for Expo Go app

## Testing Checklist

### 1. Artist Onboarding
- [ ] Register as new artist account
- [ ] Should redirect to /onboarding/welcome
- [ ] Tap "Get Started"
- [ ] Should redirect to /onboarding/portfolio
- [ ] Upload 6 portfolio images
- [ ] Progress indicator shows X/6
- [ ] "Complete Onboarding" button appears after 6 images
- [ ] Redirects to home after completion

### 2. Explore Page
- [ ] Shows artist cards with portfolio images
- [ ] Tap on card opens swipeable portfolio modal
- [ ] Can swipe through 6 images
- [ ] Pagination dots show current image
- [ ] Artist info displayed at bottom
- [ ] "Request Commission" button visible
- [ ] Close button returns to explore

### 3. Profile Screen
- [ ] Profile loads without errors
- [ ] Rating shows "N/A" if no ratings yet (no toFixed error)
- [ ] Portfolio Highlights section shows 6 images
- [ ] Edit button for portfolio visible
- [ ] All Artworks section displays
- [ ] Upload artwork button visible

### 4. Artwork Detail Screen
- [ ] Home page shows latest artworks
- [ ] Tap artwork navigates to /artwork/[id]
- [ ] Full-screen image displays
- [ ] Artist info section shows
- [ ] "Request Commission" button visible (if not owner)
- [ ] Tap button opens commission modal
- [ ] Modal shows artist price range
- [ ] Can enter commission details
- [ ] "Send Request" creates commission

### 5. Commission Request Flow
- [ ] Submit commission request from artwork
- [ ] Success message appears
- [ ] Navigate to Messages tab
- [ ] New conversation appears in list
- [ ] Conversation shows commission request message
- [ ] Artist sees "New Commission Request" badge
- [ ] Tap conversation navigates to /conversation/[id]

### 6. Messages Tab
- [ ] Empty state shows when no messages
- [ ] Conversations list displays after commission request
- [ ] Shows other participant avatar and name
- [ ] Latest message preview displays
- [ ] Time formatting works (Just now, 5m, 2h, 3d)
- [ ] Unread badge shows with count
- [ ] Pull-to-refresh updates list
- [ ] Tap conversation navigates (will need screen implementation)

## Common Issues & Solutions

### Issue: "toFixed of undefined" error in profile
**Solution:** Fixed in latest version. Update to latest profile.js

### Issue: Migration fails with "column does not exist"
**Solution:** Use the updated migration file with conditional DO blocks

### Issue: Images not displaying
**Solution:** Currently using local URIs. Production needs cloud storage setup (see Future Enhancements)

### Issue: Messages don't update in real-time
**Solution:** Socket.io configured but not fully implemented. Currently requires manual refresh

### Issue: Can't find conversation screen
**Solution:** Not yet implemented. Tapping conversation shows error. See TODO section

## Environment Variables

Ensure these are set in your environment:

### Backend (.env)
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
PORT=3000
```

### Frontend (.env)
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For production:
```
EXPO_PUBLIC_API_URL=https://your-backend.com/api
```

## API Endpoints Reference

### Commissions
- `POST /api/commissions/request` - Request commission
- `GET /api/commissions` - List commissions (query: type, status)
- `GET /api/commissions/:id` - Get commission details
- `PATCH /api/commissions/:id/status` - Update status
- `PATCH /api/commissions/:id` - Update price/deadline

### Messages
- `GET /api/messages/conversations` - List conversations
- `GET /api/messages/conversations/:id/messages` - Get messages
- `POST /api/messages/conversations/:id/messages` - Send message
- `POST /api/messages/conversations` - Create conversation

### Users/Artists
- `PUT /api/users/me/artist` - Update artist profile (includes portfolio_images)
- `POST /api/users/me/artist/onboarding` - Complete onboarding (6 images)

### Artworks
- `GET /api/artworks` - List artworks (for feed)
- `GET /api/artworks/:id` - Get artwork details

## What's Implemented ✅

1. ✅ Artist onboarding with 6-image portfolio upload
2. ✅ Explore page with Tinder-style artist cards
3. ✅ Swipeable portfolio image gallery
4. ✅ Profile screen with portfolio highlights
5. ✅ Pinterest-style artwork detail view
6. ✅ Commission request modal and flow
7. ✅ Complete messaging system backend
8. ✅ Messages tab UI with conversations list
9. ✅ Database schema for commissions & messages
10. ✅ Backend routes for commissions & messages

## What's Not Yet Implemented ⏳

1. ⏳ Individual conversation screen (/conversation/[id].js)
   - Chat interface with message bubbles
   - Send message input
   - Accept/Reject commission buttons

2. ⏳ Cloud image storage
   - Currently using local URIs
   - Need S3/Supabase Storage integration

3. ⏳ Profile editing screens
   - /profile/edit
   - /profile/edit-portfolio
   - /profile/edit-artist

4. ⏳ Real-time message updates
   - Socket.io configured but not integrated in frontend

5. ⏳ Payment integration
   - Stripe configured but commission payments not implemented

## Next Steps

1. **Run Database Migrations** (see steps above)
2. **Test Artist Onboarding** - Register as artist and complete onboarding
3. **Test Explore Page** - View artist portfolios and swipe through images
4. **Test Commission Request** - Request commission from artwork detail screen
5. **Check Messages Tab** - Verify conversation appears
6. **Implement Conversation Screen** - Next major feature to build

## Support

For issues or questions:
- Check [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for detailed technical docs
- Review error logs in terminal for debugging
- Verify database migrations ran successfully in Supabase dashboard
