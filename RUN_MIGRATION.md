# Run Milestone Payment System Migration

## Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy the entire contents of:
   `/Users/kimanimcleish/Desktop/Projects/verro/erato-app/backend/migrations/create_milestone_payment_system_v2.sql`
5. Paste it into the SQL editor
6. Click "Run" (or press Cmd+Enter)
7. Wait for "Success. No rows returned" message

## Option 2: Using psql Command Line

```bash
# Replace these with your Supabase connection details
DB_HOST="your-project-ref.supabase.co"
DB_PASSWORD="your-database-password"

# Run the migration
psql "postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/postgres" \
  -f /Users/kimanimcleish/Desktop/Projects/verro/erato-app/backend/migrations/create_milestone_payment_system_v2.sql
```

## What This Migration Does

✅ Creates `milestone_stage_templates` table with 4 default stages
✅ Creates `commission_milestones` table
✅ Adds fields to `commissions` table:
   - `final_price`
   - `milestone_plan_confirmed`
   - `current_milestone_id`
   - Revision tracking fields

✅ Adds fields to `commission_progress_updates` table
✅ Sets up Row Level Security (RLS) policies
✅ Creates database triggers for automatic milestone unlocking
✅ Creates triggers for revision fee tracking

## After Running Migration

Restart your backend server to ensure it picks up the new schema:

```bash
cd /Users/kimanimcleish/Desktop/Projects/verro/erato-app/backend
npm run dev
```

## Verification

After running, you can verify the tables exist:

```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('commission_milestones', 'milestone_stage_templates');

-- Check if columns were added to commissions
SELECT column_name FROM information_schema.columns
WHERE table_name = 'commissions'
AND column_name IN ('final_price', 'milestone_plan_confirmed', 'current_milestone_id');
```

## Troubleshooting

If you get errors about tables already existing, the migration is idempotent (safe to run multiple times) - it will drop and recreate the milestone tables.

If you get permission errors, make sure you're connecting as the `postgres` user or have sufficient privileges.
