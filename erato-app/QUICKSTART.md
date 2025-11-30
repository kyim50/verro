# Quick Start Guide

Get Erato running in 10 minutes!

## Step 1: Install Dependencies (2 min)

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Step 2: Configure Environment (2 min)

**Backend `.env`:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=any_random_string_here
```

**Frontend `.env`:**
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 4: Run! (3 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npx expo start
```

**Choose platform:**
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR with Expo Go app on phone

## Done! 🎉

You should now see the Erato app running. Try:

1. Register a new account
2. Browse the feed (will be empty initially)
3. Navigate to the Explore tab

## Next Steps

### Add Sample Data

Create some test artists and artworks in Supabase:

```sql
-- Insert test user
INSERT INTO users (email, username, full_name, user_type)
VALUES ('artist@test.com', 'testartist', 'Test Artist', 'artist');

-- Get the user ID from the response, then:
INSERT INTO artists (id, commission_status, min_price, max_price, turnaround_days)
VALUES ('user-id-here', 'open', 50, 500, 14);

-- Add test artwork
INSERT INTO artworks (artist_id, title, description, image_url, tags)
VALUES (
  'user-id-here',
  'Sample Artwork',
  'This is a test artwork',
  'https://picsum.photos/800/1200',
  ARRAY['digital', 'portrait']
);
```

### Troubleshooting

**"Cannot connect to server"**
- Check backend is running on port 3000
- Verify `EXPO_PUBLIC_API_URL` in frontend `.env`

**"Supabase error"**
- Verify your Supabase credentials
- Check you ran the SQL setup script
- Ensure your project is not paused

**"Expo error"**
- Clear cache: `npx expo start --clear`
- Delete node_modules and reinstall

## Common Commands

```bash
# Clear Expo cache
npx expo start --clear

# Reset everything
rm -rf node_modules package-lock.json
npm install

# Check backend health
curl http://localhost:3000/health

# View backend logs
cd backend && npm run dev
```

## Need Help?

- Check `PROJECT_DOCUMENTATION.md` for detailed info
- Review `README.md` for architecture details
- Open an issue on GitHub
