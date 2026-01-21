// ============================================================================
// Configuration
// ============================================================================
// Replace these with your actual Supabase credentials
// Get them from: https://supabase.com/dashboard/project/_/settings/api
// ============================================================================

const CONFIG = {
  supabaseUrl: 'https://mtqxdiciuryycvqdfgqt.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cXhkaWNpdXJ5eWN2cWRmZ3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NTA1NzMsImV4cCI6MjA4NDQyNjU3M30.UPOqPzxQr4OoKAT7HBLszeatJ713THi84SNrY6MGtXM'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
