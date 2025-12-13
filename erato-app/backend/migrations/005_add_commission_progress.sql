-- Commission Progress Updates
-- Tracks WIP images, approval checkpoints, and revision requests
CREATE TABLE IF NOT EXISTS commission_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  
  -- Update type: 'wip_image', 'approval_checkpoint', 'revision_request'
  update_type VARCHAR(50) NOT NULL,
  
  -- Image URL (for WIP images or revision-marked images)
  image_url TEXT,
  
  -- Approval checkpoint data
  requires_approval BOOLEAN DEFAULT false,
  approval_status VARCHAR(20), -- 'pending', 'approved', 'rejected'
  approval_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Revision request data
  revision_number INTEGER DEFAULT 0,
  revision_notes TEXT,
  markup_data JSONB, -- Stores drawing/annotation data (coordinates, shapes, etc.)
  
  -- Metadata
  notes TEXT, -- General notes/description
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_update_type CHECK (update_type IN ('wip_image', 'approval_checkpoint', 'revision_request')),
  CONSTRAINT valid_approval_status CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_progress_updates_commission ON commission_progress_updates(commission_id);
CREATE INDEX IF NOT EXISTS idx_progress_updates_type ON commission_progress_updates(commission_id, update_type);
CREATE INDEX IF NOT EXISTS idx_progress_updates_approval ON commission_progress_updates(commission_id, approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_progress_updates_created ON commission_progress_updates(commission_id, created_at DESC);

-- Add revision count tracking to commissions
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS current_revision_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_revision_count INTEGER DEFAULT 2; -- From package or default



