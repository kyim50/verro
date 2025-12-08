-- Performance optimization indexes
-- These indexes dramatically improve query performance for common operations

-- Commissions table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    CREATE INDEX IF NOT EXISTS idx_commissions_client_id ON commissions(client_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_artist_id ON commissions(artist_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
    CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_commissions_client_artist ON commissions(client_id, artist_id);
    CREATE INDEX IF NOT EXISTS idx_commissions_artist_status ON commissions(artist_id, status);
    CREATE INDEX IF NOT EXISTS idx_commissions_client_status ON commissions(client_id, status);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'commissions' 
        AND column_name = 'artwork_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_commissions_artwork_id ON commissions(artwork_id) WHERE artwork_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Users table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'user_type'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'created_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
    END IF;
  END IF;
END $$;

-- Artists table indexes
-- Note: artists.id is the same as user_id (artists table uses user id as primary key)
-- Only create index on user_id if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artists' 
      AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artists' 
      AND column_name = 'commission_status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artists_commission_status ON artists(commission_status);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'artists' 
      AND column_name = 'created_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_artists_created_at ON artists(created_at DESC);
  END IF;
END $$;

-- Artworks table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artworks') THEN
    CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'artworks' 
        AND column_name = 'created_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at DESC);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'artworks' 
        AND column_name = 'like_count'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_artworks_like_count ON artworks(like_count DESC);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'artworks' 
        AND column_name = 'view_count'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_artworks_view_count ON artworks(view_count DESC);
    END IF;
  END IF;
END $$;

-- Boards table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'boards') THEN
    CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'boards' 
        AND column_name = 'is_public'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_boards_is_public ON boards(is_public) WHERE is_public = true;
      CREATE INDEX IF NOT EXISTS idx_boards_user_public ON boards(user_id, is_public);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'boards' 
        AND column_name = 'created_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_boards_created_at ON boards(created_at DESC);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'boards' 
        AND column_name = 'board_type'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_boards_board_type ON boards(board_type);
    END IF;
  END IF;
END $$;

-- Board artworks junction table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'board_artworks') THEN
    CREATE INDEX IF NOT EXISTS idx_board_artworks_board_id ON board_artworks(board_id);
    CREATE INDEX IF NOT EXISTS idx_board_artworks_artwork_id ON board_artworks(artwork_id);
    CREATE INDEX IF NOT EXISTS idx_board_artworks_composite ON board_artworks(board_id, artwork_id);
  END IF;
END $$;

-- Messages and conversations indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'message_type'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'is_read'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read, created_at DESC) 
        WHERE is_read = false;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'conversations' 
        AND column_name = 'commission_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_conversations_commission_id ON conversations(commission_id) WHERE commission_id IS NOT NULL;
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'conversations' 
        AND column_name = 'created_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_participants') THEN
    CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_participants_composite ON conversation_participants(conversation_id, user_id);
  END IF;
END $$;

-- Swipes table indexes (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'swipes') THEN
    CREATE INDEX IF NOT EXISTS idx_swipes_user_id ON swipes(user_id);
    CREATE INDEX IF NOT EXISTS idx_swipes_artist_id ON swipes(artist_id);
    CREATE INDEX IF NOT EXISTS idx_swipes_user_artist ON swipes(user_id, artist_id);
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'swipes' 
        AND column_name = 'swipe_type'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_swipes_swipe_type ON swipes(swipe_type);
    END IF;
  END IF;
END $$;

-- Composite indexes for reviews (with existence checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    CREATE INDEX IF NOT EXISTS idx_reviews_artist_type_created ON reviews(artist_id, review_type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_client_type_created ON reviews(client_id, review_type, created_at DESC);
  END IF;
  
  -- Partial indexes for active/important data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commissions') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'commissions' 
        AND column_name = 'status'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_commissions_active ON commissions(client_id, artist_id, status) 
        WHERE status IN ('pending', 'accepted', 'in_progress');
    END IF;
  END IF;
END $$;

