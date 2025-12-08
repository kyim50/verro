-- Verification script to check if reviews table exists and what columns it has
-- Run this first to see the current schema

-- Check if reviews table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'reviews'
) AS table_exists;

-- If table exists, show its structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'reviews'
ORDER BY ordinal_position;

