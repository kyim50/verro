-- ================================================
-- COMMISSION REQUEST BOARD SYSTEM
-- Database Migration Script
-- ================================================
-- This creates a "quest board" style commission request system where:
-- - Clients post commission requests with fixed terms (price, deadline, details, references)
-- - Artists can view all open requests and apply/bid on them
-- - Clients review applications and choose one artist
-- - Once chosen, the request disappears from other artists' boards
-- - Request converts to a regular commission workflow

-- 1. COMMISSION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS commission_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Request details
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  budget_min NUMERIC(10, 2),
  budget_max NUMERIC(10, 2),
  deadline TIMESTAMPTZ, -- When client needs it done

  -- Preferences
  preferred_styles TEXT[] DEFAULT '{}', -- Array of style preferences/tags
  reference_images TEXT[] DEFAULT '{}', -- Array of reference image URLs

  -- Status tracking
  status VARCHAR(50) DEFAULT 'open' NOT NULL, -- 'open', 'awarded', 'closed', 'cancelled'
  awarded_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Artist who was chosen

  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  bid_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_at TIMESTAMPTZ, -- When an artist was selected
  closed_at TIMESTAMPTZ -- When request was closed/completed
);

-- Indexes for commission requests
CREATE INDEX IF NOT EXISTS idx_commission_requests_client_id ON commission_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_commission_requests_status ON commission_requests(status);
CREATE INDEX IF NOT EXISTS idx_commission_requests_created_at ON commission_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_requests_awarded_to ON commission_requests(awarded_to);
CREATE INDEX IF NOT EXISTS idx_commission_requests_styles ON commission_requests USING GIN(preferred_styles);

-- Index for filtering open requests
CREATE INDEX IF NOT EXISTS idx_commission_requests_open ON commission_requests(status, created_at DESC) WHERE status = 'open';

-- 2. COMMISSION REQUEST BIDS (Artist Applications)
CREATE TABLE IF NOT EXISTS commission_request_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES commission_requests(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Bid details
  bid_amount NUMERIC(10, 2) NOT NULL,
  estimated_delivery_days INTEGER, -- How many days artist estimates
  message TEXT, -- Artist's pitch/message to client
  portfolio_samples TEXT[] DEFAULT '{}', -- Links to relevant portfolio work

  -- Status
  status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'accepted', 'rejected', 'withdrawn'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ, -- When client reviewed the bid

  -- Prevent duplicate bids
  UNIQUE(request_id, artist_id)
);

-- Indexes for bids
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_request_id ON commission_request_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_artist_id ON commission_request_bids(artist_id);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_status ON commission_request_bids(status);
CREATE INDEX IF NOT EXISTS idx_commission_request_bids_created_at ON commission_request_bids(created_at DESC);

-- 3. TRIGGER TO UPDATE BID COUNT
CREATE OR REPLACE FUNCTION update_commission_request_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE commission_requests
    SET bid_count = bid_count + 1,
        updated_at = NOW()
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE commission_requests
    SET bid_count = GREATEST(0, bid_count - 1),
        updated_at = NOW()
    WHERE id = OLD.request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bid_count ON commission_request_bids;
CREATE TRIGGER trigger_update_bid_count
  AFTER INSERT OR DELETE ON commission_request_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_request_bid_count();

-- 4. TRIGGER TO AUTO-UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION update_commission_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_commission_request_timestamp ON commission_requests;
CREATE TRIGGER trigger_commission_request_timestamp
  BEFORE UPDATE ON commission_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_request_timestamp();

DROP TRIGGER IF EXISTS trigger_commission_request_bid_timestamp ON commission_request_bids;
CREATE TRIGGER trigger_commission_request_bid_timestamp
  BEFORE UPDATE ON commission_request_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_request_timestamp();

-- 5. FUNCTION TO GET FILTERED REQUESTS FOR ARTISTS
-- This function returns requests filtered by various criteria
CREATE OR REPLACE FUNCTION get_commission_requests_for_artist(
  p_artist_id UUID,
  p_budget_min NUMERIC DEFAULT NULL,
  p_budget_max NUMERIC DEFAULT NULL,
  p_styles TEXT[] DEFAULT NULL,
  p_sort_by VARCHAR DEFAULT 'recent' -- 'recent', 'budget_high', 'budget_low', 'bids_low'
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  title VARCHAR,
  description TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  deadline TIMESTAMPTZ,
  preferred_styles TEXT[],
  reference_images TEXT[],
  view_count INTEGER,
  bid_count INTEGER,
  created_at TIMESTAMPTZ,
  has_applied BOOLEAN,
  matches_style BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.client_id,
    cr.title,
    cr.description,
    cr.budget_min,
    cr.budget_max,
    cr.deadline,
    cr.preferred_styles,
    cr.reference_images,
    cr.view_count,
    cr.bid_count,
    cr.created_at,
    EXISTS(
      SELECT 1 FROM commission_request_bids
      WHERE request_id = cr.id AND artist_id = p_artist_id
    ) as has_applied,
    (
      p_styles IS NULL OR
      cr.preferred_styles && p_styles OR
      array_length(cr.preferred_styles, 1) IS NULL
    ) as matches_style
  FROM commission_requests cr
  WHERE cr.status = 'open'
    AND (p_budget_min IS NULL OR cr.budget_max IS NULL OR cr.budget_max >= p_budget_min)
    AND (p_budget_max IS NULL OR cr.budget_min IS NULL OR cr.budget_min <= p_budget_max)
    AND (p_styles IS NULL OR cr.preferred_styles && p_styles OR array_length(cr.preferred_styles, 1) IS NULL)
  ORDER BY
    CASE
      WHEN p_sort_by = 'recent' THEN cr.created_at
    END DESC,
    CASE
      WHEN p_sort_by = 'budget_high' THEN COALESCE(cr.budget_max, cr.budget_min, 0)
    END DESC,
    CASE
      WHEN p_sort_by = 'budget_low' THEN COALESCE(cr.budget_min, cr.budget_max, 999999)
    END ASC,
    CASE
      WHEN p_sort_by = 'bids_low' THEN cr.bid_count
    END ASC;
END;
$$ LANGUAGE plpgsql;

-- 6. HELPER VIEWS

-- View for requests with client info
CREATE OR REPLACE VIEW commission_requests_with_client AS
SELECT
  cr.*,
  u.username as client_username,
  u.full_name as client_name,
  u.avatar_url as client_avatar
FROM commission_requests cr
LEFT JOIN users u ON cr.client_id = u.id;

-- View for bids with artist and request info
CREATE OR REPLACE VIEW commission_request_bids_with_details AS
SELECT
  crb.*,
  u.username as artist_username,
  u.full_name as artist_name,
  u.avatar_url as artist_avatar,
  cr.title as request_title,
  cr.client_id as request_client_id
FROM commission_request_bids crb
LEFT JOIN users u ON crb.artist_id = u.id
LEFT JOIN commission_requests cr ON crb.request_id = cr.id;

-- 7. SAMPLE QUERIES FOR COMMON OPERATIONS

-- Get all open requests (quest board)
-- SELECT * FROM commission_requests WHERE status = 'open' ORDER BY created_at DESC;

-- Get requests matching artist's style
-- SELECT * FROM get_commission_requests_for_artist('artist-uuid', NULL, NULL, ARRAY['anime', 'character-design'], 'recent');

-- Get all bids for a request (client viewing applications)
-- SELECT * FROM commission_request_bids_with_details WHERE request_id = 'request-uuid' ORDER BY created_at DESC;

-- Get artist's submitted bids
-- SELECT * FROM commission_request_bids_with_details WHERE artist_id = 'artist-uuid' ORDER BY created_at DESC;

-- Get client's posted requests with bid counts
-- SELECT * FROM commission_requests_with_client WHERE client_id = 'client-uuid' ORDER BY created_at DESC;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================

-- To verify tables were created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('commission_requests', 'commission_request_bids');
