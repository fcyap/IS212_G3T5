// Re-export the main Supabase client from utils/supabase
// This file is kept for backward compatibility
const supabase = require('./utils/supabase');

module.exports = { supabase };