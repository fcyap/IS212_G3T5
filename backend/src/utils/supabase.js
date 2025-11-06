const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for server-side operations

// If environment variables are not set, try loading from .env file
if (!supabaseUrl || !supabaseKey) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  supabaseUrl = process.env.SUPABASE_URL;
  supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// In test environment, use dummy values if real ones aren't available
if ((!supabaseUrl || !supabaseKey) && process.env.NODE_ENV === 'test') {
  supabaseUrl = supabaseUrl || 'https://dummy-project.supabase.co';
  supabaseKey = supabaseKey || 'dummy-service-role-key-for-testing';
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }, // Server-side doesn't need session persistence
});

module.exports = supabase;
