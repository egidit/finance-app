/**
 * Registration Page Script
 * Handles user registration with email verification
 */

document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const confirmationPage = document.getElementById('confirmationPage');
  const registrationForm = document.getElementById('registrationForm');

  // Password strength indicator
  const passwordInput = document.getElementById('password');
  const strengthIndicator = document.getElementById('passwordStrength');

  if (passwordInput && strengthIndicator) {
    passwordInput.addEventListener('input', (e) => {
      const password = e.target.value;
      const strength = calculatePasswordStrength(password);
      
      strengthIndicator.className = 'password-strength';
      strengthIndicator.textContent = '';
      
      if (password.length > 0) {
        if (strength < 2) {
          strengthIndicator.classList.add('weak');
          strengthIndicator.textContent = 'Weak password';
        } else if (strength < 4) {
          strengthIndicator.classList.add('medium');
          strengthIndicator.textContent = 'Medium strength';
        } else {
          strengthIndicator.classList.add('strong');
          strengthIndicator.textContent = 'Strong password';
        }
      }
    });
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

  // Handle registration form submission
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword')?.value;
      const username = document.getElementById('username')?.value?.trim();

      // Clear previous messages
      hideError();
      hideSuccess();

      // Validate password match if confirm field exists
      if (confirmPassword && password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      // Validate password strength
      const strength = calculatePasswordStrength(password);
      if (strength < 2) {
        showError('Please choose a stronger password (at least 8 characters with uppercase, lowercase, and numbers)');
        return;
      }

      // Disable submit button
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';

      try {
        // Register user
        const result = await registerUser(email, password, username);

        if (result.success) {
          // Show confirmation page
          if (registrationForm && confirmationPage) {
            registrationForm.style.display = 'none';
            confirmationPage.style.display = 'block';
            
            // Set email in confirmation message
            const emailSpan = document.getElementById('confirmEmail');
            if (emailSpan) {
              emailSpan.textContent = email;
            }
          } else {
            showSuccess(result.message);
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

  function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return strength;
  }
});
