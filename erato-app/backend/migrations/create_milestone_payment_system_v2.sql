-- Enhanced Milestone Payment System Migration (v2 - Fixed)
-- This migration adds support for milestone-based payments tied to approval checkpoints

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS public.commission_milestones CASCADE;
DROP TABLE IF EXISTS public.milestone_stage_templates CASCADE;

-- Create milestone stage templates table FIRST (no dependencies)
CREATE TABLE public.milestone_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  default_percentage DECIMAL(5, 2) NOT NULL,
  typical_order INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default milestone stage templates
INSERT INTO public.milestone_stage_templates (stage, display_name, default_percentage, typical_order, description) VALUES
  ('sketch', 'Sketch/Rough Draft', 25.00, 1, 'Initial concept and composition approval'),
  ('line_art', 'Line Art/Inking', 25.00, 2, 'Clean line work and structure'),
  ('base_colors', 'Base Colors', 25.00, 3, 'Flat color application'),
  ('shading', 'Shading/Rendering', 25.00, 4, 'Lighting, shading, and final details');

-- Create commission_milestones table
CREATE TABLE public.commission_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  stage VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  payment_required_before_work BOOLEAN NOT NULL DEFAULT true,
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id),
  progress_update_id UUID REFERENCES public.commission_progress_updates(id),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  revision_fee_added DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(commission_id, milestone_number)
);

-- Add indexes for performance
CREATE INDEX idx_commission_milestones_commission_id ON public.commission_milestones(commission_id);
CREATE INDEX idx_commission_milestones_payment_status ON public.commission_milestones(payment_status);
CREATE INDEX idx_commission_milestones_stage ON public.commission_milestones(stage);
CREATE INDEX idx_commission_milestones_progress_update ON public.commission_milestones(progress_update_id);

-- Add new fields to commissions table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='milestone_plan_confirmed') THEN
    ALTER TABLE public.commissions ADD COLUMN milestone_plan_confirmed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='total_revision_fees') THEN
    ALTER TABLE public.commissions ADD COLUMN total_revision_fees DECIMAL(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='max_revision_count') THEN
    ALTER TABLE public.commissions ADD COLUMN max_revision_count INTEGER DEFAULT 2;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='current_revision_count') THEN
    ALTER TABLE public.commissions ADD COLUMN current_revision_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='revision_fee_per_request') THEN
    ALTER TABLE public.commissions ADD COLUMN revision_fee_per_request DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add current_milestone_id AFTER commission_milestones table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commissions' AND column_name='current_milestone_id') THEN
    ALTER TABLE public.commissions ADD COLUMN current_milestone_id UUID REFERENCES public.commission_milestones(id);
  END IF;
END $$;

-- Add new fields to commission_progress_updates table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='milestone_id') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN milestone_id UUID REFERENCES public.commission_milestones(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='commission_progress_updates' AND column_name='milestone_stage') THEN
    ALTER TABLE public.commission_progress_updates ADD COLUMN milestone_stage VARCHAR(50);
  END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.commission_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_stage_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for commission_milestones
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view milestones for their commissions" ON public.commission_milestones;
DROP POLICY IF EXISTS "Artists can create milestones for their commissions" ON public.commission_milestones;
DROP POLICY IF EXISTS "Artists can update milestones for their commissions" ON public.commission_milestones;

CREATE POLICY "Users can view milestones for their commissions"
ON public.commission_milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.commissions
    WHERE commissions.id = commission_milestones.commission_id
    AND (commissions.client_id = auth.uid() OR commissions.artist_id = auth.uid())
  )
);

CREATE POLICY "Artists can create milestones for their commissions"
ON public.commission_milestones
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.commissions
    WHERE commissions.id = commission_milestones.commission_id
    AND commissions.artist_id = auth.uid()
  )
);

CREATE POLICY "Artists can update milestones for their commissions"
ON public.commission_milestones
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.commissions
    WHERE commissions.id = commission_milestones.commission_id
    AND commissions.artist_id = auth.uid()
  )
);

-- RLS Policies for milestone_stage_templates
DROP POLICY IF EXISTS "Anyone can view milestone stage templates" ON public.milestone_stage_templates;

CREATE POLICY "Anyone can view milestone stage templates"
ON public.milestone_stage_templates
FOR SELECT
USING (true);

-- Add comments
COMMENT ON TABLE public.commission_milestones IS 'Stores milestone payment structure for commissions, linked to approval checkpoints';
COMMENT ON TABLE public.milestone_stage_templates IS 'Default templates for milestone stages (sketch, line art, colors, etc.)';
COMMENT ON COLUMN public.commission_milestones.stage IS 'Type of milestone stage from templates or custom';
COMMENT ON COLUMN public.commission_milestones.payment_required_before_work IS 'If true, payment must be received before artist can start this milestone';
COMMENT ON COLUMN public.commission_milestones.is_locked IS 'Locked until previous milestone is completed and paid';
COMMENT ON COLUMN public.commission_milestones.revision_fee_added IS 'Additional fees from revision requests beyond the included limit';
COMMENT ON COLUMN public.commissions.milestone_plan_confirmed IS 'Whether client has confirmed the milestone payment plan';
COMMENT ON COLUMN public.commissions.current_milestone_id IS 'The milestone currently being worked on';
COMMENT ON COLUMN public.commissions.total_revision_fees IS 'Total accumulated fees from revision requests';

-- Function to automatically lock future milestones
CREATE OR REPLACE FUNCTION lock_future_milestones()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    UPDATE public.commission_milestones
    SET is_locked = false
    WHERE commission_id = NEW.commission_id
    AND milestone_number = NEW.milestone_number + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to lock/unlock milestones based on payment
DROP TRIGGER IF EXISTS trigger_lock_future_milestones ON public.commission_milestones;
CREATE TRIGGER trigger_lock_future_milestones
  AFTER UPDATE OF payment_status ON public.commission_milestones
  FOR EACH ROW
  EXECUTE FUNCTION lock_future_milestones();

-- Function to add revision fees to milestones
CREATE OR REPLACE FUNCTION add_revision_fee_to_milestone()
RETURNS TRIGGER AS $$
DECLARE
  commission_record RECORD;
  revision_fee DECIMAL(10, 2);
BEGIN
  IF NEW.update_type = 'revision_request' THEN
    SELECT c.*, c.current_revision_count, c.max_revision_count, c.revision_fee_per_request, c.current_milestone_id
    INTO commission_record
    FROM public.commissions c
    WHERE c.id = NEW.commission_id;

    IF commission_record.current_revision_count >= commission_record.max_revision_count
       AND commission_record.revision_fee_per_request > 0 THEN

      revision_fee := commission_record.revision_fee_per_request;

      IF commission_record.current_milestone_id IS NOT NULL THEN
        UPDATE public.commission_milestones
        SET revision_fee_added = revision_fee_added + revision_fee,
            amount = amount + revision_fee
        WHERE id = commission_record.current_milestone_id;
      ELSE
        -- Find the first unpaid milestone and update it
        UPDATE public.commission_milestones
        SET revision_fee_added = revision_fee_added + revision_fee,
            amount = amount + revision_fee
        WHERE id = (
          SELECT id FROM public.commission_milestones
          WHERE commission_id = NEW.commission_id
          AND payment_status = 'unpaid'
          ORDER BY milestone_number ASC
          LIMIT 1
        );
      END IF;

      UPDATE public.commissions
      SET total_revision_fees = total_revision_fees + revision_fee
      WHERE id = NEW.commission_id;
    END IF;

    UPDATE public.commissions
    SET current_revision_count = current_revision_count + 1
    WHERE id = NEW.commission_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to handle revision fees
DROP TRIGGER IF EXISTS trigger_add_revision_fee ON public.commission_progress_updates;
CREATE TRIGGER trigger_add_revision_fee
  AFTER INSERT ON public.commission_progress_updates
  FOR EACH ROW
  EXECUTE FUNCTION add_revision_fee_to_milestone();
