const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_ANON_KEY;

// If environment variables are not set, try loading from .env file
if (!supabaseUrl || !supabaseKey) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  supabaseUrl = process.env.SUPABASE_URL;
  supabaseKey = process.env.SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
