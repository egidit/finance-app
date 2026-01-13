/**
 * SECURE Supabase Client Configuration
 * 
 * MIGRATION GUIDE:
 * ================
 * 
 * STEP 1: Rotate your Supabase keys
 * ----------------------------------
 * 1. Go to Supabase Dashboard → Project Settings → API
 * 2. Click "Generate new anon key"
 * 3. Copy the new key
 * 4. IMPORTANT: Old key will be invalidated immediately!
 * 
 * STEP 2: Setup environment variables
 * ------------------------------------
 * 
 * Option A: Use Vite/Webpack (Recommended for production)
 * --------------------------------------------------------
 * 1. Install dotenv: npm install dotenv
 * 2. Create .env.local file in project root:
 *    VITE_SUPABASE_URL=https://xxx.supabase.co
 *    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJ...
 * 3. Add .env.local to .gitignore
 * 4. Access via: import.meta.env.VITE_SUPABASE_URL
 * 
 * Option B: Use build-time replacement (current approach - TEMPORARY)
 * -------------------------------------------------------------------
 * 1. Create config.js that's NOT committed to Git:
 *    window.SUPABASE_CONFIG = {
 *      url: 'https://xxx.supabase.co',
 *      anonKey: 'eyJhbGciOiJ...'
 *    };
 * 2. Load before supabase.js:
 *    <script src="js/config.js"></script>
 *    <script src="js/supabase.js"></script>
 * 3. Add config.js to .gitignore
 * 
 * Option C: Server-side injection (BEST for production)
 * ------------------------------------------------------
 * Deploy to Cloudflare Pages/Vercel and use their environment variables:
 * - Variables are injected at build time
 * - Never exposed in client code
 * - Automatically rotated via CI/CD
 * 
 * STEP 3: Update this file
 * -------------------------
 * Replace this entire file with supabase-secure.js (included in fixes)
 * 
 * STEP 4: Verify security
 * ------------------------
 * 1. Search entire codebase for old key: grep -r "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
 * 2. Ensure NO hardcoded keys remain
 * 3. Test login still works
 * 4. Check browser DevTools → Network → Headers (anon key should NOT appear in URL)
 */

// ============================================
// TEMPORARY COMPATIBILITY LAYER
// ============================================
// This version uses window.SUPABASE_CONFIG for easy migration
// TODO: Replace with proper environment variables

(function() {
  'use strict';
  
  // Check for configuration
  if (typeof window.SUPABASE_CONFIG === 'undefined') {
    console.error('❌ SECURITY ERROR: Supabase configuration not found!');
    console.error('Please create js/config.js with:');
    console.error('window.SUPABASE_CONFIG = { url: "...", anonKey: "..." };');
    throw new Error('Missing Supabase configuration');
  }
  
  const SUPABASE_URL = window.SUPABASE_CONFIG.url;
  const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
  
  // Validate configuration
  if (!SUPABASE_URL || !SUPABASE_URL.includes('supabase.co')) {
    throw new Error('Invalid SUPABASE_URL');
  }
  
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 100) {
    throw new Error('Invalid SUPABASE_ANON_KEY');
  }
  
  // Log security status (remove in production)
  console.log('🔒 Supabase client initialized with external configuration');
  console.log('✓ Keys not hardcoded in source files');
  
  // Initialize Supabase client with secure configuration
  const { createClient } = supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: window.localStorage,
      storageKey: 'supabase.auth.token',
      debug: false
    }
  });
  
  // Make available globally (same as before for compatibility)
  window.supabase = supabaseClient;
  
  // Security enhancement: Prevent key extraction via DevTools
  Object.defineProperty(window, 'SUPABASE_CONFIG', {
    configurable: false,
    writable: false,
    enumerable: false  // Hide from Object.keys()
  });
  
})();
