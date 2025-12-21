import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Allow overriding via command line arguments or try to read from .env file
let supabaseUrl = process.argv[2];
let supabaseServiceKey = process.argv[3];

if (!supabaseUrl || !supabaseServiceKey) {
  try {
    console.log('🔍 Reading .env file...');
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');

    // Parse .env file manually
    const envLines = envContent.split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes

        if (key === 'SUPABASE_URL' && !supabaseUrl) {
          supabaseUrl = value;
        } else if ((key === 'SUPABASE_SERVICE_ROLE_KEY' || key === 'SUPABASE_SERVICE_KEY') && !supabaseServiceKey) {
          supabaseServiceKey = value;
        }
      }
    }

    console.log('✅ Parsed environment variables from .env file');
  } catch (error) {
    console.log('⚠️  Could not read .env file:', error.message);
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Usage: node clear-auth-users.js <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY>');
  console.log('   Or ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env file');
  console.log('');
  console.log('   You can find these values in your Supabase project dashboard:');
  console.log('   - Project URL: Settings > API > Project URL');
  console.log('   - Service Role Key: Settings > API > Project API keys > service_role');
  process.exit(1);
}

console.log('✅ Using Supabase URL:', supabaseUrl);
console.log('✅ Service key provided (length:', supabaseServiceKey.length, ')');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function clearAllAuthUsers() {
  try {
    console.log('🔍 Fetching all users from Supabase Auth...');

    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    if (!users || !users.users || users.users.length === 0) {
      console.log('✅ No users found in Supabase Auth');
      return;
    }

    console.log(`📋 Found ${users.users.length} users in Supabase Auth:`);
    users.users.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });

    console.log('\n🗑️  Deleting all users...');

    let deletedCount = 0;
    let failedCount = 0;

    for (const user of users.users) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`❌ Failed to delete user ${user.email}:`, deleteError);
          failedCount++;
        } else {
          console.log(`✅ Deleted user: ${user.email}`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`❌ Error deleting user ${user.email}:`, err);
        failedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully deleted: ${deletedCount} users`);
    if (failedCount > 0) {
      console.log(`❌ Failed to delete: ${failedCount} users`);
    }
    console.log('🎉 Supabase Auth cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
clearAllAuthUsers();
