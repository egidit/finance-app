// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loadingState = document.getElementById('loadingState');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const cancelResetBtn = document.getElementById('cancelResetBtn');

// Check if user is already logged in
(async function checkExistingSession() {
  // FIRST: Check if this is a password reset flow - check URL hash
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  
  if (type === 'recovery' && accessToken) {
    // This is a password reset link - redirect to reset page
    window.location.replace('reset-password.html' + window.location.hash);
    return;
  }
  
  // Otherwise check for existing session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    // Check if this is a recovery session (has ONLY 'otp' method)
    // Normal MFA logins have 'password' + 'totp', recovery has only 'otp'
    if (session.user.amr && Array.isArray(session.user.amr)) {
      const hasOnlyOtp = session.user.amr.length === 1 && session.user.amr[0].method === 'otp';
      
      if (hasOnlyOtp) {
        // Recovery session detected - redirect to reset page
        console.log('Recovery session detected - redirecting to password reset');
        window.location.href = 'reset-password.html';
        return;
      }
    }
    
    // Valid regular login session - clear stale flags and redirect to app
    sessionStorage.removeItem('passwordResetInProgress');
    sessionStorage.removeItem('passwordResetTimestamp');
    sessionStorage.removeItem('recoveryAccessToken');
    sessionStorage.removeItem('recoveryRefreshToken');
    window.location.href = 'app.html';
  }
})();

// Show error message
function showError(message) {
  errorMessage.querySelector('p').textContent = message;
  errorMessage.classList.remove('hidden');
  successMessage.classList.add('hidden');
  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Show success message
function showSuccess(message) {
  successMessage.querySelector('p').textContent = message;
  successMessage.classList.remove('hidden');
  errorMessage.classList.add('hidden');
  setTimeout(() => {
    successMessage.classList.add('hidden');
  }, 5000);
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Validate inputs
  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  // Show loading state
  loginForm.classList.add('hidden');
  loadingState.classList.remove('hidden');

  try {
    // Login attempt
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    
    // Check if user has MFA enabled
    const { data: { user } } = await supabase.auth.getUser();
    const verifiedFactors = user?.factors?.filter(f => f.status === 'verified') || [];
    
    if (verifiedFactors.length > 0) {
      // MFA is enabled - show MFA form
      console.log('MFA enabled, prompting for verification');
      loadingState.classList.add('hidden');
      document.getElementById('mfaSection').style.display = 'block';
      document.getElementById('mfaCode').focus();
    } else {
      // No MFA - redirect to app
      showSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = 'app.html';
      }, 1000);
    }
    
  } catch (error) {
    loginForm.classList.remove('hidden');
    loadingState.classList.add('hidden');
    showError(error.message || 'Login failed. Please check your credentials.');
  }
});

// Show forgot password modal
forgotPasswordBtn.addEventListener('click', () => {
  forgotPasswordModal.classList.remove('hidden');
});

// Hide forgot password modal
cancelResetBtn.addEventListener('click', () => {
  forgotPasswordModal.classList.add('hidden');
  forgotPasswordForm.reset();
});

// Handle password reset
forgotPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const resetEmail = document.getElementById('resetEmail').value.trim();

  if (!resetEmail) {
    showError('Please enter your email address');
    return;
  }

  const result = await resetPassword(resetEmail);

  if (result.success) {
    forgotPasswordModal.classList.add('hidden');
    forgotPasswordForm.reset();
    showSuccess('Password reset email sent! Check your inbox.');
  } else {
    showError(result.error || 'Failed to send reset email');
  }
});

// Close modal on outside click (with proper text selection handling)
let mouseDownOnOverlay = false;

forgotPasswordModal.addEventListener('mousedown', (e) => {
  if (e.target === forgotPasswordModal) {
    mouseDownOnOverlay = true;
  }
});

forgotPasswordModal.addEventListener('mouseup', (e) => {
  if (e.target === forgotPasswordModal && mouseDownOnOverlay) {
    forgotPasswordModal.classList.add('hidden');
    forgotPasswordForm.reset();
  }
  mouseDownOnOverlay = false;
});

forgotPasswordModal.addEventListener('mouseleave', () => {
  mouseDownOnOverlay = false;
});

// Handle MFA verification
const mfaForm = document.getElementById('mfaForm');
mfaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const mfaCode = document.getElementById('mfaCode').value.trim();
  
  if (!mfaCode || mfaCode.length !== 6) {
    showError('Please enter a valid 6-digit code');
    return;
  }
  
  try {
    // Get current session for auth header
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Session expired. Please log in again.');
    }

    // Call Edge Function with rate limiting
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/verify-mfa-login`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mfaCode })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'MFA verification failed');
    }

    // Success - session is now upgraded to AAL2
    showSuccess('MFA verified! Redirecting...');
    setTimeout(() => {
      window.location.href = 'app.html';
    }, 1000);
    
  } catch (error) {
    showError(error.message || 'Invalid code. Please try again.');
    document.getElementById('mfaCode').value = '';
    document.getElementById('mfaCode').focus();
  }
});

// Password visibility toggle functionality
document.querySelectorAll('.password-toggle-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const targetId = this.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const eyeIcon = this.querySelector('.eye-icon');
    const eyeSlashIcon = this.querySelector('.eye-slash-icon');
    
    if (input.type === 'password') {
      input.type = 'text';
      eyeIcon.classList.add('hidden');
      eyeSlashIcon.classList.remove('hidden');
    } else {
      input.type = 'password';
      eyeIcon.classList.remove('hidden');
      eyeSlashIcon.classList.add('hidden');
    }
  });
});
