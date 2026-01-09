/**
 * Supabase Client Configuration
 * Initialize the Supabase client with PKCE flow and proper session management
 */

const SUPABASE_URL = 'https://hvzpiqnnsiorjizbkzdl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2enBpcW5uc2lvcmppemJremRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDA4NDMsImV4cCI6MjA4MzM3Njg0M30.3eOmNtn-up9VqbSa8IZFY4suHJD8A2EUke4lVKG4ffk';

// Initialize Supabase client with secure configuration
// The global 'supabase' object from supabase-lib.js contains createClient
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Use PKCE flow for enhanced security
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
    debug: false // Debug mode disabled - MFA working correctly
  }
});

// Reassign to 'supabase' for use throughout the app
var supabase = supabaseClient;
