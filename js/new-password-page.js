/**
 * New Password Page Script
 * Handles setting new password from reset link with MFA verification if needed
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize password strength visualizer
  initPasswordStrengthVisualizer('newPassword');

  const passwordForm = document.getElementById('newPasswordForm');
  const mfaForm = document.getElementById('mfaForm');
  const recoveryForm = document.getElementById('recoveryForm');
  
  const passwordSection = document.getElementById('passwordSection');
  const mfaSection = document.getElementById('mfaSection');
  const recoverySection = document.getElementById('recoverySection');
  
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  
  const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');
  const backToMfaBtn = document.getElementById('backToMfaBtn');

  let userEmail = null;
  let passwordUpdated = false;

  // Wait for Supabase to process recovery token from URL
  // The auth state change listener will catch when the session is established
  let sessionEstablished = false;
  
  const unsubscribe = supabase.auth.onAuthStateChange(async (event, session) => {
    if (sessionEstablished) return;
    
    console.log('Auth event:', event, 'Session:', session);
    
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      sessionEstablished = true;
      userEmail = session?.user?.email;
      showPasswordSection();
      unsubscribe.data.subscription.unsubscribe();
    } else if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      showError('Invalid or expired reset link. Please request a new one.');
      setTimeout(() => {
        window.location.href = 'reset-password.html';
      }, 3000);
      unsubscribe.data.subscription.unsubscribe();
    }
  });
  
  // Also check immediately in case session already exists
  setTimeout(async () => {
    if (!sessionEstablished) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sessionEstablished = true;
        userEmail = session.user?.email;
        showPasswordSection();
        unsubscribe.data.subscription.unsubscribe();
      } else {
        showError('Invalid or expired reset link. Please request a new one.');
        setTimeout(() => {
          window.location.href = 'reset-password.html';
        }, 3000);
      }
    }
  }, 1000);

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

  // Handle new password form submission
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (newPassword !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      if (!validatePasswordStrength(newPassword)) {
        showError('Please meet all password requirements (8+ characters with lowercase, uppercase, number, and symbol)');
        return;
      }

      hideError();
      hideSuccess();

      const submitBtn = passwordForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating password...';

      try {
        // Update password
        const result = await updatePassword(newPassword);

        if (result.success) {
          passwordUpdated = true;
          showSuccess('Password updated successfully!');
          
          // Check if user has MFA enabled
          const mfaStatus = await checkMFAStatus();
          
          if (mfaStatus.hasMFA) {
            // Show MFA challenge
            setTimeout(() => {
              showMfaSection();
              hideSuccess();
            }, 1500);
          } else {
            // No MFA - redirect to app
            setTimeout(() => {
              window.location.href = 'app.html';
            }, 2000);
          }
        } else {
          showError(result.message || result.error || 'Failed to update password');
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
      hideSuccess();

      const submitBtn = mfaForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const result = await verifyMFA(code);

        if (result.success) {
          showSuccess('Verification successful! Redirecting...');
          setTimeout(() => {
            window.location.href = 'app.html';
          }, 1500);
        } else {
          showError(result.error || 'Invalid authentication code');
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

  // Handle recovery code form submission
  if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const code = document.getElementById('recoveryCode').value.trim();

      if (!code) {
        showError('Please enter a recovery code');
        return;
      }

      hideError();
      hideSuccess();

      const submitBtn = recoveryForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying...';

      try {
        const result = await verifyMFA(code);

        if (result.success) {
          showSuccess('Verification successful! Redirecting...');
          setTimeout(() => {
            window.location.href = 'app.html';
          }, 1500);
        } else {
          showError(result.error || 'Invalid recovery code');
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

  // Switch to recovery code
  if (useRecoveryCodeBtn) {
    useRecoveryCodeBtn.addEventListener('click', () => {
      showRecoverySection();
    });
  }

  // Switch back to MFA
  if (backToMfaBtn) {
    backToMfaBtn.addEventListener('click', () => {
      showMfaSection();
    });
  }

  // Helper functions
  function showPasswordSection() {
    passwordSection.style.display = 'block';
    mfaSection.style.display = 'none';
    recoverySection.style.display = 'none';
  }

  function showMfaSection() {
    passwordSection.style.display = 'none';
    mfaSection.style.display = 'block';
    recoverySection.style.display = 'none';
    
    // Focus on MFA input
    setTimeout(() => {
      document.getElementById('mfaCode').focus();
    }, 100);
  }

  function showRecoverySection() {
    passwordSection.style.display = 'none';
    mfaSection.style.display = 'none';
    recoverySection.style.display = 'block';
    
    // Focus on recovery input
    setTimeout(() => {
      document.getElementById('recoveryCode').focus();
    }, 100);
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

  /**
   * Check if user has MFA enabled
   */
  async function checkMFAStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { hasMFA: false };
      }

      // Check if user has MFA factors enrolled
      const factors = user.factors || [];
      const hasTOTP = factors.some(factor => 
        factor.factor_type === 'totp' && factor.status === 'verified'
      );

      return {
        hasMFA: hasTOTP,
        factors: factors
      };
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return { hasMFA: false };
    }
  }
});
