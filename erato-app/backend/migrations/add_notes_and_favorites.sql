-- Migration: Add artist notes and favorites system
-- Created: 2025-12-11
-- Description: Adds artist_notes column to commissions table and creates favorite_artists table

-- ============================================
-- 1. Add artist_notes column to commissions
-- ============================================

-- Add artist_notes column to store private notes for artists about commissions
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS artist_notes TEXT;

-- Add comment to document the column
COMMENT ON COLUMN commissions.artist_notes IS 'Private notes from the artist about this commission (not visible to client)';

-- ============================================
-- 2. Create favorite_artists table
-- ============================================

-- Create table for storing user's favorite artists
CREATE TABLE IF NOT EXISTS favorite_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure a user can only favorite an artist once
  CONSTRAINT unique_user_artist_favorite UNIQUE (user_id, artist_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_favorite_artists_user_id ON favorite_artists(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_artists_artist_id ON favorite_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_favorite_artists_created_at ON favorite_artists(created_at DESC);

-- Add comments to document the table
COMMENT ON TABLE favorite_artists IS 'Stores user favorites for artists';
COMMENT ON COLUMN favorite_artists.user_id IS 'The user who favorited the artist';
COMMENT ON COLUMN favorite_artists.artist_id IS 'The artist being favorited';
COMMENT ON COLUMN favorite_artists.created_at IS 'When the artist was added to favorites';

-- ============================================
-- 3. Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on favorite_artists table
ALTER TABLE favorite_artists ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
  ON favorite_artists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can add artists to their favorites
CREATE POLICY "Users can add to favorites"
  ON favorite_artists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can remove artists from their favorites
CREATE POLICY "Users can remove from favorites"
  ON favorite_artists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Artists can see who favorited them (optional - comment out if not needed)
CREATE POLICY "Artists can see who favorited them"
  ON favorite_artists
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM artists WHERE id = artist_id
    )
  );

-- ============================================
-- 4. Grant permissions (if using service role)
-- ============================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, DELETE ON favorite_artists TO authenticated;

-- ============================================
-- Rollback Instructions
-- ============================================

-- To rollback this migration, run the following:
/*
-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own favorites" ON favorite_artists;
DROP POLICY IF EXISTS "Users can add to favorites" ON favorite_artists;
DROP POLICY IF EXISTS "Users can remove from favorites" ON favorite_artists;
DROP POLICY IF EXISTS "Artists can see who favorited them" ON favorite_artists;

-- Drop indexes
DROP INDEX IF EXISTS idx_favorite_artists_user_id;
DROP INDEX IF EXISTS idx_favorite_artists_artist_id;
DROP INDEX IF EXISTS idx_favorite_artists_created_at;

-- Drop table
DROP TABLE IF EXISTS favorite_artists;

-- Remove artist_notes column
ALTER TABLE commissions DROP COLUMN IF EXISTS artist_notes;
*/
