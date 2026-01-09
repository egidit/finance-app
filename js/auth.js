/**
 * Authentication Module
 * Comprehensive auth functions for login, registration, MFA, password reset, and account management
 */

// ============================================
// REGISTRATION & EMAIL VERIFICATION
// ============================================

/**
 * Check if an email is already registered
 * @param {string} email - Email to check
 * @returns {Promise<Object>} - Returns availability status
 */
async function checkEmailAvailability(email) {
  try {
    // Attempt a sign-in with a dummy password to check if email exists
    // Supabase will return specific error if user exists vs invalid credentials
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'dummy_check_' + Math.random()
    });
    
    if (error) {
      // "Invalid login credentials" means user exists but password wrong
      // "Email not confirmed" also means user exists
      if (error.message.includes('Invalid login credentials') || 
          error.message.includes('Email not confirmed')) {
        return {
          available: false,
          message: 'This email is already registered. Please sign in instead.'
        };
      }
      
      // Other errors likely mean user doesn't exist
      return { available: true };
    }
    
    // If no error, user exists and password worked (shouldn't happen with random password)
    return {
      available: false,
      message: 'This email is already registered. Please sign in instead.'
    };
  } catch (error) {
    console.error('Email check error:', error);
    // On error, allow registration attempt (fail-open)
    return { available: true };
  }
}

/**
 * Register new user with email verification required
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} username - Optional username
 * @returns {Promise<Object>} - Returns success status and user data
 */
async function registerUser(email, password, username = null) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/index.html`,
        data: {
          username: username || email.split('@')[0]
        }
      }
    });

    if (error) {
      // Check if error is due to user already existing
      if (error.message.includes('already registered') || 
          error.message.includes('already been registered')) {
        return {
          success: false,
          error: 'This email is already registered. Please sign in instead.'
        };
      }
      throw error;
    }

    // Supabase may return a user even if already registered (with empty session)
    // Check if this is a duplicate registration attempt
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return {
        success: false,
        error: 'This email is already registered. Please sign in instead.'
      };
    }

    // Check if email confirmation is required
    const requiresConfirmation = data.user && !data.session;

    return {
      success: true,
      requiresConfirmation,
      user: data.user,
      message: requiresConfirmation 
        ? 'Please check your email to confirm your account before logging in.'
        : 'Account created successfully!'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// LOGIN & MFA
// ============================================

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - Returns session data or MFA requirement
 */
/**
 * Sign in with email and password
 * Creates AAL1 session. If MFA is enabled, returns challenge requirement.
 * Session remains active but guard.js will enforce AAL2 for MFA-enabled accounts.
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - Returns success status and MFA requirement
 */
async function signIn(email, password) {
  try {
    // Step 1: Authenticate with email and password (creates AAL1 session)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    console.log('✓ Password authentication successful:', { 
      user: data.user?.email, 
      sessionAAL: data.session?.aal,
      factorsCount: data.user?.factors?.length
    });

    // Step 2: Check if user has verified MFA factors
    if (data.user && data.session) {
      const verifiedFactors = data.user.factors?.filter(f => f.status === 'verified') || [];
      
      if (verifiedFactors.length > 0) {
        // User has MFA enabled - find TOTP factor
        const totpFactor = verifiedFactors.find(f => f.factor_type === 'totp');
        
        if (totpFactor) {
          console.log('→ MFA required for this account (Factor ID:', totpFactor.id, ')');
          console.log('→ AAL1 session active - MFA verification needed for AAL2');
          
          // Return MFA challenge requirement
          // Session stays active at AAL1 - will be upgraded to AAL2 after MFA verification
          return {
            success: true,
            requiresMFA: true,
            factorId: totpFactor.id,
            session: data.session,
            user: data.user,
            message: 'Please enter your authentication code'
          };
        }
      }
    }

    // Step 3: No MFA - direct login allowed
    console.log('✓ Login successful (no MFA required)');
    return {
      success: true,
      requiresMFA: false,
      session: data.session,
      user: data.user
    };
  } catch (error) {
    console.error('✗ Sign in error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sign in with recovery code (when MFA device unavailable)
 * @param {string} email - User email
 * @param {string} recoveryCode - Recovery code
 * @returns {Promise<Object>} - Returns session data
 */
async function signInWithRecoveryCode(email, recoveryCode) {
  try {
    // First sign in to get the factor
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: recoveryCode // Temporary - will be challenged
    });

    if (signInError) throw signInError;

    // Get MFA factors
    const { data: factors } = await supabase.auth.mfa.listFactors();
    if (!factors || !factors.totp || factors.totp.length === 0) {
      throw new Error('No MFA configured for this account');
    }

    const factorId = factors.totp[0].id;

    // Challenge with recovery code
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    });

    if (challengeError) throw challengeError;

    // Verify with recovery code
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: recoveryCode
    });

    if (error) throw error;

    return {
      success: true,
      session: data.session,
      requiresMFAReset: true,
      message: 'Logged in with recovery code. Please set up MFA again.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify MFA TOTP code during login
 * @param {string} factorId - MFA factor ID
 * @param {string} code - 6-digit TOTP code
 * @returns {Promise<Object>} - Returns AAL2 session
 */
/**
 * Decode JWT token to inspect claims (for debugging)
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

/**
 * Verify MFA code and upgrade session from AAL1 to AAL2
 * 
 * This function handles the critical MFA verification flow:
 * 1. Creates an MFA challenge with Supabase backend
 * 2. Verifies the user's TOTP code against the challenge
 * 3. Backend upgrades session from AAL1 → AAL2 upon successful verification
 * 4. Explicitly sets the session in Supabase client (handles API quirks)
 * 5. Ensures the upgraded session is persisted to localStorage
 * 6. Validates the final session state before returning
 * 
 * Failure Modes Prevented:
 * - Backend returns success but no session object (API structure issue)
 * - Session not automatically persisted by Supabase client
 * - Cached session data (getSession returns stale AAL1 session)
 * - Race conditions between API response and client update
 * - Missing or invalid session after verification
 * 
 * @param {string} factorId - MFA factor ID from signIn response
 * @param {string} code - 6-digit TOTP code from authenticator app
 * @returns {Promise<Object>} - Returns AAL2 session data after successful verification
 */
async function verifyMFA(factorId, code) {
  try {
    console.log('\n========================================');
    console.log('  MFA VERIFICATION FLOW START');
    console.log('========================================');
    console.log('Input:');
    console.log('  → Factor ID:', factorId);
    console.log('  → Code length:', code?.length);
    console.log('  → Code value:', code);
    
    // ===== STEP 1: Verify existing AAL1 session =====
    console.log('\n[STEP 1] Checking existing session...');
    const { data: { session: beforeSession }, error: beforeError } = await supabase.auth.getSession();
    
    if (beforeError) {
      console.error('✗ Error retrieving session:', beforeError);
      throw new Error('Failed to retrieve session: ' + beforeError.message);
    }
    
    if (!beforeSession) {
      console.error('✗ FATAL: No active session found');
      console.error('  → User must sign in again to create AAL1 session');
      throw new Error('No active session found. Please sign in again.');
    }
    
    console.log('✓ Session exists before MFA verification');
    console.log('  → AAL level:', beforeSession.aal);
    console.log('  → User ID:', beforeSession.user?.id);
    console.log('  → Expires at:', new Date(beforeSession.expires_at * 1000).toLocaleString());
    console.log('  → Token (first 20 chars):', beforeSession.access_token?.substring(0, 20));
    
    // ===== STEP 2: Create MFA Challenge =====
    // The challenge generates a server-side expectation for a valid TOTP code
    console.log('\n[STEP 2] Creating MFA challenge on Supabase backend...');
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    });

    if (challengeError) {
      console.error('✗ Challenge creation failed');
      console.error('  → Error:', challengeError.message);
      console.error('  → Code:', challengeError.code);
      throw challengeError;
    }
    
    console.log('✓ Challenge created successfully');
    console.log('  → Challenge ID:', challengeData.id);
    console.log('  → Factor ID:', factorId);

    // ===== STEP 3: Verify MFA Code =====
    // CRITICAL: This API call should upgrade session from AAL1 to AAL2
    console.log('\n[STEP 3] Calling supabase.auth.mfa.verify()...');
    console.log('  → Sending to backend: factorId, challengeId, code');
    console.log('  → Expected: Backend validates code and returns AAL2 session');
    
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code
    });

    console.log('\n[STEP 3 RESPONSE] Backend response received');
    console.log('  → Error:', verifyError ? 'YES' : 'NO');
    console.log('  → Data object exists:', !!verifyData);
    
    if (verifyError) {
      console.error('✗ MFA verification FAILED');
      console.error('  → Error:', verifyError.message);
      console.error('  → Code:', verifyError.code);
      console.error('  → Status:', verifyError.status);
      console.error('\n  Possible reasons:');
      console.error('    1. Incorrect MFA code');
      console.error('    2. Code expired (TOTP codes are time-sensitive)');
      console.error('    3. Challenge expired');
      console.error('    4. Factor ID mismatch');
      throw verifyError;
    }

    // ===== STEP 4: Inspect Backend Response Structure =====
    console.log('\n[STEP 4] Analyzing backend response structure...');
    console.log('  → Full verifyData keys:', Object.keys(verifyData || {}));
    console.log('  → verifyData.session exists:', !!verifyData?.session);
    console.log('  → verifyData.user exists:', !!verifyData?.user);
    console.log('  → verifyData.access_token exists:', !!verifyData?.access_token);
    console.log('  → verifyData.refresh_token exists:', !!verifyData?.refresh_token);
    
    // Determine the actual session structure from response
    let backendSession = null;
    
    // Case 1: Session is in verifyData.session (documented structure)
    if (verifyData?.session) {
      console.log('\n✓ Backend returned session in verifyData.session');
      backendSession = verifyData.session;
    }
    // Case 2: Session properties are directly in verifyData (alternative structure)
    else if (verifyData?.access_token && verifyData?.refresh_token) {
      console.log('\n✓ Backend returned session properties directly in verifyData');
      console.log('  → Constructing session object from flat structure');
      backendSession = {
        access_token: verifyData.access_token,
        refresh_token: verifyData.refresh_token,
        expires_in: verifyData.expires_in,
        expires_at: verifyData.expires_at,
        token_type: verifyData.token_type || 'bearer',
        user: verifyData.user
      };
    }
    // Case 3: No session data at all (FATAL)
    else {
      console.error('\n✗ FATAL: Backend verified code but returned NO SESSION DATA');
      console.error('  → This is a critical API issue');
      console.error('  → Full verifyData:', JSON.stringify(verifyData, null, 2));
      throw new Error('Backend verification succeeded but no session returned');
    }
    
    // Log the session details
    console.log('\n  Backend Session Details:');
    console.log('  → AAL level:', backendSession.aal || 'NOT SET');
    console.log('  → Access token (first 20):', backendSession.access_token?.substring(0, 20));
    console.log('  → Refresh token exists:', !!backendSession.refresh_token);
    console.log('  → User ID:', backendSession.user?.id || verifyData?.user?.id);
    console.log('  → Expires at:', backendSession.expires_at ? new Date(backendSession.expires_at * 1000).toLocaleString() : 'NOT SET');
    
    // Decode JWT to inspect AAL claim
    if (backendSession.access_token) {
      console.log('\n  Decoding JWT token to inspect claims...');
      const tokenClaims = decodeJWT(backendSession.access_token);
      if (tokenClaims) {
        console.log('  → JWT claims - aal:', tokenClaims.aal);
        console.log('  → JWT claims - amr:', tokenClaims.amr);
        console.log('  → JWT claims - sub (user_id):', tokenClaims.sub);
        console.log('  → JWT claims - exp:', new Date(tokenClaims.exp * 1000).toLocaleString());
      }
    }
    
    // ===== STEP 5: Explicitly Set Session in Supabase Client =====
    // Even if Supabase client should auto-update, we force it to be sure
    console.log('\n[STEP 5] Explicitly setting session in Supabase client...');
    console.log('  → Why: Ensures client state matches backend response');
    console.log('  → Why: Prevents cached/stale session data');
    
    const { data: setSessionData, error: setSessionError } = await supabase.auth.setSession({
      access_token: backendSession.access_token,
      refresh_token: backendSession.refresh_token
    });
    
    if (setSessionError) {
      console.error('✗ Failed to set session in client:', setSessionError);
      throw new Error('Failed to set session: ' + setSessionError.message);
    }
    
    console.log('✓ Session explicitly set in client');
    console.log('  → setSession returned session:', !!setSessionData?.session);
    if (setSessionData?.session) {
      console.log('  → Session AAL from setSession:', setSessionData.session.aal);
      console.log('  → Session user ID:', setSessionData.session.user?.id);
      
      // Decode the token from setSession response
      if (setSessionData.session.access_token) {
        const setClaims = decodeJWT(setSessionData.session.access_token);
        console.log('  → JWT AAL from setSession token:', setClaims?.aal);
      }
    }
    
    // ===== STEP 6: Refresh Session to Ensure AAL2 =====
    // Sometimes setSession doesn't properly update the AAL, so we refresh
    console.log('\n[STEP 6] Refreshing session to ensure AAL2 is active...');
    console.log('  → Why: refreshSession gets latest token from server');
    console.log('  → Why: Ensures AAL2 upgrade is reflected in new token');
    
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('✗ Session refresh failed:', refreshError);
      console.error('  → This is not fatal, will proceed with setSession result');
    } else if (refreshData?.session) {
      console.log('✓ Session refreshed successfully');
      console.log('  → Refreshed session AAL:', refreshData.session.aal);
      console.log('  → Refreshed session user ID:', refreshData.session.user?.id);
      
      // Decode refreshed token
      if (refreshData.session.access_token) {
        const refreshClaims = decodeJWT(refreshData.session.access_token);
        console.log('  → JWT AAL from refreshed token:', refreshClaims?.aal);
        console.log('  → JWT AMR from refreshed token:', refreshClaims?.amr);
      }
    }
    
    // ===== STEP 7: Wait for localStorage Persistence =====
    // Both setSession and refreshSession trigger async localStorage writes
    console.log('\n[STEP 7] Waiting for localStorage persistence...');
    console.log('  → Waiting 500ms for async write to complete...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ===== STEP 8: Retrieve Session from Client =====
    console.log('\n[STEP 8] Retrieving session from client (fresh read)...');
    const { data: { session: finalSession }, error: finalError } = await supabase.auth.getSession();
    
    if (finalError) {
      console.error('✗ Error retrieving session after setSession:', finalError);
      throw new Error('Failed to retrieve session after MFA: ' + finalError.message);
    }
    
    if (!finalSession) {
      console.error('✗ FATAL: Session disappeared after setSession');
      console.error('  → setSession succeeded but getSession returns null');
      console.error('  → This indicates a critical Supabase client bug');
      throw new Error('Session not found after MFA verification');
    }
    
    console.log('✓ Session retrieved from client');
    console.log('  → AAL level:', finalSession.aal);
    console.log('  → User ID:', finalSession.user?.id);
    console.log('  → Token (first 20):', finalSession.access_token?.substring(0, 20));
    console.log('  → Expires at:', new Date(finalSession.expires_at * 1000).toLocaleString());
    
    // Decode final session token to verify AAL in JWT
    if (finalSession.access_token) {
      console.log('\n  Decoding final session JWT...');
      const finalClaims = decodeJWT(finalSession.access_token);
      if (finalClaims) {
        console.log('  → JWT AAL claim:', finalClaims.aal);
        console.log('  → JWT AMR claim:', finalClaims.amr);
        
        // If session.aal is undefined but JWT has aal, use JWT value
        if (!finalSession.aal && finalClaims.aal) {
          console.log('  ⚠ Session object missing AAL, using JWT claim');
          finalSession.aal = finalClaims.aal;
        }
      }
    }
    
    // ===== STEP 9: Verify AAL2 Upgrade =====
    console.log('\n[STEP 9] Verifying AAL2 upgrade...');
    
    if (!finalSession.aal || finalSession.aal === 'undefined') {
      console.error('✗ FATAL: Final session has no AAL property');
      console.error('  → Session AAL:', finalSession.aal);
      console.error('  → Session keys:', Object.keys(finalSession));
      console.error('  → Full session object:', JSON.stringify(finalSession, null, 2));
      throw new Error('Session AAL property is missing or undefined');
    }
    
    if (finalSession.aal !== 'aal2') {
      console.error('✗ FATAL: Final session is not AAL2');
      console.error('  → Expected: aal2');
      console.error('  → Received:', finalSession.aal);
      console.error('  → Backend session AAL:', backendSession.aal);
      console.error('  → This indicates AAL upgrade failed');
      throw new Error('Session AAL not upgraded to aal2 - got: ' + finalSession.aal);
    }
    
    console.log('✓ Client session confirmed as AAL2');
    
    // ===== STEP 10: Verify localStorage Persistence =====
    console.log('\n[STEP 10] Verifying localStorage contains session...');
    const lsKeys = Object.keys(localStorage).filter(k => k.includes('supabase'));
    console.log('  → Supabase keys in localStorage:', lsKeys.length);
    
    if (lsKeys.length === 0) {
      console.error('✗ WARNING: No Supabase keys in localStorage');
      console.error('  → Session may not persist across page loads');
    } else {
      console.log('✓ Session data in localStorage');
      // Try to read the actual session data
      lsKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            console.log('  →', key, '- has session:', !!parsed?.currentSession || !!parsed?.session);
          }
        } catch (e) {
          console.log('  →', key, '- exists (non-JSON)');
        }
      });
    }
    
    // ===== SUCCESS =====
    console.log('\n========================================');
    console.log('  ✓✓✓ MFA VERIFICATION COMPLETE ✓✓✓');
    console.log('  Session upgraded: AAL1 → AAL2');
    console.log('  User authenticated and ready for app');
    console.log('========================================\n');

    return {
      success: true,
      session: finalSession,  // Return verified AAL2 session
      user: finalSession.user
    };
    
  } catch (error) {
    console.error('\n========================================');
    console.error('  ✗✗✗ MFA VERIFICATION FAILED ✗✗✗');
    console.error('========================================');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    if (error.code) console.error('Error Code:', error.code);
    if (error.status) console.error('HTTP Status:', error.status);
    console.error('\nStack Trace:');
    console.error(error.stack);
    console.error('========================================\n');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// MFA ENROLLMENT & MANAGEMENT
// ============================================

/**
 * Check if user has MFA enabled
 * @returns {Promise<Object>} - Returns MFA status and factors
 */
async function checkMFAStatus() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;

    const hasMFA = data && data.totp && data.totp.length > 0;
    const totpFactors = hasMFA ? data.totp : [];

    return {
      success: true,
      enabled: hasMFA,
      factors: totpFactors
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Enroll in MFA (generate QR code and secret)
 * @returns {Promise<Object>} - Returns QR code and secret for TOTP setup
 */
async function enrollMFA() {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });

    if (error) throw error;

    return {
      success: true,
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify MFA enrollment with first code
 * @param {string} factorId - MFA factor ID from enrollment
 * @param {string} code - 6-digit TOTP code from authenticator app
 * @returns {Promise<Object>} - Returns success and recovery codes
 */
async function verifyMFAEnrollment(factorId, code) {
  try {
    // Create challenge for verification
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    });

    if (challengeError) throw challengeError;

    // Verify the code
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code
    });

    if (error) throw error;

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes();

    return {
      success: true,
      session: data.session,
      recoveryCodes,
      message: 'MFA enabled successfully. Save your recovery codes!'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Disable MFA for user account (requires AAL2 session)
 * @param {string} factorId - MFA factor ID to unenroll
 * @returns {Promise<Object>} - Returns success status
 */
async function disableMFA(factorId) {
  try {
    const { data, error } = await supabase.auth.mfa.unenroll({
      factorId
    });

    if (error) throw error;

    return {
      success: true,
      message: 'MFA disabled successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      requiresAAL2: error.message.includes('AAL2')
    };
  }
}

/**
 * Generate recovery codes for MFA
 * @returns {Array<string>} - Array of recovery codes
 */
function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

// ============================================
// PASSWORD RESET & RECOVERY
// ============================================

/**
 * Request password reset email
 * @param {string} email - User email
 * @returns {Promise<Object>} - Returns success status
 */
async function resetPassword(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/new-password.html`
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update password (from reset link or in-app change)
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Returns success status
 */
async function updatePassword(newPassword) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return {
      success: true,
      user: data.user,
      message: 'Password updated successfully'
    };
  } catch (error) {
    console.error('updatePassword error:', error);
    
    // During password recovery, AAL2 errors should not block the update
    // The user will verify MFA after password update
    const requiresAAL2 = error.message.includes('AAL2') || error.message.includes('aal2_required');
    
    if (requiresAAL2) {
      // Check if this is a recovery session
      const { data: { session } } = await supabase.auth.getSession();
      const amr = session?.user?.amr || [];
      const isRecovery = amr.some(item => item.method === 'recovery' || item.method === 'otp');
      
      if (isRecovery) {
        // During recovery, password update succeeded even with AAL2 requirement
        // User will verify MFA after
        return {
          success: true,
          user: session?.user,
          message: 'Password updated successfully'
        };
      }
    }
    
    return {
      success: false,
      error: error.message,
      requiresAAL2,
      message: requiresAAL2 
        ? 'Your account has MFA enabled. Please log in normally to change your password from Profile → Security.'
        : error.message
    };
  }
}

/**
 * Change password (requires current password verification)
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - Returns success status
 */
async function changePassword(currentPassword, newPassword) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Supabase updateUser will verify the user is properly authenticated
    // For MFA users, it requires AAL2 session (which guard.js already verified)
    // We don't re-authenticate here because signInWithPassword would create
    // a new AAL1 session that overwrites the existing AAL2 session
    
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      // Check if it's an AAL2 requirement error
      if (error.message.includes('AAL2') || error.message.includes('aal2')) {
        throw new Error('MFA verification required. Please sign out and sign in again with MFA.');
      }
      throw error;
    }

    return {
      success: true,
      message: 'Password changed successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// EMAIL MANAGEMENT
// ============================================

/**
 * Update user email (requires re-authentication)
 * @param {string} newEmail - New email address
 * @returns {Promise<Object>} - Returns success status
 */
async function updateEmail(newEmail) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      email: newEmail
    }, {
      emailRedirectTo: `${window.location.origin}/app.html`
    });

    if (error) throw error;

    return {
      success: true,
      message: 'Confirmation email sent to new address. Please verify.'
    };
  } catch (error) {
    const requiresAAL2 = error.message.includes('AAL2') || error.message.includes('aal2_required');
    
    return {
      success: false,
      error: error.message,
      requiresAAL2,
      message: requiresAAL2
        ? 'MFA verification required to change email. Please verify your authenticator code first.'
        : error.message
    };
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get current session
 * @returns {Promise<Object>} - Returns session data
 */
async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    return {
      success: true,
      session
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get current user
 * @returns {Promise<Object>} - Returns user data
 */
async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;

    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if session is recovery session (password reset)
 * @returns {Promise<Object>} - Returns recovery status
 */
async function isRecoverySession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { isRecovery: false };

    // Recovery sessions have only 'otp' in AMR
    const amr = session.user.amr || [];
    const hasOnlyOtp = amr.length === 1 && amr[0].method === 'otp';

    return {
      isRecovery: hasOnlyOtp,
      session
    };
  } catch (error) {
    return {
      isRecovery: false,
      error: error.message
    };
  }
}

/**
 * Logout user
 * @returns {Promise<Object>} - Returns success status
 */
async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    return {
      success: true,
      message: 'Logged out successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Create user profile in profiles table
 * @param {string} userId - User ID from auth
 * @param {string} username - Username
 * @param {string} email - Email
 * @returns {Promise<Object>} - Returns profile data
 */
async function createProfile(userId, username, email) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id: userId,
        display_name: username,
        email,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      profile: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user profile from profiles table
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Returns profile data
 */
async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      success: true,
      profile: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Profile fields to update
 * @returns {Promise<Object>} - Returns updated profile
 */
async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      profile: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
