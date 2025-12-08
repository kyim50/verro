-- Create reviews table with proper schema
-- This script handles cases where the table might already exist with different structure

-- Step 1: Drop the table if it exists (to ensure clean schema)
DROP TABLE IF EXISTS reviews CASCADE;

-- Step 2: Create the reviews table WITHOUT foreign key constraints initially
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL,
  artist_id UUID NOT NULL,
  client_id UUID NOT NULL,
  review_type VARCHAR(20) NOT NULL CHECK (review_type IN ('client_to_artist', 'artist_to_client')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add foreign key constraints separately (will fail gracefully if tables don't exist)
DO $$
BEGIN
  -- Add foreign key to commissions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT fk_reviews_commission 
    FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE;
  END IF;
  
  -- Add foreign key to users table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT fk_reviews_client 
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add foreign key to artists table (check if id column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artists' 
      AND column_name = 'id'
  ) THEN
    ALTER TABLE reviews 
    ADD CONSTRAINT fk_reviews_artist 
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_commission_id ON reviews(commission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_artist_id ON reviews(artist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_type ON reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_artist_type ON reviews(artist_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_client_type ON reviews(client_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_commission_type ON reviews(commission_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_artist_type_created ON reviews(artist_id, review_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_client_type_created ON reviews(client_id, review_type, created_at DESC);

-- Step 5: Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 6: Create trigger for updated_at
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at 
  BEFORE UPDATE ON reviews
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

