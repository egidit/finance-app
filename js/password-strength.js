/**
 * Password Strength Visualizer
 * Shared utility for displaying password requirements across all pages
 */

/**
 * Initialize password strength visualizer for a password input field
 * @param {string} inputId - ID of the password input element
 * @param {string} containerId - ID of the container with .password-requirements (optional, will search parent)
 */
function initPasswordStrengthVisualizer(inputId, containerId = null) {
  const input = document.getElementById(inputId);
  if (!input) {
    console.warn(`Password input with id "${inputId}" not found`);
    return;
  }

  // Find requirements container (either by ID or by searching parent)
  let requirementsContainer;
  if (containerId) {
    requirementsContainer = document.getElementById(containerId);
  } else {
    // Search for requirements container in parent elements
    let parent = input.parentElement;
    while (parent && !requirementsContainer) {
      requirementsContainer = parent.querySelector('.password-requirements');
      parent = parent.parentElement;
    }
  }

  if (!requirementsContainer) {
    console.warn('Password requirements container not found');
    return;
  }

  // Find strength bar
  let strengthBar = input.parentElement;
  while (strengthBar && !strengthBar.querySelector('.password-strength-bar')) {
    strengthBar = strengthBar.parentElement;
  }
  const strengthBarFill = strengthBar?.querySelector('.password-strength-bar-fill');

  // Get requirement elements
  const requirements = {
    length: requirementsContainer.querySelector('[data-requirement="length"]'),
    lowercase: requirementsContainer.querySelector('[data-requirement="lowercase"]'),
    uppercase: requirementsContainer.querySelector('[data-requirement="uppercase"]'),
    digit: requirementsContainer.querySelector('[data-requirement="digit"]'),
    symbol: requirementsContainer.querySelector('[data-requirement="symbol"]')
  };

  // Add input listener
  input.addEventListener('input', (e) => {
    const password = e.target.value;
    updatePasswordRequirements(password, requirements, strengthBarFill);
  });
}

/**
 * Check if password meets specific requirement
 * @param {string} password - Password to check
 * @param {string} requirement - Requirement type
 * @returns {boolean}
 */
function checkPasswordRequirement(password, requirement) {
  switch (requirement) {
    case 'length':
      return password.length >= 8;
    case 'lowercase':
      return /[a-z]/.test(password);
    case 'uppercase':
      return /[A-Z]/.test(password);
    case 'digit':
      return /\d/.test(password);
    case 'symbol':
      return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    default:
      return false;
  }
}

/**
 * Update password requirement indicators
 * @param {string} password - Current password value
 * @param {Object} requirements - Object containing requirement DOM elements
 * @param {HTMLElement} strengthBarFill - Strength bar fill element
 */
function updatePasswordRequirements(password, requirements, strengthBarFill) {
  let metCount = 0;
  const totalRequirements = 5;

  // Update each requirement
  Object.keys(requirements).forEach(reqKey => {
    const reqElement = requirements[reqKey];
    if (!reqElement) return;

    const isMet = checkPasswordRequirement(password, reqKey);
    
    if (isMet) {
      metCount++;
      reqElement.classList.add('met');
      reqElement.classList.remove('unmet');
      
      // Update icon to checkmark
      const icon = reqElement.querySelector('.requirement-icon');
      if (icon) {
        icon.classList.add('check');
        icon.classList.remove('circle');
        icon.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        `;
      }
    } else {
      reqElement.classList.remove('met');
      reqElement.classList.add('unmet');
      
      // Update icon to circle
      const icon = reqElement.querySelector('.requirement-icon');
      if (icon) {
        icon.classList.remove('check');
        icon.classList.add('circle');
        icon.innerHTML = `
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
          </svg>
        `;
      }
    }
  });

  // Update strength bar
  if (strengthBarFill) {
    const percentage = (metCount / totalRequirements) * 100;
    strengthBarFill.style.width = `${percentage}%`;
    
    // Update color based on strength
    strengthBarFill.classList.remove('weak', 'medium', 'strong');
    if (metCount <= 2) {
      strengthBarFill.classList.add('weak');
    } else if (metCount <= 4) {
      strengthBarFill.classList.add('medium');
    } else {
      strengthBarFill.classList.add('strong');
    }
  }
}

/**
 * Validate password meets all requirements
 * @param {string} password - Password to validate
 * @returns {boolean}
 */
function validatePasswordStrength(password) {
  return (
    checkPasswordRequirement(password, 'length') &&
    checkPasswordRequirement(password, 'lowercase') &&
    checkPasswordRequirement(password, 'uppercase') &&
    checkPasswordRequirement(password, 'digit') &&
    checkPasswordRequirement(password, 'symbol')
  );
}
