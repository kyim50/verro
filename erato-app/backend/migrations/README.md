# Database Migrations

This folder contains SQL migration scripts for the Verro application database.

## How to Run Migrations

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL from the migration file
5. Click **Run** to execute the migration

### Using Supabase CLI

```bash
# Run a specific migration
supabase db execute --file migrations/add_notes_and_favorites.sql

# Or push all migrations
supabase db push
```

### Using psql (PostgreSQL CLI)

```bash
# Connect to your database
psql -h <your-supabase-host> -U postgres -d postgres

# Run the migration
\i migrations/add_notes_and_favorites.sql
```

## Migration Files

### `add_notes_and_favorites.sql`

**Created:** 2025-12-11

**Features Added:**
- `artist_notes` column to `commissions` table for private artist notes
- `favorite_artists` table for users to favorite artists
- Indexes for optimized queries
- Row Level Security (RLS) policies
- Proper foreign key constraints

**Tables Modified:**
- `commissions` - Added `artist_notes` TEXT column

**Tables Created:**
- `favorite_artists` - User favorites for artists

**API Endpoints Using This:**
- `POST /api/commissions/:id/notes` - Save artist note
- `GET /api/commissions/:id/notes` - Get artist note
- `POST /api/artists/:artistId/favorite` - Add to favorites
- `DELETE /api/artists/:artistId/favorite` - Remove from favorites
- `GET /api/artists/favorites/my-list` - Get user's favorites
- `GET /api/artists/:artistId/favorite/status` - Check favorite status

## Rollback Instructions

Each migration file contains rollback instructions at the bottom. To rollback a migration, copy the rollback section and execute it in the SQL editor.

## Best Practices

1. **Always backup** your database before running migrations
2. **Test migrations** in a development environment first
3. **Run migrations during low traffic** periods if possible
4. **Keep track** of which migrations have been applied
5. **Never modify** migration files after they've been applied to production

## Migration Checklist

Before running a migration in production:

- [ ] Migration has been tested in development
- [ ] Database backup has been created
- [ ] Team has been notified of the migration
- [ ] Rollback script has been tested
- [ ] Migration is scheduled during low traffic period
- [ ] Backend code that uses new features has been deployed
- [ ] Frontend code that uses new features is ready to deploy

## Troubleshooting

### Permission Denied Errors

If you encounter permission errors, ensure you're connected as a superuser or have the necessary privileges:

```sql
-- Grant necessary permissions
GRANT ALL ON TABLE favorite_artists TO authenticated;
GRANT ALL ON TABLE commissions TO authenticated;
```

### RLS Policy Conflicts

If RLS policies already exist with the same name, drop them first:

```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### Unique Constraint Violations

If the `favorite_artists` table already exists with different constraints:

```sql
-- Drop the existing constraint
ALTER TABLE favorite_artists DROP CONSTRAINT IF EXISTS unique_user_artist_favorite;

-- Add the new constraint
ALTER TABLE favorite_artists ADD CONSTRAINT unique_user_artist_favorite UNIQUE (user_id, artist_id);
```

## Support

For questions or issues with migrations, please:
1. Check the Supabase documentation
2. Review the rollback instructions in the migration file
3. Create an issue in the project repository
