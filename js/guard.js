/**
 * Route Guard - Protects app.html from unauthorized access
 * 
 * Authentication Flow:
 * 1. User signs in with email/password → Creates AAL1 (Authentication Assurance Level 1) session
 * 2. If MFA is enabled → User must verify MFA code → Session upgraded to AAL2
 * 3. This guard checks:
 *    - Session exists (user is logged in)
 *    - If MFA is enabled for user, session MUST be AAL2
 *    - If MFA is not enabled, AAL1 is sufficient
 * 
 * Session Storage:
 * - Supabase automatically stores session in browser localStorage
 * - Session persists across page loads
 * - Session includes AAL level which indicates MFA completion
 */

/**
 * Decode JWT token to inspect claims
 * @param {string} token - JWT access token
 * @returns {Object} - Decoded token payload
 */
function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

(async function() {
  try {
    console.log('\n=====================================');
    console.log('   GUARD: Authentication Check');
    console.log('   Page: app.html');
    console.log('   Time:', new Date().toLocaleTimeString());
    console.log('=====================================\n');
    
    // Step 1: Check localStorage for Supabase session (debugging)
    const lsKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
    console.log('→ LocalStorage check:');
    console.log('  → Supabase keys found:', lsKeys.length);
    if (lsKeys.length > 0) {
      console.log('  → Keys:', lsKeys);
    }
    
    // Step 2: Get session from Supabase client (reads from localStorage)
    console.log('\n→ Retrieving session from Supabase client...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('✗ Session retrieval error:', sessionError);
      console.error('→ Redirecting to login (error state)\n');
      window.location.href = 'index.html';
      return;
    }
    
    // Step 3: Check if session exists
    if (!session) {
      console.log('✗ No session found in Supabase client');
      console.log('→ User is not logged in');
      console.log('→ Redirecting to login...\n');
      window.location.href = 'index.html';
      return;
    }
    
    console.log('✓ Session found');
    console.log('  → AAL:', session.aal);
    console.log('  → User ID:', session.user?.id);
    console.log('  → Expires:', new Date(session.expires_at * 1000).toLocaleString());
    console.log('  → Session ID:', session.access_token?.substring(0, 20) + '...');
    
    // Step 3.5: Extract AAL from JWT if session.aal is undefined
    // This matches the logic in verifyMFA to handle Supabase client quirks
    if (!session.aal && session.access_token) {
      console.log('\n⚠ Session AAL is undefined, decoding JWT token...');
      const tokenClaims = decodeJWT(session.access_token);
      if (tokenClaims && tokenClaims.aal) {
        console.log('  → JWT AAL claim found:', tokenClaims.aal);
        console.log('  → JWT AMR claim:', tokenClaims.amr);
        console.log('  → Assigning JWT AAL to session object');
        session.aal = tokenClaims.aal;
      } else {
        console.error('  ✗ Could not extract AAL from JWT token');
      }
    }
    
    // Step 4: Check for recovery session (password reset flow)
    console.log('\n→ Checking session type...');
    if (session.user.amr && Array.isArray(session.user.amr)) {
      const hasOnlyOtp = session.user.amr.length === 1 && session.user.amr[0].method === 'otp';
      
      if (hasOnlyOtp) {
        console.log('✓ Recovery session detected (password reset)');
        console.log('→ Redirecting to reset-password.html...\n');
        window.location.href = 'reset-password.html';
        return;
      }
    }
    console.log('✓ Normal login session (not recovery)');
    
    // Step 5: Get user data and check MFA status
    console.log('\n→ Checking MFA status...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('✗ User retrieval error:', userError);
      console.error('→ Redirecting to login (user error)\n');
      await supabase.auth.signOut();
      window.location.href = 'index.html';
      return;
    }
    
    const verifiedFactors = user?.factors?.filter(f => f.status === 'verified') || [];
    const hasMFAEnabled = verifiedFactors.length > 0;
    
    console.log('  → User email:', user?.email);
    console.log('  → Verified MFA factors:', verifiedFactors.length);
    if (verifiedFactors.length > 0) {
      console.log('  → Factor types:', verifiedFactors.map(f => f.factor_type).join(', '));
    }
    
    // Step 6: Enforce AAL2 for MFA-enabled accounts
    if (hasMFAEnabled) {
      console.log('\n→ MFA is enabled for this account');
      console.log('  → Required AAL: aal2');
      console.log('  → Current AAL:', session.aal);
      
      // Check if AAL is still undefined after JWT extraction attempt
      if (!session.aal) {
        console.error('\n✗✗✗ AUTHENTICATION FAILED ✗✗✗');
        console.error('✗ Session AAL is undefined (even after JWT decoding)');
        console.error('✗ Cannot verify MFA completion');
        console.error('\n→ Session details:');
        console.error('  → access_token exists:', !!session.access_token);
        console.error('  → Session keys:', Object.keys(session));
        console.error('\n→ Signing out and redirecting to login...\n');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
      }
      
      if (session.aal === 'aal2') {
        console.log('✓ AAL2 session confirmed');
        console.log('✓ MFA verification complete');
      } else {
        console.error('\n✗✗✗ AUTHENTICATION FAILED ✗✗✗');
        console.error('✗ MFA is enabled but session AAL is:', session.aal);
        console.error('✗ Expected: aal2');
        console.error('✗ This means MFA was not properly verified');
        console.error('\n→ Possible causes:');
        console.error('  1. User bypassed MFA verification');
        console.error('  2. Session was not upgraded to AAL2 after MFA');
        console.error('  3. Session was downgraded after MFA verification');
        console.error('\n→ Signing out and redirecting to login...\n');
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
      }
    } else {
      console.log('\n→ No MFA enabled for this account');
      console.log('  → AAL1 session is sufficient');
    }
    
    // Step 7: All checks passed
    console.log('\n=====================================');
    console.log('   ✓✓✓ AUTHENTICATION PASSED ✓✓✓');
    console.log('   Access Granted to app.html');
    console.log('=====================================\n');
    
  } catch (err) {
    console.error('\n✗✗✗ GUARD ERROR ✗✗✗');
    console.error('✗ Unexpected error:', err);
    console.error('✗ Stack:', err.stack);
    console.error('→ Redirecting to login (safety fallback)\n');
    window.location.href = 'index.html';
  }
})();
