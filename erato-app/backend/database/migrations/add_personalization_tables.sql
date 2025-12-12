-- ================================================
-- PINTEREST-STYLE PERSONALIZATION SYSTEM
-- Database Migration Script
-- ================================================

-- 1. USER PREFERENCES TABLE
-- Stores user's style preferences from onboarding quiz
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_styles TEXT[] DEFAULT '{}', -- Array of art style names/IDs
  interests TEXT[] DEFAULT '{}', -- General interests (e.g., 'fantasy', 'portraits', 'landscapes')
  budget_range JSONB, -- { min: number, max: number }
  commission_frequency TEXT, -- 'rarely', 'occasionally', 'frequently'
  completed_quiz BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_styles ON user_preferences USING GIN(preferred_styles);

-- 2. USER ENGAGEMENT TABLE
-- Tracks user interactions for personalization algorithm
CREATE TABLE IF NOT EXISTS user_engagement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artwork_id UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  engagement_type TEXT NOT NULL, -- 'view', 'click', 'like', 'save', 'share', 'commission_inquiry'
  duration_seconds INTEGER, -- Time spent viewing (for 'view' type)
  metadata JSONB, -- Extra context (e.g., source: 'home_feed', 'search', 'artist_profile')
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate engagement entries for certain types
  UNIQUE(user_id, artwork_id, engagement_type, created_at)
);

-- Indexes for engagement tracking
CREATE INDEX IF NOT EXISTS idx_user_engagement_user_id ON user_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_artwork_id ON user_engagement(artwork_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_type ON user_engagement(engagement_type);
CREATE INDEX IF NOT EXISTS idx_user_engagement_created_at ON user_engagement(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_engagement_user_artwork ON user_engagement(user_id, artwork_id);

-- 3. ARTWORK ENGAGEMENT STATS (Materialized for performance)
-- Aggregated engagement metrics per artwork
CREATE TABLE IF NOT EXISTS artwork_engagement_stats (
  artwork_id UUID PRIMARY KEY REFERENCES artworks(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_saves INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,
  total_commission_inquiries INTEGER DEFAULT 0,
  engagement_score NUMERIC(10, 2) DEFAULT 0, -- Calculated score for ranking
  last_engagement_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sorting by engagement
CREATE INDEX IF NOT EXISTS idx_artwork_engagement_score ON artwork_engagement_stats(engagement_score DESC);

-- 4. TRENDING ARTWORKS CACHE
-- Pre-calculated trending artworks for faster feed generation
CREATE TABLE IF NOT EXISTS trending_artworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artwork_id UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  time_window TEXT NOT NULL, -- 'hour', 'day', 'week', 'month'
  trend_score NUMERIC(10, 2) NOT NULL,
  rank INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(artwork_id, time_window)
);

-- Indexes for trending
CREATE INDEX IF NOT EXISTS idx_trending_artworks_window ON trending_artworks(time_window, trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_artworks_rank ON trending_artworks(time_window, rank);

-- 5. Update artworks table to require tags
-- Add constraint to ensure tags array is not empty
ALTER TABLE artworks
  DROP CONSTRAINT IF EXISTS artworks_tags_not_empty;

ALTER TABLE artworks
  ADD CONSTRAINT artworks_tags_not_empty
  CHECK (array_length(tags, 1) > 0);

-- 6. FUNCTIONS FOR ENGAGEMENT TRACKING

-- Function to update engagement stats after insert
CREATE OR REPLACE FUNCTION update_artwork_engagement_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO artwork_engagement_stats (artwork_id, total_views, total_clicks, total_saves, total_shares, total_commission_inquiries, last_engagement_at)
  VALUES (
    NEW.artwork_id,
    CASE WHEN NEW.engagement_type = 'view' THEN 1 ELSE 0 END,
    CASE WHEN NEW.engagement_type = 'click' THEN 1 ELSE 0 END,
    CASE WHEN NEW.engagement_type = 'save' THEN 1 ELSE 0 END,
    CASE WHEN NEW.engagement_type = 'share' THEN 1 ELSE 0 END,
    CASE WHEN NEW.engagement_type = 'commission_inquiry' THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT (artwork_id) DO UPDATE SET
    total_views = artwork_engagement_stats.total_views + CASE WHEN NEW.engagement_type = 'view' THEN 1 ELSE 0 END,
    total_clicks = artwork_engagement_stats.total_clicks + CASE WHEN NEW.engagement_type = 'click' THEN 1 ELSE 0 END,
    total_saves = artwork_engagement_stats.total_saves + CASE WHEN NEW.engagement_type = 'save' THEN 1 ELSE 0 END,
    total_shares = artwork_engagement_stats.total_shares + CASE WHEN NEW.engagement_type = 'share' THEN 1 ELSE 0 END,
    total_commission_inquiries = artwork_engagement_stats.total_commission_inquiries + CASE WHEN NEW.engagement_type = 'commission_inquiry' THEN 1 ELSE 0 END,
    last_engagement_at = NEW.created_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update engagement stats
DROP TRIGGER IF EXISTS trigger_update_engagement_stats ON user_engagement;
CREATE TRIGGER trigger_update_engagement_stats
  AFTER INSERT ON user_engagement
  FOR EACH ROW
  EXECUTE FUNCTION update_artwork_engagement_stats();

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(artwork_id_param UUID)
RETURNS NUMERIC AS $$
DECLARE
  score NUMERIC := 0;
  stats RECORD;
BEGIN
  SELECT * INTO stats FROM artwork_engagement_stats WHERE artwork_id = artwork_id_param;

  IF stats IS NULL THEN
    RETURN 0;
  END IF;

  -- Pinterest-style weighted scoring
  -- Views: 1 point, Clicks: 3 points, Saves: 5 points, Shares: 7 points, Commission Inquiries: 10 points
  score := (stats.total_views * 1) +
           (stats.total_clicks * 3) +
           (stats.total_saves * 5) +
           (stats.total_shares * 7) +
           (stats.total_commission_inquiries * 10);

  -- Time decay factor (recent engagement scores higher)
  IF stats.last_engagement_at IS NOT NULL THEN
    score := score * (1 + (1 / (1 + EXTRACT(EPOCH FROM (NOW() - stats.last_engagement_at)) / 86400)));
  END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- 7. HELPER VIEWS

-- View for user's preferred styles with names
CREATE OR REPLACE VIEW user_preferences_with_styles AS
SELECT
  up.id,
  up.user_id,
  up.preferred_styles,
  up.interests,
  up.budget_range,
  up.commission_frequency,
  up.completed_quiz,
  up.created_at,
  up.updated_at,
  u.username,
  u.email
FROM user_preferences up
JOIN users u ON up.user_id = u.id;

-- View for artwork with engagement metrics
CREATE OR REPLACE VIEW artworks_with_engagement AS
SELECT
  a.*,
  COALESCE(aes.total_views, 0) as engagement_views,
  COALESCE(aes.total_clicks, 0) as engagement_clicks,
  COALESCE(aes.total_saves, 0) as engagement_saves,
  COALESCE(aes.total_shares, 0) as engagement_shares,
  COALESCE(aes.total_commission_inquiries, 0) as engagement_inquiries,
  COALESCE(aes.engagement_score, 0) as engagement_score,
  aes.last_engagement_at
FROM artworks a
LEFT JOIN artwork_engagement_stats aes ON a.id = aes.artwork_id;

-- 8. GRANTS (adjust based on your database user)
-- GRANT ALL ON user_preferences TO your_app_user;
-- GRANT ALL ON user_engagement TO your_app_user;
-- GRANT ALL ON artwork_engagement_stats TO your_app_user;
-- GRANT ALL ON trending_artworks TO your_app_user;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================

-- To verify tables were created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_preferences', 'user_engagement', 'artwork_engagement_stats', 'trending_artworks');
