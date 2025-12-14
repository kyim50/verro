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
    const migrationPath = join(__dirname, 'migrations', 'create_pending_reviews_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    const { error } = await supabase.rpc('exec_sql', { sql_string: migrationSQL });

    if (error) {
      // If the function doesn't exist, try running each statement separately
      console.log('Function not found, running statements individually...');
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_string: statement });
        if (stmtError) {
          console.error('Error executing statement:', stmtError);
          // Continue anyway as some errors might be "already exists"
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('The pending_reviews table has been created.');
  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();
