-- Verification queries for milestone payment system
-- Run these in Supabase SQL Editor to confirm everything is set up correctly

-- 1. Check milestone stage templates (should return 4 rows)
SELECT stage, display_name, default_percentage, typical_order
FROM milestone_stage_templates
ORDER BY typical_order;

-- 2. Verify commission_milestones table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'commission_milestones'
ORDER BY ordinal_position;

-- 3. Verify new commission fields were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'commissions'
AND column_name IN (
  'milestone_plan_confirmed',
  'current_milestone_id',
  'total_revision_fees',
  'max_revision_count',
  'current_revision_count',
  'revision_fee_per_request'
)
ORDER BY column_name;

-- 4. Verify commission_progress_updates new fields
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'commission_progress_updates'
AND column_name IN ('milestone_id', 'milestone_stage');

-- 5. Check that triggers were created
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgname IN ('trigger_lock_future_milestones', 'trigger_add_revision_fee');

-- 6. Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('commission_milestones', 'milestone_stage_templates');

-- 7. Check RLS policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename IN ('commission_milestones', 'milestone_stage_templates')
ORDER BY tablename, policyname;
