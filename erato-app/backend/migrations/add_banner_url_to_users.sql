-- Add banner_url column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add comment to column
COMMENT ON COLUMN public.users.banner_url IS 'URL to user banner image stored in Supabase storage';

-- Create index for better query performance when filtering by banner_url
CREATE INDEX IF NOT EXISTS idx_users_banner_url ON public.users(banner_url) WHERE banner_url IS NOT NULL;
