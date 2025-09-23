<<<<<<< HEAD
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
=======
import { createClient } from "@supabase/supabase-js"
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY   
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
module.exports.supabase = supabase;
>>>>>>> origin/michelle
