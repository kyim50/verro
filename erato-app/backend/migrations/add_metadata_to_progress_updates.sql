-- Add metadata column to commission_progress_updates table
-- This stores additional data like additional_images array for approval checkpoints

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='metadata') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN metadata JSONB DEFAULT NULL;
  END IF;
END $$;

-- Add index for JSONB queries if needed
CREATE INDEX IF NOT EXISTS idx_progress_updates_metadata ON public.commission_progress_updates USING GIN (metadata);

-- Add comment
COMMENT ON COLUMN public.commission_progress_updates.metadata IS 'Additional JSON metadata for progress updates (e.g., additional_images array)';
