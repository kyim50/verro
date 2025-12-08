-- Create reviews table if it doesn't exist
-- This table supports bidirectional reviews: clients reviewing artists and artists reviewing clients

-- Drop table if it exists with wrong schema
DROP TABLE IF EXISTS reviews CASCADE;

-- Create the reviews table
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

-- Add foreign key constraints (if tables exist)
DO $$
BEGIN
  -- Add foreign key to commissions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    ALTER TABLE reviews ADD CONSTRAINT fk_reviews_commission 
      FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE;
  END IF;
  
  -- Add foreign key to users
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE reviews ADD CONSTRAINT fk_reviews_client 
      FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  -- Add foreign key to artists (check if artists table has id column)
  IF EXISTS (
    SELECT FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name
    WHERE t.table_schema = 'public' 
      AND t.table_name = 'artists'
      AND c.column_name = 'id'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT fk_reviews_artist 
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_commission_id ON reviews(commission_id);
CREATE INDEX IF NOT EXISTS idx_reviews_artist_id ON reviews(artist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_type ON reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_artist_type ON reviews(artist_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_client_type ON reviews(client_id, review_type);
CREATE INDEX IF NOT EXISTS idx_reviews_commission_type ON reviews(commission_id, review_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

