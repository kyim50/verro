-- Discovery & Matching Features Migration (Safe Version)
-- This version handles existing tables and triggers gracefully

-- Art Styles Table (for categorizing artists and filtering)
CREATE TABLE IF NOT EXISTS art_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common art styles (safe - won't duplicate if they exist)
INSERT INTO art_styles (name, slug, description) VALUES
  ('Anime', 'anime', 'Japanese animation style'),
  ('Realism', 'realism', 'Photorealistic artwork'),
  ('Cartoon', 'cartoon', 'Cartoon and comic style'),
  ('Semi-Realistic', 'semi-realistic', 'Mix of realistic and stylized'),
  ('Chibi', 'chibi', 'Cute, small character style'),
  ('Manga', 'manga', 'Japanese comic book style'),
  ('Fantasy', 'fantasy', 'Fantasy and magical themes'),
  ('Sci-Fi', 'sci-fi', 'Science fiction style'),
  ('Horror', 'horror', 'Dark and horror-themed art'),
  ('Abstract', 'abstract', 'Abstract and non-representational'),
  ('Watercolor', 'watercolor', 'Watercolor painting style'),
  ('Digital Painting', 'digital-painting', 'Digital painting techniques'),
  ('Vector', 'vector', 'Vector art style'),
  ('Pixel Art', 'pixel-art', 'Pixel-based artwork'),
  ('3D Modeling', '3d-modeling', 'Three-dimensional models')
ON CONFLICT (name) DO NOTHING;

-- Artist Art Styles (many-to-many relationship)
CREATE TABLE IF NOT EXISTS artist_art_styles (
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  style_id UUID NOT NULL REFERENCES art_styles(id) ON DELETE CASCADE,
  PRIMARY KEY (artist_id, style_id)
);

-- Client Style Preferences (for matching)
CREATE TABLE IF NOT EXISTS client_style_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_styles JSONB DEFAULT '[]'::jsonb,
  preferred_commission_types JSONB DEFAULT '[]'::jsonb,
  price_range_min DECIMAL(10, 2),
  price_range_max DECIMAL(10, 2),
  preferred_turnaround_days INTEGER,
  match_algorithm VARCHAR(20) DEFAULT 'weighted',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commission Request Board (clients post, artists bid)
CREATE TABLE IF NOT EXISTS commission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  budget_min DECIMAL(10, 2),
  budget_max DECIMAL(10, 2),
  deadline DATE,
  preferred_styles UUID[],
  reference_images TEXT[],
  status VARCHAR(20) DEFAULT 'open',
  awarded_to UUID REFERENCES artists(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  bid_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('open', 'closed', 'awarded', 'cancelled'))
);

-- Artist Bids on Commission Requests
CREATE TABLE IF NOT EXISTS commission_request_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES commission_requests(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  bid_amount DECIMAL(10, 2) NOT NULL,
  estimated_delivery_days INTEGER,
  message TEXT,
  portfolio_samples TEXT[],
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_bid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  CONSTRAINT unique_artist_request_bid UNIQUE(request_id, artist_id)
);

-- Add columns to artists table (safe - won't fail if they exist)
ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
  ADD COLUMN IF NOT EXISTS avg_turnaround_days INTEGER,
  ADD COLUMN IF NOT EXISTS commission_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS primary_style_id UUID REFERENCES art_styles(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artist_art_styles_artist ON artist_art_styles(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_art_styles_style ON artist_art_styles(style_id);
CREATE INDEX IF NOT EXISTS idx_commission_requests_status ON commission_requests(status);
CREATE INDEX IF NOT EXISTS idx_commission_requests_client ON commission_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_request ON commission_request_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_artist ON commission_request_bids(artist_id);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_status ON commission_request_bids(status);
CREATE INDEX IF NOT EXISTS idx_artists_primary_style ON artists(primary_style_id);
CREATE INDEX IF NOT EXISTS idx_artists_languages ON artists USING GIN(languages);
CREATE INDEX IF NOT EXISTS idx_artists_commission_types ON artists USING GIN(commission_types);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_commission_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS update_commission_requests_updated_at ON commission_requests;
CREATE TRIGGER update_commission_requests_updated_at
  BEFORE UPDATE ON commission_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_request_updated_at();

DROP TRIGGER IF EXISTS update_commission_request_bids_updated_at ON commission_request_bids;
CREATE TRIGGER update_commission_request_bids_updated_at
  BEFORE UPDATE ON commission_request_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_request_updated_at();

DROP TRIGGER IF EXISTS update_client_style_preferences_updated_at ON client_style_preferences;
CREATE TRIGGER update_client_style_preferences_updated_at
  BEFORE UPDATE ON client_style_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update bid count
CREATE OR REPLACE FUNCTION update_request_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE commission_requests SET bid_count = bid_count + 1 WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE commission_requests SET bid_count = GREATEST(0, bid_count - 1) WHERE id = OLD.request_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bid_count_on_insert ON commission_request_bids;
CREATE TRIGGER update_bid_count_on_insert
  AFTER INSERT ON commission_request_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_request_bid_count();

DROP TRIGGER IF EXISTS update_bid_count_on_delete ON commission_request_bids;
CREATE TRIGGER update_bid_count_on_delete
  AFTER DELETE ON commission_request_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_request_bid_count();

-- Migration complete!
-- Verify the art_styles were created:
-- SELECT COUNT(*) FROM art_styles;
