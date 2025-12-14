import { supabaseAdmin } from './src/config/supabase.js';

async function createTable() {
  try {
    console.log('Creating pending_reviews table...');

    // Check if table exists first
    const { data: existingTable } = await supabaseAdmin
      .from('pending_reviews')
      .select('id')
      .limit(1);

    if (existingTable !== null) {
      console.log('✅ Table already exists! Testing query...');
      const { data, error } = await supabaseAdmin
        .from('pending_reviews')
        .select('*')
        .limit(1);

      if (error) {
        console.error('❌ Error querying table:', error);
      } else {
        console.log('✅ Table is working correctly!');
        console.log('Current pending reviews count:', data?.length || 0);
      }
      return;
    }

    console.log('Table does not exist yet.');
    console.log('\n⚠️  Please run the following SQL in your Supabase SQL Editor:');
    console.log('\n---\n');
    console.log(`
-- Create pending_reviews table
CREATE TABLE IF NOT EXISTS pending_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_type VARCHAR(50) NOT NULL CHECK (review_type IN ('client_to_artist', 'artist_to_client')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(commission_id, user_id, review_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_reviews_user_id ON pending_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_commission_id ON pending_reviews(commission_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_created_at ON pending_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE pending_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pending reviews"
  ON pending_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert pending reviews"
  ON pending_reviews
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own pending reviews"
  ON pending_reviews
  FOR DELETE
  USING (auth.uid() = user_id);
    `);
    console.log('\n---\n');
    console.log('After running the SQL, restart this script to verify the table was created.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTable();
