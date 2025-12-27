-- Commission Queue System and State Tracking Migration
-- Adds queue management, state history, and enhanced cancellation tracking

-- Add new fields to commissions table
DO $$
BEGIN
  -- Queue management fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='queue_position') THEN
    ALTER TABLE public.commissions ADD COLUMN queue_position INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='queue_status') THEN
    ALTER TABLE public.commissions ADD COLUMN queue_status VARCHAR(20) DEFAULT 'active';
  END IF;

  -- State tracking fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='state_history') THEN
    ALTER TABLE public.commissions ADD COLUMN state_history JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='accepted_at') THEN
    ALTER TABLE public.commissions ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='completed_at') THEN
    ALTER TABLE public.commissions ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='declined_at') THEN
    ALTER TABLE public.commissions ADD COLUMN declined_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='cancelled_at') THEN
    ALTER TABLE public.commissions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Enhanced cancellation tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='cancellation_reason') THEN
    ALTER TABLE public.commissions ADD COLUMN cancellation_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='cancelled_by') THEN
    ALTER TABLE public.commissions ADD COLUMN cancelled_by UUID REFERENCES public.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='cancellation_type') THEN
    ALTER TABLE public.commissions ADD COLUMN cancellation_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='cancellation_requested_at') THEN
    ALTER TABLE public.commissions ADD COLUMN cancellation_requested_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='work_proof_urls') THEN
    ALTER TABLE public.commissions ADD COLUMN work_proof_urls JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add new fields to artist_commission_settings table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='artist_commission_settings' AND column_name='auto_promote_waitlist') THEN
    ALTER TABLE public.artist_commission_settings ADD COLUMN auto_promote_waitlist BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_commissions_queue_position ON public.commissions(artist_id, queue_position) WHERE status IN ('in_progress', 'accepted');
CREATE INDEX IF NOT EXISTS idx_commissions_queue_status ON public.commissions(queue_status);
CREATE INDEX IF NOT EXISTS idx_commissions_accepted_at ON public.commissions(accepted_at);
CREATE INDEX IF NOT EXISTS idx_commissions_cancelled_by ON public.commissions(cancelled_by);

-- Function to track state transitions
CREATE OR REPLACE FUNCTION track_commission_state_change()
RETURNS TRIGGER AS $$
DECLARE
  state_entry JSONB;
BEGIN
  -- Only track if status actually changed
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    state_entry := jsonb_build_object(
      'from_status', OLD.status,
      'to_status', NEW.status,
      'changed_at', NOW(),
      'changed_by', auth.uid()
    );

    -- Append to state_history array
    NEW.state_history := COALESCE(OLD.state_history, '[]'::jsonb) || state_entry;

    -- Update timestamp fields based on new status
    CASE NEW.status
      WHEN 'in_progress' THEN
        IF OLD.status = 'pending' THEN
          NEW.accepted_at := NOW();
        END IF;
      WHEN 'completed' THEN
        NEW.completed_at := NOW();
      WHEN 'cancelled' THEN
        NEW.cancelled_at := NOW();
      WHEN 'declined' THEN
        NEW.declined_at := NOW();
      ELSE
        -- Do nothing for other statuses
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for state tracking
DROP TRIGGER IF EXISTS trigger_track_commission_state ON public.commissions;
CREATE TRIGGER trigger_track_commission_state
  BEFORE UPDATE OF status ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION track_commission_state_change();

-- Function to manage queue positions when commission is accepted
CREATE OR REPLACE FUNCTION assign_queue_position()
RETURNS TRIGGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  -- Only assign queue position when status changes to in_progress from pending
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
    -- Get the current max queue position for this artist
    SELECT COALESCE(MAX(queue_position), 0) INTO max_position
    FROM public.commissions
    WHERE artist_id = NEW.artist_id
      AND status IN ('in_progress', 'accepted')
      AND id != NEW.id;

    -- Assign next position (FIFO - First In First Out)
    NEW.queue_position := max_position + 1;
    NEW.queue_status := 'active';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for queue position assignment
DROP TRIGGER IF EXISTS trigger_assign_queue_position ON public.commissions;
CREATE TRIGGER trigger_assign_queue_position
  BEFORE UPDATE OF status ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION assign_queue_position();

-- Function to reorder queue when commission completes or is cancelled
CREATE OR REPLACE FUNCTION reorder_queue_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  artist_settings RECORD;
  next_waitlist_commission RECORD;
BEGIN
  -- Only reorder if commission is leaving the active queue
  IF NEW.status IN ('completed', 'cancelled', 'declined')
     AND OLD.status IN ('in_progress', 'accepted')
     AND OLD.queue_position IS NOT NULL THEN

    -- Shift all commissions with higher positions down by 1
    UPDATE public.commissions
    SET queue_position = queue_position - 1
    WHERE artist_id = NEW.artist_id
      AND status IN ('in_progress', 'accepted')
      AND queue_position > OLD.queue_position;

    -- Clear queue position for completed commission
    NEW.queue_position := NULL;
    NEW.queue_status := NULL;

    -- Check if artist has auto-promote enabled
    SELECT auto_promote_waitlist INTO artist_settings
    FROM public.artist_commission_settings
    WHERE artist_id = NEW.artist_id;

    -- Auto-promote from waitlist if enabled
    IF artist_settings.auto_promote_waitlist = true THEN
      -- Find the oldest waitlisted commission
      SELECT * INTO next_waitlist_commission
      FROM public.commissions
      WHERE artist_id = NEW.artist_id
        AND status = 'pending'
        AND queue_status = 'waitlist'
      ORDER BY created_at ASC
      LIMIT 1;

      -- Promote to active queue if found
      IF next_waitlist_commission.id IS NOT NULL THEN
        UPDATE public.commissions
        SET queue_status = 'active'
        WHERE id = next_waitlist_commission.id;

        -- Note: The artist will still need to formally accept it (status -> in_progress)
        -- This just moves it from waitlist to active pool
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for queue reordering
DROP TRIGGER IF EXISTS trigger_reorder_queue ON public.commissions;
CREATE TRIGGER trigger_reorder_queue
  BEFORE UPDATE OF status ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION reorder_queue_on_completion();

-- Add comments for documentation
COMMENT ON COLUMN public.commissions.queue_position IS 'Position in artist''s active commission queue (1-based, FIFO ordering)';
COMMENT ON COLUMN public.commissions.queue_status IS 'Queue status: active, waitlist, or paused';
COMMENT ON COLUMN public.commissions.state_history IS 'JSONB array tracking all status transitions with timestamps and actors';
COMMENT ON COLUMN public.commissions.accepted_at IS 'Timestamp when artist accepted the commission (status -> in_progress)';
COMMENT ON COLUMN public.commissions.completed_at IS 'Timestamp when commission was completed';
COMMENT ON COLUMN public.commissions.cancelled_at IS 'Timestamp when commission was cancelled';
COMMENT ON COLUMN public.commissions.declined_at IS 'Timestamp when artist declined the commission';
COMMENT ON COLUMN public.commissions.cancellation_reason IS 'Reason provided for cancellation';
COMMENT ON COLUMN public.commissions.cancelled_by IS 'User ID who initiated the cancellation (client or artist)';
COMMENT ON COLUMN public.commissions.cancellation_type IS 'Type of cancellation: auto_pending, client_request_approved, artist_initiated, mutual';
COMMENT ON COLUMN public.commissions.cancellation_requested_at IS 'Timestamp when cancellation was first requested (for approval workflow)';
COMMENT ON COLUMN public.commissions.work_proof_urls IS 'Array of image URLs showing proof of work completed (used for milestone-based cancellation validation)';
COMMENT ON COLUMN public.artist_commission_settings.auto_promote_waitlist IS 'Whether to automatically promote waitlisted commissions when queue slots open';

-- Add CHECK constraints for queue_status values
ALTER TABLE public.commissions
DROP CONSTRAINT IF EXISTS check_queue_status_values;

ALTER TABLE public.commissions
ADD CONSTRAINT check_queue_status_values
CHECK (queue_status IN ('active', 'waitlist', 'paused') OR queue_status IS NULL);

-- Add CHECK constraint for cancellation_type values
ALTER TABLE public.commissions
DROP CONSTRAINT IF EXISTS check_cancellation_type_values;

ALTER TABLE public.commissions
ADD CONSTRAINT check_cancellation_type_values
CHECK (cancellation_type IN ('auto_pending', 'client_request_approved', 'artist_initiated', 'mutual', 'milestone_refund') OR cancellation_type IS NULL);
