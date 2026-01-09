/**
 * Password Reset Request Page Script
 * Handles password reset email requests
 */

document.addEventListener('DOMContentLoaded', async () => {
  const requestForm = document.getElementById('requestResetForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');

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

  // Helper functions
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
