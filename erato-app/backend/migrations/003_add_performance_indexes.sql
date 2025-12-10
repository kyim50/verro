-- Performance indexes for optimal query performance
-- Run this in your Supabase SQL editor or via migration tool

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Artist indexes
-- Note: artists.id is the primary key (already indexed) and is the foreign key to users.id
-- Primary key indexes are created automatically, so we don't need to index artists.id
CREATE INDEX IF NOT EXISTS idx_artists_commission_status ON artists(commission_status);

-- Artwork indexes (most important for feed performance)
CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_tags ON artworks USING GIN(tags);

-- Board indexes
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_board_artworks_board_id ON board_artworks(board_id);
CREATE INDEX IF NOT EXISTS idx_board_artworks_artwork_id ON board_artworks(artwork_id);

-- Message indexes (critical for chat performance)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Commission indexes
CREATE INDEX IF NOT EXISTS idx_commissions_client_id ON commissions(client_id);
CREATE INDEX IF NOT EXISTS idx_commissions_artist_id ON commissions(artist_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at DESC);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_reviews_artist_id ON reviews(artist_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_commission_id ON reviews(commission_id);

-- Swipe indexes
CREATE INDEX IF NOT EXISTS idx_swipes_user_id ON swipes(user_id);
CREATE INDEX IF NOT EXISTS idx_swipes_artist_id ON swipes(artist_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_artworks_artist_created ON artworks(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_artist_status ON commissions(artist_id, status);

-- Analyze tables after creating indexes (helps PostgreSQL optimizer)
ANALYZE users;
ANALYZE artists;
ANALYZE artworks;
ANALYZE boards;
ANALYZE board_artworks;
ANALYZE messages;
ANALYZE conversations;
ANALYZE conversation_participants;
ANALYZE commissions;
ANALYZE reviews;
ANALYZE swipes;

