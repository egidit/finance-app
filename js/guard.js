/**
 * Route Guard - Protects app.html from unauthorized access
 * Redirects to login if no session, handles recovery sessions
 */

(async function() {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      window.location.href = 'index.html';
      return;
    }
    
    // If no session exists, redirect to login
    if (!session) {
      window.location.href = 'index.html';
      return;
    }
    
    // Check if this is a recovery session (password reset)
    // Recovery sessions have only 'otp' in AMR, normal logins have 'password'
    if (session.user.amr && Array.isArray(session.user.amr)) {
      const hasOnlyOtp = session.user.amr.length === 1 && session.user.amr[0].method === 'otp';
      
      if (hasOnlyOtp) {
        // Recovery session detected - redirect to password reset page
        console.log('Recovery session detected - redirecting to reset-password.html');
        window.location.href = 'reset-password.html';
        return;
      }
    }
    
    // Valid session - user can access the app
    console.log('Valid session - access granted');
    
  } catch (err) {
    console.error('Guard error:', err);
    window.location.href = 'index.html';
  }
})();
})();
