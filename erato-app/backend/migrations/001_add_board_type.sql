-- Migration: Add board_type column to boards table
-- This enables automatic "Created" board functionality (Pinterest-style)
-- Date: 2025-12-04

-- Add board_type column if it doesn't exist
ALTER TABLE boards
ADD COLUMN IF NOT EXISTS board_type VARCHAR(20) DEFAULT 'general';

-- Add unique constraint to prevent duplicate "created" boards per user
ALTER TABLE boards
ADD CONSTRAINT IF NOT EXISTS unique_user_created_board
  UNIQUE (user_id, board_type)
  WHERE board_type = 'created';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_boards_user_type
  ON boards(user_id, board_type);

-- Add comment to document the column
COMMENT ON COLUMN boards.board_type IS 'Board type: general (user-created) or created (auto-generated upload board)';
