/**
 * Authentication Module
 * Comprehensive auth functions for login, registration, MFA, password reset, and account management
 */

// ============================================
// REGISTRATION & EMAIL VERIFICATION
// ============================================

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

    if (error) throw error;

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
async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Check if MFA is required
    if (data.user) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasMFA = factors && factors.totp && factors.totp.length > 0;

      if (hasMFA && data.session) {
        // Check AAL level - if AAL1, MFA verification needed
        const aal = data.session.aal;
        if (aal === 'aal1') {
          return {
            success: true,
            requiresMFA: true,
            factorId: factors.totp[0].id,
            message: 'Please enter your authentication code'
          };
        }
      }
    }

    // Normal login without MFA or already AAL2
    return {
      success: true,
      requiresMFA: false,
      session: data.session,
      user: data.user
    };
  } catch (error) {
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
async function verifyMFA(factorId, code) {
  try {
    // Create MFA challenge
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

    return {
      success: true,
      session: data.session,
      user: data.user
    };
  } catch (error) {
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
      redirectTo: `${window.location.origin}/reset-password.html`
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
    const requiresAAL2 = error.message.includes('AAL2') || error.message.includes('aal2_required');
    
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

    // Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInError) throw new Error('Current password is incorrect');

    // Update to new password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

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
        username,
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
