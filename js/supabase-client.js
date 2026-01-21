// ============================================================================
// Supabase Client Setup
// ============================================================================
// Browser-side Supabase client for authentication and database operations
// ============================================================================

let supabaseClient = null;

// Initialize Supabase client
function initSupabase() {
  if (!window.supabase) {
    console.error('Supabase library not loaded. Include the CDN script.');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    );
  }

  return supabaseClient;
}

// Get current session
async function getSession() {
  const client = initSupabase();
  if (!client) return null;

  const { data: { session }, error } = await client.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return session;
}

// Get current user
async function getCurrentUser(clientParam) {
  const client = clientParam || initSupabase();
  if (!client) return null;

  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    console.error('Error getting user:', error);
    return null;
  }

  return user;
}

// Check if user is authenticated
async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

// Require authentication - throws if not authenticated or MFA not completed
async function requireAuth(clientParam) {
  const client = clientParam || initSupabase();
  if (!client) {
    throw new Error('Supabase client not initialized');
  }
  
  // First try to get current session
  let { data: { session }, error } = await client.auth.getSession();
  
  if (error) {
    throw error;
  }
  
  // If no session, try refreshing in case the session is in storage but not loaded
  if (!session) {
    const refreshResult = await client.auth.refreshSession();
    session = refreshResult.data?.session;
    error = refreshResult.error;
    
    if (error && error.message !== 'Auth session missing!') {
      throw error;
    }
  }
  
  if (!session) {
    throw new Error('Not authenticated');
  }
  
  // Check if MFA is required but not completed
  const { data: factors } = await client.auth.mfa.listFactors();
  const verifiedFactors = factors?.totp?.filter(f => f.status === 'verified') || [];
  
  // Get AAL from JWT claims since session.aal may be undefined
  let currentAAL = session.aal;
  if (!currentAAL && session.access_token) {
    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      currentAAL = payload.aal;
    } catch (e) {
      console.error('Failed to decode JWT:', e);
    }
  }
  
  if (verifiedFactors.length > 0 && currentAAL === 'aal1') {
    // User has MFA enabled but hasn't completed verification
    // Redirect to login with MFA flag to show MFA form immediately
    window.location.replace('login.html?mfa_required=1');
    // Return a promise that never resolves to halt further execution
    return new Promise(() => {});
  }
  
  return session;
}

// Sign out
async function signOut(clientParam) {
  const client = clientParam || initSupabase();
  if (!client) return;

  // Clear preferences cache
  clearPreferencesCache();

  const { error } = await client.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
  } else {
    window.location.href = 'index.html';
  }
}

// Listen for auth state changes
function onAuthStateChange(callback) {
  const client = initSupabase();
  if (!client) return () => {};

  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => subscription.unsubscribe();
}

// ============================================================================
// User Preferences
// ============================================================================
// Cache for user preferences to avoid repeated database calls
let userPreferencesCache = null;

// Load user preferences from database
async function loadUserPreferences(clientParam) {
  const client = clientParam || initSupabase();
  if (!client) return null;

  // Return cached preferences if available
  if (userPreferencesCache) {
    return userPreferencesCache;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (first time user)
    console.error('Error loading preferences:', error);
    return null;
  }

  // If no preferences exist, create default ones
  if (!data) {
    const defaults = {
      user_id: user.id,
      theme_mode: 'system',
      layout_mode: 'auto',
      default_currency: 'EUR',
      notify_before_end: true,
      notify_days_before: 7
    };

    const { data: newPrefs, error: insertError } = await client
      .from('user_preferences')
      .insert(defaults)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating preferences:', insertError);
      return defaults; // Return defaults even if insert fails
    }

    userPreferencesCache = newPrefs;
    return newPrefs;
  }

  userPreferencesCache = data;
  return data;
}

// Update user preferences in database
async function updateUserPreferences(updates, clientParam) {
  const client = clientParam || initSupabase();
  if (!client) return null;

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from('user_preferences')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating preferences:', error);
    return null;
  }

  // Update cache
  userPreferencesCache = data;
  return data;
}

// Get default currency (from cache, localStorage fallback, or default)
async function getDefaultCurrency(clientParam) {
  const prefs = await loadUserPreferences(clientParam);
  return prefs?.default_currency || localStorage.getItem('defaultCurrency') || 'EUR';
}

// Clear preferences cache (call on sign out)
function clearPreferencesCache() {
  userPreferencesCache = null;
}
