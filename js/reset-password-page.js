/**
 * Password Reset Page Script
 * Handles password reset requests and new password submission
 */

document.addEventListener('DOMContentLoaded', async () => {
  const requestForm = document.getElementById('requestResetForm');
  const resetForm = document.getElementById('resetPasswordForm');
  const requestSection = document.getElementById('requestSection');
  const resetSection = document.getElementById('resetSection');
  const successSection = document.getElementById('successSection');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');

  // Check URL hash for recovery token
  const hash = window.location.hash;
  const isRecoveryLink = hash.includes('type=recovery');

  if (isRecoveryLink) {
    // User clicked reset link - show reset form
    showResetForm();
    
    // Verify this is actually a recovery session
    const recoveryCheck = await isRecoverySession();
    if (!recoveryCheck.isRecovery) {
      showError('Invalid or expired reset link. Please request a new one.');
      showRequestForm();
    }
  } else {
    // Show request form by default
    showRequestForm();
  }

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

  // Handle request reset form submission
  if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('requestEmail').value.trim();

      if (!email) {
        showError('Please enter your email address');
        return;
      }

      hideError();
      hideSuccess();

      const submitBtn = requestForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        const result = await resetPassword(email);

        if (result.success) {
          showSuccess(result.message);
          requestForm.reset();
        } else {
          showError(result.error);
        }
      } catch (error) {
        showError('An unexpected error occurred. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Handle reset password form submission
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmNewPassword').value;

      if (newPassword !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      if (newPassword.length < 6) {
        showError('Password must be at least 6 characters');
        return;
      }

      hideError();
      hideSuccess();

      const submitBtn = resetForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating password...';

      try {
        const result = await updatePassword(newPassword);

        if (result.success) {
          // Show success page
          showSuccessPage();
          
          // Sign out and redirect to login after delay
          setTimeout(async () => {
            await logout();
            window.location.href = 'index.html';
          }, 3000);
        } else {
          if (result.requiresAAL2) {
            // MFA enabled - cannot reset via email
            showError('Your account has MFA enabled. Please log in normally to change your password from Profile → Security.');
            
            // Redirect to login after showing message
            setTimeout(() => {
              window.location.href = 'index.html';
            }, 5000);
          } else {
            showError(result.message || result.error);
          }
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
  function showRequestForm() {
    if (requestSection) requestSection.style.display = 'block';
    if (resetSection) resetSection.style.display = 'none';
    if (successSection) successSection.style.display = 'none';
  }

  function showResetForm() {
    if (requestSection) requestSection.style.display = 'none';
    if (resetSection) resetSection.style.display = 'block';
    if (successSection) successSection.style.display = 'none';
  }

  function showSuccessPage() {
    if (requestSection) requestSection.style.display = 'none';
    if (resetSection) resetSection.style.display = 'none';
    if (successSection) successSection.style.display = 'block';
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
});
