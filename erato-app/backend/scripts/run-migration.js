import { supabaseAdmin } from '../src/config/supabase.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(__dirname, '../migrations/create_commission_files_table.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration: create_commission_files_table.sql');
    console.log('---');

    // Split the SQL into individual statements (separated by semicolons)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql_query: statement + ';'
      }).catch(async () => {
        // If exec_sql RPC doesn't exist, try direct SQL execution
        // This requires the SQL to be run directly via the Supabase client
        // For Supabase, we'll need to use the REST API directly
        return await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql_query: statement + ';' })
        }).then(r => r.json());
      });

      if (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        throw error;
      }
    }

    console.log('---');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('The commission_files table has been created with:');
    console.log('  - Columns: id, commission_id, uploader_id, file_url, file_name, file_type, created_at, updated_at');
    console.log('  - Indexes on commission_id, uploader_id, and created_at');
    console.log('  - Row Level Security (RLS) policies for secure access');
    console.log('');
    console.log('You can now upload reference images to commissions!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('Please run the SQL manually in your Supabase dashboard:');
    console.log('1. Go to https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Copy and paste the contents of: backend/migrations/create_commission_files_table.sql');
    console.log('5. Click "Run"');
    process.exit(1);
  }
}

runMigration();
