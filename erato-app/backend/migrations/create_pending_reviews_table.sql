-- Create pending_reviews table to track reviews that need to be submitted after commission completion
CREATE TABLE IF NOT EXISTS pending_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('client_to_artist', 'artist_to_client')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(commission_id, user_id, review_type)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_pending_reviews_user_id ON pending_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_commission_id ON pending_reviews(commission_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_created_at ON pending_reviews(created_at DESC);

-- Add RLS policies
ALTER TABLE pending_reviews ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending reviews
CREATE POLICY "Users can view their own pending reviews"
  ON pending_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert pending reviews (backend only)
CREATE POLICY "System can insert pending reviews"
  ON pending_reviews
  FOR INSERT
  WITH CHECK (true);

-- Users can delete their own pending reviews (when they complete the review)
CREATE POLICY "Users can delete their own pending reviews"
  ON pending_reviews
  FOR DELETE
  USING (auth.uid() = user_id);
