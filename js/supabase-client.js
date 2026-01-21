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
  
  if (verifiedFactors.length > 0 && session.aal === 'aal1') {
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
