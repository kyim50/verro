# Database Migrations

This directory contains SQL migration scripts for the Erato backend database.

## Running Migrations

### Option 1: Using the Migration Script (Automated)

```bash
cd erato-app/backend
npm run migrate
```

### Option 2: Manual Migration via Supabase Dashboard

If the automated script doesn't work, you can run the migration manually:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of the migration file (`create_commission_files_table.sql`)
6. Paste it into the SQL editor
7. Click **Run** or press `Cmd/Ctrl + Enter`

## Current Migrations

### `create_commission_files_table.sql`

**Purpose:** Creates the `commission_files` table to store reference images and other files associated with commissions.

**What it creates:**
- Table: `commission_files` with columns:
  - `id` (UUID, primary key)
  - `commission_id` (UUID, references commissions table)
  - `uploader_id` (UUID, references users table)
  - `file_url` (TEXT, the URL of the uploaded file)
  - `file_name` (TEXT, original filename)
  - `file_type` (TEXT, file type like 'image')
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)
- Indexes on `commission_id`, `uploader_id`, and `created_at` for performance
- Row Level Security (RLS) policies:
  - Users can view files for commissions they're part of (as client or artist)
  - Users can upload files to their commissions
  - Users can delete/update their own uploaded files

**Why it's needed:**
- Reference images uploaded by clients during commission requests need to be stored
- These images are transferred from commission requests to commissions when a bid is accepted
- The Files tab in the commission detail modal displays these images

## Verification

After running the migration, verify it worked:

```bash
# Check if table exists (via psql or Supabase dashboard)
SELECT * FROM information_schema.tables WHERE table_name = 'commission_files';

# Check table structure
\d commission_files

# Or via Supabase dashboard:
# Go to Database > Tables and look for 'commission_files'
```

## Troubleshooting

If you encounter errors:

1. **"Could not find the table 'public.commission_files'"**
   - The table doesn't exist yet. Run the migration.

2. **"relation 'commission_files' already exists"**
   - The table already exists. You can skip this migration.

3. **Permission errors**
   - Make sure you're using the service role key (not anon key)
   - Check your `.env` file has `SUPABASE_SERVICE_ROLE_KEY` set

4. **Foreign key constraint errors**
   - Ensure the `commissions` and `users` tables exist
   - Check that the referenced columns exist
