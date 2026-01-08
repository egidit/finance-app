// Global variables
let currentUser = null;
let incomeData = [];
let expensesData = [];

// Initialize app
(async function initApp() {
  // Restore tab immediately to prevent flash
  restoreActiveTab();
  
  await loadUserProfile();
  await loadAllData();
  setupEventListeners();
  setupDarkModeListener();
})();

// Restore the last active tab from localStorage
function restoreActiveTab() {
  const savedTab = localStorage.getItem('activeTab') || 'dashboard';
  switchTab(savedTab);
}

// Setup dark mode listener to update chart when color scheme changes
function setupDarkModeListener() {
  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeQuery.addEventListener('change', () => {
    // Recalculate and redraw chart with new colors
    updateDashboard();
  });
}

// Load user profile
async function loadUserProfile() {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  // Set user info in sidebar
  document.getElementById('userEmail').textContent = currentUser.email;
  document.getElementById('profileEmail').value = currentUser.email;
  
  // Use email for display
  const emailUsername = currentUser.email.split('@')[0];
  document.getElementById('userName').textContent = emailUsername;
  document.getElementById('userAvatar').textContent = emailUsername.charAt(0).toUpperCase();
}

// Load all data
async function loadAllData() {
  await Promise.all([
    loadIncomeData(),
    loadExpensesData()
  ]);
  updateDashboard();
}

// Load income data
async function loadIncomeData() {
  try {
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    incomeData = data || [];
    renderIncomeTable();
  } catch (error) {
    console.error('Error loading income:', error);
    showNotification('Failed to load income data', 'error');
  }
}

// Load expenses data
async function loadExpensesData() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('due_date', { ascending: true });

    if (error) throw error;

    expensesData = data || [];
    renderExpensesTable();
  } catch (error) {
    console.error('Error loading expenses:', error);
    showNotification('Failed to load expenses data', 'error');
  }
}

// Render income table
function renderIncomeTable() {
  const tbody = document.getElementById('incomeTableBody');
  const emptyState = document.getElementById('incomeEmptyState');
  
  if (incomeData.length === 0) {
    tbody.parentElement.parentElement.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  tbody.parentElement.parentElement.classList.remove('hidden');
  emptyState.classList.add('hidden');

  tbody.innerHTML = incomeData.map(income => `
    <tr>
      <td>${income.source}</td>
      <td>$${parseFloat(income.amount).toFixed(2)}</td>
      <td><span class="badge badge-${income.frequency}">${income.frequency}</span></td>
      <td>${new Date(income.created_at).toLocaleDateString()}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editIncome('${income.id}')" title="Edit">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="btn-icon delete" onclick="deleteIncome('${income.id}')" title="Delete">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render expenses table
function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  const emptyState = document.getElementById('expensesEmptyState');
  
  if (expensesData.length === 0) {
    tbody.parentElement.parentElement.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  tbody.parentElement.parentElement.classList.remove('hidden');
  emptyState.classList.add('hidden');

  tbody.innerHTML = expensesData.map(expense => `
    <tr>
      <td>${expense.name}</td>
      <td>$${parseFloat(expense.amount).toFixed(2)}</td>
      <td><span class="badge badge-${expense.category}">${expense.category}</span></td>
      <td>${new Date(expense.due_date).toLocaleDateString()}</td>
      <td>${expense.recurring ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-danger">No</span>'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon edit" onclick="editExpense('${expense.id}')" title="Edit">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="btn-icon delete" onclick="deleteExpense('${expense.id}')" title="Delete">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Update dashboard
function updateDashboard() {
  // Calculate monthly income
  const monthlyIncome = incomeData.reduce((sum, income) => {
    let amount = parseFloat(income.amount);
    switch (income.frequency) {
      case 'weekly':
        amount *= 4.33;
        break;
      case 'biweekly':
        amount *= 2.17;
        break;
      case 'yearly':
        amount /= 12;
        break;
      case 'one-time':
        amount = 0;
        break;
    }
    return sum + amount;
  }, 0);

  // Calculate monthly expenses
  const monthlyExpenses = expensesData.reduce((sum, expense) => {
    return sum + (expense.recurring ? parseFloat(expense.amount) : 0);
  }, 0);

  // Update stats
  document.getElementById('totalIncome').textContent = `$${monthlyIncome.toFixed(2)}`;
  document.getElementById('totalExpenses').textContent = `$${monthlyExpenses.toFixed(2)}`;
  document.getElementById('remainingBalance').textContent = `$${(monthlyIncome - monthlyExpenses).toFixed(2)}`;

  // Update chart
  updateChart(monthlyIncome, monthlyExpenses);

  // Update upcoming due dates
  updateUpcomingDueDates();
}

// Update chart with vanilla canvas and animation
function updateChart(income, expenses) {
  const canvas = document.getElementById('incomeExpenseChart');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  
  const width = rect.width;
  const height = rect.height;
  
  // Detect dark mode
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDarkMode ? 'rgba(63, 63, 70, 0.5)' : 'rgba(0, 0, 0, 0.1)';
  const textColor = isDarkMode ? '#e4e4e7' : '#374151';
  const tooltipBg = isDarkMode ? 'rgba(39, 39, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipBorder = isDarkMode ? 'rgba(63, 63, 70, 1)' : 'rgba(229, 231, 235, 1)';
  
  // Chart data
  const data = [
    { label: 'Monthly Income', value: income, color: 'rgba(16, 185, 129, 0.8)', borderColor: 'rgba(16, 185, 129, 1)' },
    { label: 'Monthly Expenses', value: expenses, color: 'rgba(239, 68, 68, 0.8)', borderColor: 'rgba(239, 68, 68, 1)' },
    { label: 'Remaining', value: income - expenses, color: 'rgba(6, 182, 212, 0.8)', borderColor: 'rgba(6, 182, 212, 1)' }
  ];
  
  // Chart dimensions
  const padding = { top: 40, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)), 0);
  const yScale = maxValue > 0 ? chartHeight / maxValue : 1;
  
  // Calculate bar positions
  const barWidth = chartWidth / data.length * 0.6;
  const barSpacing = chartWidth / data.length;
  const bars = data.map((item, index) => {
    const barHeight = Math.abs(item.value) * yScale;
    const x = padding.left + (barSpacing * index) + (barSpacing - barWidth) / 2;
    const y = item.value >= 0 
      ? padding.top + chartHeight - barHeight
      : padding.top + chartHeight;
    return { ...item, x, y, barHeight, barWidth };
  });
  
  // Hover state
  let hoveredBar = null;
  
  function drawChart(progress = 1) {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid lines and y-axis labels
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = textColor;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.lineWidth = 1;
    
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight * i / gridLines);
      const value = maxValue * (1 - i / gridLines);
      
      // Grid line
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      
      // Y-axis label
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + Math.round(value), padding.left - 10, y);
    }
    
    // Draw bars with animation
    bars.forEach((bar, index) => {
      const animatedHeight = bar.barHeight * progress;
      const animatedY = bar.value >= 0 
        ? bar.y + (bar.barHeight - animatedHeight)
        : bar.y;
      
      // Highlight on hover
      const isHovered = hoveredBar === index;
      const alpha = isHovered ? 1 : 0.8;
      
      // Draw bar
      ctx.fillStyle = bar.color.replace('0.8', alpha);
      ctx.fillRect(bar.x, animatedY, bar.barWidth, animatedHeight);
      
      // Draw border
      ctx.strokeStyle = bar.borderColor;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.strokeRect(bar.x, animatedY, bar.barWidth, animatedHeight);
      
      // Draw label
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      
      const words = bar.label.split(' ');
      words.forEach((word, wordIndex) => {
        ctx.fillText(word, bar.x + bar.barWidth / 2, padding.top + chartHeight + 10 + (wordIndex * 16));
      });
    });
    
    // Draw tooltip on hover
    if (hoveredBar !== null && progress === 1) {
      const bar = bars[hoveredBar];
      
      // Tooltip dimensions
      const tooltipText = `$${bar.value.toFixed(2)}`;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const textMetrics = ctx.measureText(tooltipText);
      const tooltipWidth = textMetrics.width + 20;
      const tooltipHeight = 32;
      const tooltipX = bar.x + bar.barWidth / 2 - tooltipWidth / 2;
      const tooltipY = bar.y - tooltipHeight - 10;
      
      // Draw tooltip background
      ctx.fillStyle = tooltipBg;
      ctx.strokeStyle = tooltipBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
      ctx.fill();
      ctx.stroke();
      
      // Draw tooltip text
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltipText, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
    }
  }
  
  // Animation
  const duration = 800;
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);
    
    drawChart(eased);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
  
  // Mouse move handler for hover effect
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    let newHoveredBar = null;
    bars.forEach((bar, index) => {
      if (mouseX >= bar.x && mouseX <= bar.x + bar.barWidth &&
          mouseY >= bar.y && mouseY <= bar.y + bar.barHeight) {
        newHoveredBar = index;
      }
    });
    
    if (newHoveredBar !== hoveredBar) {
      hoveredBar = newHoveredBar;
      canvas.style.cursor = hoveredBar !== null ? 'pointer' : 'default';
      drawChart(1);
    }
  };
  
  // Mouse leave handler
  canvas.onmouseleave = () => {
    if (hoveredBar !== null) {
      hoveredBar = null;
      canvas.style.cursor = 'default';
      drawChart(1);
    }
  };
}

// Update upcoming due dates
function updateUpcomingDueDates() {
  const dueDatesList = document.getElementById('dueDatesList');
  const today = new Date();
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingExpenses = expensesData
    .filter(expense => {
      const dueDate = new Date(expense.due_date);
      return dueDate >= today && dueDate <= next30Days;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5);

  if (upcomingExpenses.length === 0) {
    dueDatesList.innerHTML = '<li class="empty-state"><p>No upcoming due dates in the next 30 days</p></li>';
    return;
  }

  dueDatesList.innerHTML = upcomingExpenses.map(expense => {
    const daysUntil = Math.ceil((new Date(expense.due_date) - today) / (1000 * 60 * 60 * 24));
    const badgeClass = daysUntil <= 7 ? 'badge-danger' : 'badge-warning';
    
    return `
      <li class="due-date-item">
        <span class="category-indicator category-indicator-${expense.category}"></span>
        <div class="due-date-info">
          <div class="due-date-name">${expense.name}</div>
          <div class="due-date-date">
            <span class="badge ${badgeClass}">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</span>
            ${new Date(expense.due_date).toLocaleDateString()}
          </div>
        </div>
        <div class="due-date-amount">$${parseFloat(expense.amount).toFixed(2)}</div>
      </li>
    `;
  }).join('');
}

// Setup event listeners
function setupEventListeners() {
  // Mobile menu toggle
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Tab navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = item.dataset.tab;
      switchTab(tabName);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // Income modal
  document.getElementById('addIncomeBtn').addEventListener('click', openIncomeModal);
  document.getElementById('incomeForm').addEventListener('submit', handleIncomeSubmit);
  setupModalCloseOnOverlay('incomeModal', closeIncomeModal);

  // Expense modal
  document.getElementById('addExpenseBtn').addEventListener('click', openExpenseModal);
  document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
  setupModalCloseOnOverlay('expenseModal', closeExpenseModal);
  
  // Password modal
  document.getElementById('changePasswordBtn').addEventListener('click', openPasswordModal);
  document.getElementById('cancelPasswordBtn').addEventListener('click', closePasswordModal);
  document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);
  setupModalCloseOnOverlay('passwordModal', closePasswordModal);
  
  // MFA modals
  document.getElementById('enableMFABtn').addEventListener('click', openEnableMFAModal);
  document.getElementById('disableMFABtn').addEventListener('click', openDisableMFAModal);
  document.getElementById('mfaNextBtn').addEventListener('click', showMFAStep2);
  document.getElementById('verifyMFAForm').addEventListener('submit', handleMFAVerify);
  document.getElementById('closeMFAModalBtn').addEventListener('click', closeEnableMFAModal);
  document.getElementById('cancelDisableMFABtn').addEventListener('click', closeDisableMFAModal);
  document.getElementById('confirmDisableMFABtn').addEventListener('click', handleDisableMFA);
  document.getElementById('copyRecoveryCodesBtn').addEventListener('click', copyRecoveryCodes);
  setupModalCloseOnOverlay('enableMFAModal', closeEnableMFAModal);
  setupModalCloseOnOverlay('disableMFAModal', closeDisableMFAModal);

  
  // Request account deletion
  document.getElementById('requestDeletionBtn').addEventListener('click', openRequestDeletionModal);
  document.getElementById('cancelRequestDeletionBtn').addEventListener('click', closeRequestDeletionModal);
  document.getElementById('confirmRequestDeletionBtn').addEventListener('click', handleRequestDeletion);
  setupModalCloseOnOverlay('requestDeletionModal', closeRequestDeletionModal);
}

// Helper function to properly handle modal close on overlay click
function setupModalCloseOnOverlay(modalId, closeCallback) {
  const modal = document.getElementById(modalId);
  let mouseDownOnOverlay = false;

  modal.addEventListener('mousedown', (e) => {
    if (e.target.id === modalId) {
      mouseDownOnOverlay = true;
    }
  });

  modal.addEventListener('mouseup', (e) => {
    if (e.target.id === modalId && mouseDownOnOverlay) {
      closeCallback();
    }
    mouseDownOnOverlay = false;
  });

  // Reset flag if mouse leaves modal during drag
  modal.addEventListener('mouseleave', () => {
    mouseDownOnOverlay = false;
  });
}

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

// Switch tab
function switchTab(tabName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    }
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');

  // Close mobile menu
  document.getElementById('sidebar').classList.remove('open');

  // Save current tab to localStorage
  localStorage.setItem('activeTab', tabName);
  
  // Load MFA status when switching to profile tab
  if (tabName === 'profile') {
    checkAndDisplayMFAStatus();
  }
}

// Income modal functions
function openIncomeModal() {
  document.getElementById('incomeModalTitle').textContent = 'Add Income';
  document.getElementById('incomeForm').reset();
  document.getElementById('incomeId').value = '';
  document.getElementById('incomeModal').classList.remove('hidden');
}

function closeIncomeModal() {
  document.getElementById('incomeModal').classList.add('hidden');
}

async function editIncome(id) {
  const income = incomeData.find(i => i.id === id);
  if (!income) return;

  document.getElementById('incomeModalTitle').textContent = 'Edit Income';
  document.getElementById('incomeId').value = income.id;
  document.getElementById('incomeSource').value = income.source;
  document.getElementById('incomeAmount').value = income.amount;
  document.getElementById('incomeFrequency').value = income.frequency;
  document.getElementById('incomeModal').classList.remove('hidden');
}

async function deleteIncome(id) {
  if (!confirm('Are you sure you want to delete this income source?')) return;

  try {
    const { error } = await supabase
      .from('income')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showNotification('Income deleted successfully', 'success');
    await loadAllData();
  } catch (error) {
    console.error('Error deleting income:', error);
    showNotification('Failed to delete income', 'error');
  }
}

async function handleIncomeSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('incomeId').value;
  const source = document.getElementById('incomeSource').value;
  const amount = document.getElementById('incomeAmount').value;
  const frequency = document.getElementById('incomeFrequency').value;

  try {
    if (id) {
      // Update existing
      const { error } = await supabase
        .from('income')
        .update({ source, amount, frequency })
        .eq('id', id);

      if (error) throw error;
      showNotification('Income updated successfully', 'success');
    } else {
      // Create new
      const { error } = await supabase
        .from('income')
        .insert([{ user_id: currentUser.id, source, amount, frequency }]);

      if (error) throw error;
      showNotification('Income added successfully', 'success');
    }

    closeIncomeModal();
    await loadAllData();
  } catch (error) {
    console.error('Error saving income:', error);
    showNotification('Failed to save income', 'error');
  }
}

// Expense modal functions
function openExpenseModal() {
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseModal').classList.remove('hidden');
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.add('hidden');
}

async function editExpense(id) {
  const expense = expensesData.find(e => e.id === id);
  if (!expense) return;

  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseId').value = expense.id;
  document.getElementById('expenseName').value = expense.name;
  document.getElementById('expenseAmount').value = expense.amount;
  document.getElementById('expenseCategory').value = expense.category;
  document.getElementById('expenseDueDate').value = expense.due_date;
  document.getElementById('expenseRecurring').checked = expense.recurring;
  document.getElementById('expenseModal').classList.remove('hidden');
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;

  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showNotification('Expense deleted successfully', 'success');
    await loadAllData();
  } catch (error) {
    console.error('Error deleting expense:', error);
    showNotification('Failed to delete expense', 'error');
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('expenseId').value;
  const name = document.getElementById('expenseName').value;
  const amount = document.getElementById('expenseAmount').value;
  const category = document.getElementById('expenseCategory').value;
  const due_date = document.getElementById('expenseDueDate').value;
  const recurring = document.getElementById('expenseRecurring').checked;

  try {
    if (id) {
      // Update existing
      const { error } = await supabase
        .from('expenses')
        .update({ name, amount, category, due_date, recurring })
        .eq('id', id);

      if (error) throw error;
      showNotification('Expense updated successfully', 'success');
    } else {
      // Create new
      const { error } = await supabase
        .from('expenses')
        .insert([{ user_id: currentUser.id, name, amount, category, due_date, recurring }]);

      if (error) throw error;
      showNotification('Expense added successfully', 'success');
    }

    closeExpenseModal();
    await loadAllData();
  } catch (error) {
    console.error('Error saving expense:', error);
    showNotification('Failed to save expense', 'error');
  }
}

// Password modal functions
function openPasswordModal() {
  document.getElementById('passwordModal').classList.remove('hidden');
}

function closePasswordModal() {
  document.getElementById('passwordModal').classList.add('hidden');
  document.getElementById('passwordForm').reset();
}

async function handlePasswordSubmit(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showNotification('Passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showNotification('Password must be at least 6 characters long', 'error');
    return;
  }

  // First, verify current password by attempting to reauthenticate
  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword
    });

    if (signInError) {
      showNotification('Current password is incorrect', 'error');
      return;
    }

    // If reauthentication successful, update password
    const result = await updatePassword(newPassword);

    if (result.success) {
      showNotification('Password updated successfully', 'success');
      closePasswordModal();
    } else {
      showNotification(result.error || 'Failed to update password', 'error');
    }
  } catch (error) {
    console.error('Error verifying current password:', error);
    showNotification('Failed to verify current password', 'error');
  }
}

// ==============================================
// MFA MANAGEMENT FUNCTIONS
// ==============================================

let currentMFAFactorId = null;
let currentRecoveryCodes = [];

// Check MFA status on page load
async function checkAndDisplayMFAStatus() {
  const result = await checkMFAStatus();
  const statusDiv = document.getElementById('mfaStatus');
  const enableBtn = document.getElementById('enableMFABtn');
  const disableBtn = document.getElementById('disableMFABtn');
  
  if (result.success) {
    if (result.enabled) {
      statusDiv.innerHTML = `
        <div class="alert alert-success">
          <p><strong>✓ MFA is enabled</strong><br>Your account has an extra layer of security.</p>
        </div>
      `;
      enableBtn.style.display = 'none';
      disableBtn.style.display = 'inline-flex';
    } else {
      statusDiv.innerHTML = `
        <div class="alert alert-warning">
          <p><strong>⚠ MFA is not enabled</strong><br>Enable two-factor authentication for better security.</p>
        </div>
      `;
      enableBtn.style.display = 'inline-flex';
      disableBtn.style.display = 'none';
    }
  } else {
    statusDiv.innerHTML = `
      <div class="alert alert-error">
        <p>Failed to check MFA status</p>
      </div>
    `;
  }
}

// Open Enable MFA Modal
async function openEnableMFAModal() {
  document.getElementById('enableMFAModal').classList.remove('hidden');
  
  // Reset to step 1
  document.getElementById('mfaStep1').style.display = 'block';
  document.getElementById('mfaStep2').style.display = 'none';
  document.getElementById('mfaStep3').style.display = 'none';
  
  // Enroll in MFA
  const result = await enrollMFA();
  
  if (result.success) {
    currentMFAFactorId = result.factorId;
    
    // Display QR code
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = `<img src="${result.qrCode}" alt="QR Code" />`;
    
    // Display secret
    document.getElementById('mfaSecret').textContent = result.secret;
  } else {
    showNotification('Failed to generate MFA setup', 'error');
    closeEnableMFAModal();
  }
}

// Close Enable MFA Modal
function closeEnableMFAModal() {
  document.getElementById('enableMFAModal').classList.add('hidden');
  document.getElementById('mfaVerifyCode').value = '';
  currentMFAFactorId = null;
  currentRecoveryCodes = [];
  
  // Refresh MFA status
  checkAndDisplayMFAStatus();
}

// Show MFA Step 2
function showMFAStep2() {
  document.getElementById('mfaStep1').style.display = 'none';
  document.getElementById('mfaStep2').style.display = 'block';
  document.getElementById('mfaVerifyCode').focus();
}

// Handle MFA Verification
async function handleMFAVerify(e) {
  e.preventDefault();
  
  const code = document.getElementById('mfaVerifyCode').value.trim();
  
  if (!code || code.length !== 6) {
    showNotification('Please enter a valid 6-digit code', 'error');
    return;
  }
  
  const result = await verifyMFAEnrollment(currentMFAFactorId, code);
  
  if (result.success) {
    // Show recovery codes
    currentRecoveryCodes = result.recoveryCodes;
    displayRecoveryCodes(currentRecoveryCodes);
    
    // Show step 3
    document.getElementById('mfaStep2').style.display = 'none';
    document.getElementById('mfaStep3').style.display = 'block';
  } else {
    showNotification('Invalid code. Please try again.', 'error');
  }
}

// Display Recovery Codes
function displayRecoveryCodes(codes) {
  const container = document.getElementById('recoveryCodesContainer');
  container.innerHTML = codes.map(code => 
    `<div class="recovery-code">${code}</div>`
  ).join('');
}

// Copy Recovery Codes
function copyRecoveryCodes() {
  const codesText = currentRecoveryCodes.join('\n');
  navigator.clipboard.writeText(codesText).then(() => {
    showNotification('Recovery codes copied to clipboard', 'success');
  }).catch(() => {
    showNotification('Failed to copy codes', 'error');
  });
}

// Open Disable MFA Modal
function openDisableMFAModal() {
  document.getElementById('disableMFAModal').classList.remove('hidden');
}

// Close Disable MFA Modal
function closeDisableMFAModal() {
  document.getElementById('disableMFAModal').classList.add('hidden');
}

// Handle Disable MFA
async function handleDisableMFA() {
  const confirmBtn = document.getElementById('confirmDisableMFABtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Disabling...';
  
  // Get factor ID
  const statusResult = await checkMFAStatus();
  if (!statusResult.success || !statusResult.enabled || statusResult.factors.length === 0) {
    showNotification('No MFA factor found', 'error');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Disable MFA';
    return;
  }
  
  const factorId = statusResult.factors[0].id;
  const result = await disableMFA(factorId);
  
  if (result.success) {
    showNotification('MFA disabled successfully', 'success');
    closeDisableMFAModal();
    checkAndDisplayMFAStatus();
  } else {
    if (result.requiresAAL2) {
      showNotification('Please verify your authenticator code first before disabling MFA', 'error');
    } else {
      showNotification('Failed to disable MFA', 'error');
    }
  }
  
  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Disable MFA';
}

// Request deletion modal functions
function openRequestDeletionModal() {
  document.getElementById('requestDeletionModal').classList.remove('hidden');
}

function closeRequestDeletionModal() {
  document.getElementById('requestDeletionModal').classList.add('hidden');
}

async function handleRequestDeletion() {
  const confirmBtn = document.getElementById('confirmRequestDeletionBtn');
  const cancelBtn = document.getElementById('cancelRequestDeletionBtn');
  const requestBtn = document.getElementById('requestDeletionBtn');
  
  // Disable buttons
  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  requestBtn.disabled = true;
  
  // Get user info
  const user = await getCurrentUser();
  const userEmail = user ? user.email : '';
  const userId = user ? user.id : '';
  
  // Prepare mailto link
  const supportEmail = 'contact@egidit.com';
  const subject = encodeURIComponent('Account Deletion Request');
  const body = encodeURIComponent(
    `Hello Support Team,\n\n` +
    `I would like to request the deletion of my account and all associated data.\n\n` +
    `Account Details:\n` +
    `Email: ${userEmail}\n` +
    `User ID: ${userId}\n\n` +
    `I understand that this action is permanent and cannot be undone.\n\n` +
    `Thank you.`
  );
  
  const mailtoLink = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  
  // Open mail client
  window.location.href = mailtoLink;
  
  // Close modal and show success message
  setTimeout(() => {
    closeRequestDeletionModal();
    showNotification('Mail client opened. Please send your deletion request.', 'success');
    
    // Re-enable buttons after a delay
    setTimeout(() => {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      requestBtn.disabled = false;
    }, 2000);
  }, 500);
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} notification-toast`;
  notification.innerHTML = `<p>${message}</p>`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
