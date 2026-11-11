/**
 * Script to create multiple public accounts via Supabase Auth Admin API.
 * Uses the service role key to bypass RLS and create users directly.
 * 
 * Usage: npx tsx scripts/create-accounts.ts
 * 
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://jsyqtfsidtfahytcwutp.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('\nTo get your service role key:');
  console.error('1. Go to https://supabase.com/dashboard/project/jsyqtfsidtfahytcwutp/settings/api');
  console.error('2. Copy the "service_role" key (secret)');
  console.error('3. Set it as an environment variable:');
  console.error('   PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  console.error('   CMD: set SUPABASE_SERVICE_ROLE_KEY=your-key-here');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface AccountData {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

const accounts: AccountData[] = [
  {
    email: 'kingjaqar@gmail.com',
    password: 'password12345',
    username: 'kingjaqar123',
    displayName: 'kingjaqar',
  },
  {
    email: 'juan@gmail.com',
    password: 'password12345',
    username: 'juan123',
    displayName: 'juan',
  },
  {
    email: 'james@gmail.com',
    password: 'password12345',
    username: 'james123',
    displayName: 'james',
  },
  {
    email: 'bronny@gmail.com',
    password: 'password12345',
    username: 'bronny123',
    displayName: 'bronny',
  },
  {
    email: 'white@gmail.com',
    password: 'password12345',
    username: 'white123',
    displayName: 'white',
  },
];

async function createAccount(account: AccountData): Promise<void> {
  console.log(`\nCreating account: ${account.email}`);
  console.log(`  Username: ${account.username}`);
  console.log(`  Display name: ${account.displayName}`);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: {
          username: account.username,
          display_name: account.displayName,
        },
        // Bypass email confirmation since it's disabled in the config (D-163)
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      console.error(`  ❌ FAILED: ${error.message}`);
      return;
    }

    if (data.user) {
      console.log(`  ✓ SUCCESS: User created with ID ${data.user.id}`);
      
      // The M1-03 trigger should automatically create the profile and Saved Messages chat
      if (data.session) {
        console.log(`  ✓ Session created (email confirmation bypassed)`);
      }
    } else {
      console.log(`  ⚠ WARNING: User created but no user data returned`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ EXCEPTION: ${errorMessage}`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DoloGram Account Creation Script');
  console.log('='.repeat(60));
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Accounts to create: ${accounts.length}`);
  
  for (const account of accounts) {
    await createAccount(account);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Account creation complete');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
