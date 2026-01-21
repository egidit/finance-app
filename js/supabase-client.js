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

// Redirect to login if not authenticated
async function requireAuth(clientParam) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
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
