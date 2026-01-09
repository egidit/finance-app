/**
 * Login Page Script
 * Handles user login with MFA and recovery code support
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const loginFields = document.getElementById('loginFields');
  const mfaSection = document.getElementById('mfaSection');
  const mfaForm = document.getElementById('mfaForm');
  const recoverySection = document.getElementById('recoverySection');
  const recoveryForm = document.getElementById('recoveryForm');

  // MFA state - stores factor ID when MFA challenge is required
  let pendingFactorId = null;

  // Check for recovery link in URL
  checkForRecoveryLink();

  // Handle password toggle buttons
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

  // Handle login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      // Clear previous messages
      hideError();
      hideSuccess();

      // Disable submit button
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        // Attempt sign in
        const result = await signIn(email, password);

        if (result.success) {
          if (result.requiresMFA) {
            // MFA verification required
            // Session is active at AAL1 - need MFA to upgrade to AAL2
            console.log('→ Showing MFA input (session active at AAL1)');
            pendingFactorId = result.factorId;
            showMFASection();
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          } else {
            // No MFA required - redirect to app
            console.log('→ Redirecting to app (no MFA required)');
            window.location.href = 'app.html';
          }
        } else {
          showError(result.error);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (error) {
        showError('An unexpected error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Handle MFA form submission
  if (mfaForm) {
    mfaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('mfaCode').value.trim();

      if (!code || code.length !== 6) {
        showError('Please enter a valid 6-digit code');
        return;
      }

      hideError();

      const submitBtn = mfaForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        console.log('\n========================================');
        console.log('  SUBMITTING MFA CODE FOR VERIFICATION');
        console.log('========================================\n');
        
        // ===== Call verifyMFA - handles all backend verification and session upgrade =====
        // verifyMFA already:
        // 1. Creates MFA challenge
        // 2. Verifies TOTP code
        // 3. Gets backend response with AAL2 session
        // 4. Handles multiple response structures
        // 5. Decodes JWT tokens to extract AAL
        // 6. Calls setSession() and refreshSession()
        // 7. Validates session is AAL2
        // 8. Ensures localStorage persistence
        // So we can trust its result without re-checking
        console.log('[LOGIN PAGE] Calling verifyMFA()...');
        const result = await verifyMFA(pendingFactorId, code);

        if (result.success) {
          console.log('\n========================================');
          console.log('  ✓✓✓ verifyMFA() SUCCESSFUL ✓✓✓');
          console.log('========================================');
          console.log('Result summary:');
          console.log('  → Success:', result.success);
          console.log('  → Session exists:', !!result.session);
          console.log('  → Session AAL:', result.session?.aal);
          console.log('  → User ID:', result.user?.id);
          console.log('  → User email:', result.user?.email);
          
          // ===== Basic Validation - verifyMFA should guarantee these =====
          if (!result.session) {
            console.error('\n✗ FATAL: verifyMFA returned success but no session');
            console.error('  → This should never happen - indicates bug in verifyMFA');
            showError('Session error after MFA. Please try logging in again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
          }
          
          if (result.session.aal !== 'aal2') {
            console.error('\n✗ FATAL: verifyMFA returned non-AAL2 session');
            console.error('  → Expected: aal2');
            console.error('  → Received:', result.session.aal);
            console.error('  → This should never happen - verifyMFA should validate this');
            showError('MFA verification incomplete. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
          }
          
          console.log('\n✓ Session validated (AAL2 confirmed)');
          
          // ===== Final Pre-Redirect Wait =====
          // Give browser one last moment to complete any pending storage operations
          console.log('\n→ Final 200ms wait before redirect...');
          await new Promise(resolve => setTimeout(resolve, 200));
          
          console.log('\n========================================');
          console.log('  ✓✓✓ AUTHENTICATION COMPLETE ✓✓✓');
          console.log('  User:', result.user?.email);
          console.log('  Session AAL: aal2');
          console.log('  Redirecting to app.html...');
          console.log('========================================\n');
          
          window.location.href = 'app.html';
        } else {
          showError(result.error || 'Invalid code. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (error) {
        showError('An unexpected error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Handle "Use recovery code" link
  const useRecoveryLink = document.getElementById('useRecoveryCode');
  if (useRecoveryLink) {
    useRecoveryLink.addEventListener('click', (e) => {
      e.preventDefault();
      showRecoverySection();
    });
  }

  // Handle "Back to MFA code" link
  const backToMFALink = document.getElementById('backToMFA');
  if (backToMFALink) {
    backToMFALink.addEventListener('click', (e) => {
      e.preventDefault();
      showMFASection();
    });
  }

  // Handle recovery form submission
  if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const recoveryCode = document.getElementById('recoveryCode').value.trim();

      if (!recoveryCode) {
        showError('Please enter a recovery code');
        return;
      }

      hideError();

      const submitBtn = recoveryForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const result = await signInWithRecoveryCode(userEmail, recoveryCode);

        if (result.success) {
          if (result.requiresMFAReset) {
            showSuccess('Logged in successfully. Please set up MFA again.');
            setTimeout(() => {
              window.location.href = 'app.html';
            }, 2000);
          } else {
            window.location.href = 'app.html';
          }
        } else {
          showError(result.error || 'Invalid recovery code.');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      } catch (error) {
        showError('An unexpected error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Helper functions
  function showMFASection() {
    if (loginFields) loginFields.style.display = 'none';
    if (mfaSection) {
      mfaSection.style.display = 'block';
      document.getElementById('mfaCode')?.focus();
    }
    if (recoverySection) recoverySection.style.display = 'none';
  }

  function showRecoverySection() {
    if (mfaSection) mfaSection.style.display = 'none';
    if (recoverySection) {
      recoverySection.style.display = 'block';
      document.getElementById('recoveryCode')?.focus();
    }
  }

  function showError(message) {
    if (errorMessage) {
      errorMessage.querySelector('p').textContent = message;
      errorMessage.classList.remove('hidden');
      errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideError() {
    if (errorMessage) {
      errorMessage.classList.add('hidden');
    }
  }

  function showSuccess(message) {
    if (successMessage) {
      successMessage.querySelector('p').textContent = message;
      successMessage.classList.remove('hidden');
      successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideSuccess() {
    if (successMessage) {
      successMessage.classList.add('hidden');
    }
  }

  async function checkForRecoveryLink() {
    // Check URL hash for recovery token
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      // Redirect to reset password page
      window.location.href = 'reset-password.html' + hash;
    }
  }
});
