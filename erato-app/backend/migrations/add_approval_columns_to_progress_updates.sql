-- Add approval-related columns to commission_progress_updates table
-- These columns support the milestone approval checkpoint system

DO $$
BEGIN
  -- Add requires_approval column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='requires_approval') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN requires_approval BOOLEAN DEFAULT false;
  END IF;

  -- Add approval_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='approval_status') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN approval_status VARCHAR(20) DEFAULT NULL;
  END IF;

  -- Add approved_at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='approved_at') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add rejected_at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='rejected_at') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add approval_notes for client feedback
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='approval_notes') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN approval_notes TEXT;
  END IF;
END $$;

-- Add index for approval status queries
CREATE INDEX IF NOT EXISTS idx_progress_updates_approval_status ON public.commission_progress_updates(approval_status);

-- Add constraint for approval_status values
ALTER TABLE public.commission_progress_updates
DROP CONSTRAINT IF EXISTS check_approval_status_values;

ALTER TABLE public.commission_progress_updates
ADD CONSTRAINT check_approval_status_values
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_requested') OR approval_status IS NULL);

-- Add comments
COMMENT ON COLUMN public.commission_progress_updates.requires_approval IS 'Whether this progress update requires client approval before proceeding';
COMMENT ON COLUMN public.commission_progress_updates.approval_status IS 'Status of approval: pending, approved, rejected, revision_requested';
COMMENT ON COLUMN public.commission_progress_updates.approved_at IS 'Timestamp when client approved the progress update';
COMMENT ON COLUMN public.commission_progress_updates.rejected_at IS 'Timestamp when client rejected the progress update';
COMMENT ON COLUMN public.commission_progress_updates.approval_notes IS 'Client notes/feedback on the approval decision';
