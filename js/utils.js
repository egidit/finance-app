// ============================================================================
// Theme Management
// ============================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'system';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'system';
  const themes = ['light', 'system', 'dark'];
  const currentIndex = themes.indexOf(current);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  applyTheme(nextTheme);
  return nextTheme;
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'system' || !savedTheme) {
    applyTheme('system');
  }
});

// ============================================================================
// Layout Mode Management
// ============================================================================

function initLayout() {
  const savedMode = localStorage.getItem('layoutMode') || 'auto';
  applyLayout(savedMode);
}

function applyLayout(mode) {
  const isMobileDevice = window.innerWidth < 768;
  
  if (mode === 'auto') {
    document.body.classList.toggle('mobile-mode', isMobileDevice);
    document.body.classList.toggle('desktop-mode', !isMobileDevice);
  } else if (mode === 'mobile') {
    document.body.classList.add('mobile-mode');
    document.body.classList.remove('desktop-mode');
  } else {
    document.body.classList.add('desktop-mode');
    document.body.classList.remove('mobile-mode');
  }
  
  localStorage.setItem('layoutMode', mode);
}

// Listen for window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const mode = localStorage.getItem('layoutMode') || 'auto';
    if (mode === 'auto') {
      applyLayout('auto');
    }
  }, 250);
});

// ============================================================================
// Navigation Helpers
// ============================================================================

function setActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.sidebar-link, .mobile-nav-link, .nav-item');
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (href && currentPath.startsWith(href.replace('.html', '')))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Initialize mobile navigation toggle
function initMobileNav() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!menuBtn || !sidebar) return;
  
  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  });
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
  
  // Close on nav item click (mobile)
  const navItems = sidebar.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
}

// ============================================================================
// Form Validation
// ============================================================================

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain a special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Alert/Toast System
// ============================================================================

function showAlert(message, type = 'error') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  
  const container = document.querySelector('.app-content') || document.body;
  container.insertBefore(alertDiv, container.firstChild);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// ============================================================================
// Loading State
// ============================================================================

function setLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = '<span class="spinner"></span>';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

// ============================================================================
// Initialize on page load
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLayout();
  setActiveNav();
});
