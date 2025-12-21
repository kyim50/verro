-- Create commission_files table to store reference images and other files associated with commissions
CREATE TABLE IF NOT EXISTS public.commission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_commission_files_commission_id ON public.commission_files(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_files_uploader_id ON public.commission_files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_commission_files_created_at ON public.commission_files(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.commission_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can view files for commissions they're part of (as client or artist)
CREATE POLICY "Users can view commission files they have access to"
ON public.commission_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.commissions
    WHERE commissions.id = commission_files.commission_id
    AND (commissions.client_id = auth.uid() OR commissions.artist_id = auth.uid())
  )
);

-- Policy: Users can insert files for commissions they're part of
CREATE POLICY "Users can upload files to their commissions"
ON public.commission_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commissions
    WHERE commissions.id = commission_files.commission_id
    AND (commissions.client_id = auth.uid() OR commissions.artist_id = auth.uid())
  )
);

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete their own files"
ON public.commission_files
FOR DELETE
USING (uploader_id = auth.uid());

-- Policy: Users can update their own uploaded files
CREATE POLICY "Users can update their own files"
ON public.commission_files
FOR UPDATE
USING (uploader_id = auth.uid());

-- Add comment to table
COMMENT ON TABLE public.commission_files IS 'Stores reference images and other files associated with commissions';
