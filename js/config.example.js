// ============================================
// CONFIG.JS - Supabase Configuration
// ============================================
//
// CRITICAL SECURITY NOTICE:
// =========================
// 1. This file contains sensitive credentials
// 2. DO NOT commit this file to Git
// 3. Add "js/config.js" to .gitignore
// 4. Rotate keys if accidentally committed
//
// SETUP INSTRUCTIONS:
// ===================
// 1. Copy this file to js/config.js
// 2. Replace YOUR_PROJECT_ID and YOUR_ANON_KEY with actual values
// 3. Verify js/config.js is in .gitignore
// 4. Update index.html to load this before supabase.js:
//    <script src="js/config.js"></script>
//    <script src="js/supabase-secure.js"></script>
//
// WHERE TO GET THESE VALUES:
// ==========================
// 1. Log into Supabase Dashboard
// 2. Go to Project Settings → API
// 3. Copy "Project URL" → use as url below
// 4. Copy "anon public" key → use as anonKey below
//
// NEVER use "service_role" key in frontend code!
// ============================================

window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'YOUR_ANON_KEY_HERE'
};

// Security checks
(function() {
  if (window.SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID')) {
    console.error('⚠️  WARNING: Using placeholder Supabase configuration!');
    console.error('Please update js/config.js with your actual project values.');
  }
  
  if (window.SUPABASE_CONFIG.anonKey.includes('YOUR_ANON_KEY')) {
    console.error('⚠️  WARNING: Using placeholder anon key!');
    console.error('Please update js/config.js with your actual anon key.');
  }
})();
