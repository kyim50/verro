-- Migration: Add advanced features (form builder, references, verification, payments)
-- Created: 2025-12-11 (FIXED VERSION)
-- Description: Adds commission form builder, reference management, verification system, and payment features

-- ============================================
-- 1. Commission Form Builder
-- ============================================

-- Add custom form fields to commission packages
ALTER TABLE commission_packages
ADD COLUMN IF NOT EXISTS custom_form_fields JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN commission_packages.custom_form_fields IS 'Custom intake form fields defined by the artist (array of field definitions)';

-- Add form responses to commissions
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS form_responses JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN commissions.form_responses IS 'Client responses to custom form fields';

-- ============================================
-- 2. Reference Management
-- ============================================

-- Create commission_references table for reference materials
CREATE TABLE IF NOT EXISTS commission_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL, -- 'image', 'mood_board', 'color_palette', 'character_sheet', 'link'
  title VARCHAR(255),
  description TEXT,
  file_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- For storing color codes, annotations, etc.
  display_order INTEGER DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for reference management
CREATE INDEX IF NOT EXISTS idx_commission_references_commission_id ON commission_references(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_references_type ON commission_references(reference_type);
CREATE INDEX IF NOT EXISTS idx_commission_references_order ON commission_references(commission_id, display_order);

COMMENT ON TABLE commission_references IS 'Reference materials (images, mood boards, color palettes) for commissions';

-- ============================================
-- 3. Verification System
-- ============================================

-- Add verification fields to artists table
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified', -- 'unverified', 'pending', 'verified', 'rejected'
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_type VARCHAR(50), -- 'portfolio', 'payment', 'identity'
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

COMMENT ON COLUMN artists.verified IS 'Whether the artist has been verified';
COMMENT ON COLUMN artists.verification_status IS 'Current verification status';
COMMENT ON COLUMN artists.verified_at IS 'When the artist was verified';
COMMENT ON COLUMN artists.verification_type IS 'Type of verification completed';

-- Create verification_submissions table
CREATE TABLE IF NOT EXISTS verification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL, -- 'portfolio', 'payment', 'identity'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  submission_data JSONB NOT NULL, -- Proof files, links, etc.
  admin_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),

  CONSTRAINT unique_active_verification UNIQUE (artist_id, verification_type)
);

CREATE INDEX IF NOT EXISTS idx_verification_submissions_artist_id ON verification_submissions(artist_id);
CREATE INDEX IF NOT EXISTS idx_verification_submissions_status ON verification_submissions(status);

COMMENT ON TABLE verification_submissions IS 'Artist verification submissions and their review status';

-- ============================================
-- 4. Enhanced Review System
-- ============================================

-- Add verified commission badge to reviews
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS verified_commission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS artist_response TEXT,
ADD COLUMN IF NOT EXISTS artist_responded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;

COMMENT ON COLUMN reviews.verified_commission IS 'Whether this review is from an actual completed commission';
COMMENT ON COLUMN reviews.artist_response IS 'Artist response to the review';
COMMENT ON COLUMN reviews.helpful_count IS 'Number of users who found this review helpful';

-- Create review_helpfulness table
CREATE TABLE IF NOT EXISTS review_helpfulness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_review_helpful UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpfulness_review_id ON review_helpfulness(review_id);

COMMENT ON TABLE review_helpfulness IS 'Tracks which users found reviews helpful';

-- ============================================
-- 5. Payment System (Deposits, Milestones, Escrow)
-- ============================================

-- Add payment fields to commissions table
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'full', -- 'full', 'deposit', 'milestone'
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'deposit_paid', 'fully_paid', 'refunded', 'cancelled'
ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(50) DEFAULT 'none', -- 'none', 'held', 'released', 'refunded'
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN commissions.payment_type IS 'Type of payment structure (full upfront, deposit, or milestone-based)';
COMMENT ON COLUMN commissions.payment_status IS 'Current payment status';
COMMENT ON COLUMN commissions.deposit_percentage IS 'Percentage required as deposit (default 50%)';
COMMENT ON COLUMN commissions.escrow_status IS 'Status of funds held in escrow for client protection';

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'deposit', 'milestone', 'final', 'tip', 'refund'
  amount DECIMAL(10, 2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT, -- For payouts to artists
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'succeeded', 'failed', 'refunded'
  payer_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  platform_fee DECIMAL(10, 2) DEFAULT 0,
  artist_payout DECIMAL(10, 2),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_commission_id ON payment_transactions(commission_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_intent ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payer ON payment_transactions(payer_id);

COMMENT ON TABLE payment_transactions IS 'All payment transactions for commissions (deposits, milestones, tips, refunds)';

-- Create commission_milestones table
CREATE TABLE IF NOT EXISTS commission_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  milestone_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  percentage INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'submitted', 'approved', 'paid'
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'refunded'
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_commission_milestone_number UNIQUE (commission_id, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_commission_milestones_commission_id ON commission_milestones(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_milestones_status ON commission_milestones(status);

COMMENT ON TABLE commission_milestones IS 'Milestone-based payment structure for large commissions';

-- ============================================
-- 6. File Upload Requirements (for form builder)
-- ============================================

-- Create commission_uploads table for client-submitted files
CREATE TABLE IF NOT EXISTS commission_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  upload_type VARCHAR(50) NOT NULL, -- 'reference', 'character_sheet', 'form_requirement', 'revision_request'
  field_name VARCHAR(255), -- Links to custom form field if applicable
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  file_type VARCHAR(100),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_uploads_commission_id ON commission_uploads(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_uploads_type ON commission_uploads(upload_type);

COMMENT ON TABLE commission_uploads IS 'File uploads related to commissions (references, requirements, etc.)';

-- ============================================
-- 7. Update Triggers
-- ============================================

-- Trigger to update commission total_paid when transactions succeed
CREATE OR REPLACE FUNCTION update_commission_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'succeeded' AND NEW.transaction_type != 'refund' THEN
    UPDATE commissions
    SET total_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_transactions
      WHERE commission_id = NEW.commission_id
      AND status = 'succeeded'
      AND transaction_type != 'refund'
    )
    WHERE id = NEW.commission_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_commission_total_paid
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_total_paid();

-- Trigger to update review helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE reviews
    SET helpful_count = helpful_count + 1
    WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews
    SET helpful_count = GREATEST(helpful_count - 1, 0)
    WHERE id = OLD.review_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_review_helpful_count
  AFTER INSERT OR DELETE ON review_helpfulness
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpful_count();

-- Trigger to auto-verify reviews from actual commissions
-- This checks if the review is from a completed commission
CREATE OR REPLACE FUNCTION verify_commission_review()
RETURNS TRIGGER AS $$
BEGIN
  -- Set verified_commission based on whether there's a completed commission
  -- between the client and artist in this review
  IF NEW.client_id IS NOT NULL AND NEW.artist_id IS NOT NULL THEN
    NEW.verified_commission := EXISTS (
      SELECT 1 FROM commissions
      WHERE status = 'completed'
      AND (
        (client_id = NEW.client_id AND artist_id = NEW.artist_id)
        OR (client_id = NEW.artist_id AND artist_id = NEW.client_id)
      )
    );
  ELSE
    NEW.verified_commission := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verify_commission_review
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION verify_commission_review();

-- ============================================
-- Rollback Instructions
-- ============================================

/*
-- To rollback this migration, run the following:

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_commission_total_paid ON payment_transactions;
DROP TRIGGER IF EXISTS trigger_update_review_helpful_count ON review_helpfulness;
DROP TRIGGER IF EXISTS trigger_verify_commission_review ON reviews;

-- Drop functions
DROP FUNCTION IF EXISTS update_commission_total_paid();
DROP FUNCTION IF EXISTS update_review_helpful_count();
DROP FUNCTION IF EXISTS verify_commission_review();

-- Drop tables
DROP TABLE IF EXISTS commission_uploads;
DROP TABLE IF EXISTS commission_milestones;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS review_helpfulness;
DROP TABLE IF EXISTS verification_submissions;
DROP TABLE IF EXISTS commission_references;

-- Remove columns from existing tables
ALTER TABLE commission_packages DROP COLUMN IF EXISTS custom_form_fields;
ALTER TABLE commissions DROP COLUMN IF EXISTS form_responses;
ALTER TABLE commissions DROP COLUMN IF EXISTS payment_type;
ALTER TABLE commissions DROP COLUMN IF EXISTS payment_status;
ALTER TABLE commissions DROP COLUMN IF EXISTS deposit_amount;
ALTER TABLE commissions DROP COLUMN IF EXISTS deposit_percentage;
ALTER TABLE commissions DROP COLUMN IF EXISTS total_paid;
ALTER TABLE commissions DROP COLUMN IF EXISTS escrow_status;
ALTER TABLE commissions DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE commissions DROP COLUMN IF EXISTS tip_amount;
ALTER TABLE artists DROP COLUMN IF EXISTS verified;
ALTER TABLE artists DROP COLUMN IF EXISTS verification_status;
ALTER TABLE artists DROP COLUMN IF EXISTS verified_at;
ALTER TABLE artists DROP COLUMN IF EXISTS verification_type;
ALTER TABLE artists DROP COLUMN IF EXISTS verification_notes;
ALTER TABLE reviews DROP COLUMN IF EXISTS verified_commission;
ALTER TABLE reviews DROP COLUMN IF EXISTS artist_response;
ALTER TABLE reviews DROP COLUMN IF EXISTS artist_responded_at;
ALTER TABLE reviews DROP COLUMN IF EXISTS helpful_count;
*/
