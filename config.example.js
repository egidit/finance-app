// ============================================================================
// Configuration Template
// ============================================================================
// Copy this file to config.js and replace with your actual Supabase credentials
// Get them from: https://supabase.com/dashboard/project/_/settings/api
// 
// IMPORTANT: Never commit config.js to version control!
// ============================================================================

const CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY_HERE'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
