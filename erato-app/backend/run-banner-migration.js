import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = join(__dirname, 'migrations', 'add_banner_url_to_users.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('Running migration to add banner_url to users table...');

    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);

      // Use direct query instead of rpc
      const { error } = await supabase.rpc('exec_sql', { sql_string: statement })
        .catch(async (rpcError) => {
          // If RPC doesn't exist, try direct query (this might not work depending on permissions)
          console.log('RPC not available, trying direct SQL execution...');
          return await supabase.from('_sql').select('*').limit(0); // This won't work, but will try
        });

      if (error) {
        console.error('Error executing statement:', error);
        // Check if error is "already exists" which is okay
        if (error.message && error.message.includes('already exists')) {
          console.log('Column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('The banner_url column has been added to the users table.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    console.log('\n⚠️  If the migration failed, you can run it manually in Supabase SQL Editor:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of migrations/add_banner_url_to_users.sql');
    console.log('4. Click "Run" to execute the migration');
    process.exit(1);
  }
}

runMigration();
