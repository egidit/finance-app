// ========================================
// GLOBAL STATE
// ========================================
let currentUser = null;
let incomeData = [];
let expensesData = [];
let financeChart = null;

// ========================================
// INITIALIZATION
// ========================================
(async function initApp() {
  try {
    await loadUserProfile();
    await loadAllData();
    setupEventListeners();
    restoreActiveTab();
  } catch (error) {
    console.error('App initialization error:', error);
    showToast('Failed to load app', 'error');
  }
})();

// ========================================
// USER & DATA LOADING
// ========================================
async function loadUserProfile() {
  const result = await getCurrentUser();
  if (!result.success || !result.user) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = result.user;
  await updateUserDisplay();
}

async function updateUserDisplay() {
  // Fetch profile data from profiles table
  let displayName = currentUser.email.split('@')[0];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', currentUser.id)
      .single();
    
    if (!error && data && data.display_name) {
      displayName = data.display_name;
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }

  const initial = displayName.charAt(0).toUpperCase();

  // Update all avatar and user info elements
  const avatarElements = ['menuAvatar', 'profileAvatar', 'sidebarAvatar'];
  const nameElements = ['menuUserName', 'profileName', 'sidebarUserName'];
  const emailElements = ['menuUserEmail', 'profileEmail', 'sidebarUserEmail'];

  avatarElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });

  nameElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = displayName;
  });

  emailElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = currentUser.email;
  });

  // Populate username form in profile tab
  const usernameInput = document.getElementById('usernameInput');
  const emailDisplay = document.getElementById('emailDisplay');
  
  if (usernameInput) usernameInput.value = displayName;
  if (emailDisplay) emailDisplay.textContent = currentUser.email;
}

async function loadAllData() {
  await Promise.all([loadIncomeData(), loadExpensesData()]);
  updateDashboard();
}

async function loadIncomeData() {
  try {
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    incomeData = data || [];
    renderIncomeList();
  } catch (error) {
    console.error('Error loading income:', error);
  }
}

async function loadExpensesData() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    expensesData = data || [];
    renderExpensesList();
  } catch (error) {
    console.error('Error loading expenses:', error);
  }
}

// ========================================
// NAVIGATION
// ========================================
function switchTab(tabName) {
  // Update bottom nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update desktop sidebar nav buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetTab = document.getElementById(`${tabName}Tab`);
  if (targetTab) {
    targetTab.classList.add('active');
    localStorage.setItem('activeTab', tabName);

    // Load MFA status when switching to profile
    if (tabName === 'profile') {
      checkMFAStatus();
    }
  }
}

function restoreActiveTab() {
  const savedTab = localStorage.getItem('activeTab') || 'dashboard';
  switchTab(savedTab);
}

// ========================================
// DASHBOARD
// ========================================
function updateDashboard() {
  // Calculate totals
  const totalIncome = incomeData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalExpenses = expensesData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const balance = totalIncome - totalExpenses;

  // Update stat cards
  document.getElementById('totalIncome').textContent = `$${totalIncome.toFixed(2)}`;
  document.getElementById('totalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
  document.getElementById('balance').textContent = `$${balance.toFixed(2)}`;

  // Update chart
  renderChart();

  // Show recent activity
  renderRecentActivity();
}

function renderChart() {
  const canvas = document.getElementById('financeChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.parentElement.clientWidth;
  const height = 200;
  canvas.width = width;
  canvas.height = height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Simple bar chart
  const totalIncome = incomeData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const totalExpenses = expensesData.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  const max = Math.max(totalIncome, totalExpenses, 1);

  const barWidth = 80;
  const gap = 40;
  const startX = (width - (barWidth * 2 + gap)) / 2;
  const maxBarHeight = height - 60;

  // Income bar
  const incomeHeight = (totalIncome / max) * maxBarHeight;
  ctx.fillStyle = '#10b981';
  ctx.fillRect(startX, height - incomeHeight - 40, barWidth, incomeHeight);
  ctx.fillStyle = '#000';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Income', startX + barWidth / 2, height - 20);
  ctx.fillText(`$${totalIncome.toFixed(0)}`, startX + barWidth / 2, height - incomeHeight - 45);

  // Expenses bar
  const expensesHeight = (totalExpenses / max) * maxBarHeight;
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(startX + barWidth + gap, height - expensesHeight - 40, barWidth, expensesHeight);
  ctx.fillStyle = '#000';
  ctx.fillText('Expenses', startX + barWidth + gap + barWidth / 2, height - 20);
  ctx.fillText(`$${totalExpenses.toFixed(0)}`, startX + barWidth + gap + barWidth / 2, height - expensesHeight - 45);
}

function renderRecentActivity() {
  const container = document.getElementById('recentActivity');
  const emptyState = document.getElementById('recentEmpty');
  if (!container) return;

  // Combine and sort by date
  const allTransactions = [
    ...incomeData.map(item => ({ ...item, type: 'income' })),
    ...expensesData.map(item => ({ ...item, type: 'expense' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  if (allTransactions.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = allTransactions.map(item => `
    <div class="activity-item">
      <div class="activity-icon ${item.type}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${item.type === 'income' 
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>'
          }
        </svg>
      </div>
      <div class="activity-content">
        <div class="activity-title">${item.source || item.name || item.category}</div>
        <div class="activity-subtitle">${new Date(item.created_at).toLocaleDateString()}</div>
      </div>
      <div class="activity-amount ${item.type === 'income' ? 'positive' : 'negative'}">
        ${item.type === 'income' ? '+' : '-'}$${parseFloat(item.amount).toFixed(2)}
      </div>
    </div>
  `).join('');
}

// ========================================
// INCOME LIST
// ========================================
function renderIncomeList() {
  const container = document.getElementById('incomeList');
  const emptyState = document.getElementById('incomeEmpty');
  if (!container) return;

  if (incomeData.length === 0) {
    container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = incomeData.map(item => `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-title">${item.source}</div>
        <div class="list-item-subtitle">
          <span class="badge badge-${item.frequency}">${item.frequency}</span>
          · ${new Date(item.created_at).toLocaleDateString()}
        </div>
      </div>
      <div class="list-item-amount" style="color: var(--success);">
        $${parseFloat(item.amount).toFixed(2)}
      </div>
      <div class="list-item-actions">
        <button class="btn-icon edit" onclick="editIncome('${item.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button class="btn-icon delete" onclick="deleteIncome('${item.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

// ========================================
// EXPENSES LIST
// ========================================
function renderExpensesList() {
  const container = document.getElementById('expensesList');
  const emptyState = document.getElementById('expensesEmpty');
  if (!container) return;

  if (expensesData.length === 0) {
    container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  container.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = expensesData.map(item => {
    const dueDate = item.due_date ? new Date(item.due_date).toLocaleDateString() : '';
    const recurringBadge = item.recurring ? '<span class="badge badge-recurring">Recurring</span>' : '';
    return `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-title">${item.name || item.category}</div>
        <div class="list-item-subtitle">
          ${item.category} ${recurringBadge} ${dueDate ? `· Due: ${dueDate}` : ''}
        </div>
      </div>
      <div class="list-item-amount" style="color: var(--danger);">
        $${parseFloat(item.amount).toFixed(2)}
      </div>
      <div class="list-item-actions">
        <button class="btn-icon edit" onclick="editExpense('${item.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
        </button>
        <button class="btn-icon delete" onclick="deleteExpense('${item.id}')">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
  }).join('');
}

// ========================================
// INCOME CRUD
// ========================================
function openIncomeModal() {
  document.getElementById('incomeModalTitle').textContent = 'Add Income';
  document.getElementById('incomeForm').reset();
  document.getElementById('incomeId').value = '';
  showModal('incomeModal');
}

function closeIncomeModal() {
  hideModal('incomeModal');
}

async function editIncome(id) {
  const income = incomeData.find(item => item.id === id);
  if (!income) return;

  document.getElementById('incomeModalTitle').textContent = 'Edit Income';
  document.getElementById('incomeId').value = income.id;
  document.getElementById('incomeSource').value = income.source;
  document.getElementById('incomeAmount').value = income.amount;
  document.getElementById('incomeFrequency').value = income.frequency;
  showModal('incomeModal');
}

async function handleIncomeSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('incomeId').value;
  const source = document.getElementById('incomeSource').value;
  const amount = document.getElementById('incomeAmount').value;
  const frequency = document.getElementById('incomeFrequency').value;

  try {
    if (id) {
      // Update
      const { error } = await supabase
        .from('income')
        .update({ source, amount, frequency })
        .eq('id', id);

      if (error) throw error;
      showToast('Income updated', 'success');
    } else {
      // Insert
      const { error } = await supabase
        .from('income')
        .insert([{ user_id: currentUser.id, source, amount, frequency }]);

      if (error) throw error;
      showToast('Income added', 'success');
    }

    closeIncomeModal();
    await loadIncomeData();
    updateDashboard();
  } catch (error) {
    showToast('Failed to save income', 'error');
  }
}

function deleteIncome(id) {
  showDeleteConfirm('Delete Income', 'Are you sure you want to delete this income source?', async () => {
    try {
      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Income deleted', 'success');
      await loadIncomeData();
      updateDashboard();
    } catch (error) {
      showToast('Failed to delete income', 'error');
    }
  });
}

// ========================================
// EXPENSE CRUD
// ========================================
function openExpenseModal() {
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value = '';
  
  // Set min date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDueDate').min = today;
  
  showModal('expenseModal');
}

function closeExpenseModal() {
  hideModal('expenseModal');
}

async function editExpense(id) {
  const expense = expensesData.find(item => item.id === id);
  if (!expense) return;

  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseId').value = expense.id;
  document.getElementById('expenseName').value = expense.name || '';
  document.getElementById('expenseCategory').value = expense.category || '';
  document.getElementById('expenseAmount').value = expense.amount;
  document.getElementById('expenseDueDate').value = expense.due_date || '';
  document.getElementById('expenseRecurring').checked = expense.recurring || false;
  showModal('expenseModal');
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('expenseId').value;
  const name = document.getElementById('expenseName').value;
  const category = document.getElementById('expenseCategory').value;
  const amount = document.getElementById('expenseAmount').value;
  const dueDate = document.getElementById('expenseDueDate').value;
  const recurring = document.getElementById('expenseRecurring').checked;

  // Validate due date is not in the past
  const selectedDate = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    showToast('Due date cannot be in the past', 'error');
    return;
  }

  try {
    if (id) {
      // Update
      const { error } = await supabase
        .from('expenses')
        .update({ name, category, amount, due_date: dueDate, recurring })
        .eq('id', id);

      if (error) throw error;
      showToast('Expense updated', 'success');
    } else {
      // Insert
      const { error } = await supabase
        .from('expenses')
        .insert([{ user_id: currentUser.id, name, category, amount, due_date: dueDate, recurring }]);

      if (error) throw error;
      showToast('Expense added', 'success');
    }

    closeExpenseModal();
    await loadExpensesData();
    updateDashboard();
  } catch (error) {
    showToast('Failed to save expense', 'error');
  }
}

function deleteExpense(id) {
  showDeleteConfirm('Delete Expense', 'Are you sure you want to delete this expense?', async () => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Expense deleted', 'success');
      await loadExpensesData();
      updateDashboard();
    } catch (error) {
      showToast('Failed to delete expense', 'error');
    }
  });
}

// ========================================
// PASSWORD CHANGE
// ========================================
function openPasswordModal() {
  document.getElementById('passwordForm').reset();
  showModal('passwordModal');
  // Initialize password strength visualizer
  initPasswordStrengthVisualizer('newPassword');
}

function closePasswordModal() {
  hideModal('passwordModal');
}

async function handlePasswordSubmit(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }

  if (!validatePasswordStrength(newPassword)) {
    showToast('Password must meet all requirements (8+ characters with lowercase, uppercase, number, and symbol)', 'error');
    return;
  }

  try {
    // User already authenticated via guard.js - no need to re-check AAL here
    // guard.js ensures proper AAL level before page loads
    
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      showToast('Password changed successfully. You will now be signed out.', 'success');
      closePasswordModal();
      
      // User will be signed out by Edge Function - redirect to login after short delay
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } else {
      // Show user-friendly error messages
      let errorMessage = result.error || 'Failed to update password';
      
      if (errorMessage.includes('requiresMFA') || errorMessage.includes('AAL2') || errorMessage.includes('MFA verification')) {
        errorMessage = 'MFA verification required. Please complete the MFA challenge before changing your password.';
      }
      
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    showToast('Failed to update password', 'error');
  }
}

// ========================================
// MFA MANAGEMENT
// ========================================
async function checkMFAStatus() {
  const statusText = document.getElementById('mfaStatusText');
  const statusBadge = document.getElementById('mfaStatusBadge');
  const enableBtn = document.getElementById('enableMFABtn');
  const disableBtn = document.getElementById('disableMFABtn');

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const factors = user?.factors || [];
    const hasMFA = factors.some(f => f.status === 'verified');

    if (hasMFA) {
      statusText.textContent = 'Enabled';
      statusBadge.innerHTML = `
        <svg class="status-icon status-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"></circle>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4"></path>
        </svg>
      `;
      enableBtn.style.display = 'none';
      disableBtn.style.display = 'inline-block';
    } else {
      statusText.textContent = 'Disabled';
      statusBadge.innerHTML = `
        <svg class="status-icon status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"></circle>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 15L15 9M9 9l6 6"></path>
        </svg>
      `;
      enableBtn.style.display = 'inline-block';
      disableBtn.style.display = 'none';
    }
  } catch (error) {
    statusText.textContent = 'Error';
    statusBadge.innerHTML = '';
  }
}

function openEnableMFAModal() {
  showModal('enableMFAModal');
  showMFAStep1();
  enrollMFAProcess();
}

function closeEnableMFAModal() {
  hideModal('enableMFAModal');
  currentMFAFactorId = null;
  document.getElementById('mfaVerifyCode').value = '';
}

let currentMFAFactorId = null;

async function enrollMFAProcess() {
  try {
    // First check if there are existing unverified factors and clean them up
    const { data: { user } } = await supabase.auth.getUser();
    const existingFactors = user?.factors || [];
    
    // Unenroll any unverified factors to avoid conflicts
    for (const factor of existingFactors) {
      if (factor.status !== 'verified') {
        try {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
          console.log('Cleaned up unverified factor:', factor.id);
        } catch (err) {
          console.log('Could not unenroll factor:', err);
        }
      }
    }
    
    // Now attempt to enroll
    const result = await enrollMFA();
    if (result.success) {
      currentMFAFactorId = result.factorId;
      const qrContainer = document.getElementById('qrCodeContainer');
      const secretKeyText = document.getElementById('secretKeyText');
      
      // Clear container first
      qrContainer.innerHTML = '';
      
      // Create and append image element
      const img = document.createElement('img');
      img.src = result.qrCode;
      img.alt = 'MFA QR Code';
      qrContainer.appendChild(img);
      
      // Set secret key
      secretKeyText.textContent = result.secret;
    } else {
      showToast(result.error || 'Failed to start MFA enrollment', 'error');
      closeEnableMFAModal();
    }
  } catch (error) {
    console.error('MFA enrollment error:', error);
    showToast('Failed to start MFA enrollment', 'error');
    closeEnableMFAModal();
  }
}

function copySecretKey() {
  const secretKey = document.getElementById('secretKeyText').textContent;
  navigator.clipboard.writeText(secretKey).then(() => {
    showToast('Secret key copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function copyRecoveryCodes() {
  const codesContainer = document.getElementById('recoveryCodesDisplay');
  const codes = Array.from(codesContainer.querySelectorAll('.recovery-code'))
    .map(el => el.textContent)
    .join('\n');
  
  navigator.clipboard.writeText(codes).then(() => {
    showToast('Recovery codes copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

function showMFAStep1() {
  document.getElementById('mfaStep1').style.display = 'block';
  document.getElementById('mfaStep2').style.display = 'none';
  document.getElementById('mfaStep3').style.display = 'none';
}

function showMFAStep2() {
  document.getElementById('mfaStep1').style.display = 'none';
  document.getElementById('mfaStep2').style.display = 'block';
  document.getElementById('mfaStep3').style.display = 'none';
}

function showMFAStep3() {
  document.getElementById('mfaStep1').style.display = 'none';
  document.getElementById('mfaStep2').style.display = 'none';
  document.getElementById('mfaStep3').style.display = 'block';
}

async function handleMFAVerify(e) {
  e.preventDefault();
  const code = document.getElementById('mfaVerifyCode').value;

  if (!currentMFAFactorId) {
    showToast('MFA setup error. Please try again.', 'error');
    closeEnableMFAModal();
    return;
  }

  try {
    const result = await verifyMFAEnrollment(currentMFAFactorId, code);
    if (result.success) {
      showMFAStep3();
      displayRecoveryCodes(result.recoveryCodes);
      await checkMFAStatus();
      showToast('MFA enabled successfully', 'success');
    } else {
      showToast(result.error || 'Invalid code', 'error');
    }
  } catch (error) {
    showToast('Verification failed', 'error');
  }
}

function displayRecoveryCodes(codes) {
  const container = document.getElementById('recoveryCodesDisplay');
  if (!codes || codes.length === 0) return;

  container.innerHTML = codes.map(code => 
    `<div class="recovery-code">${code}</div>`
  ).join('');
}

function openDisableMFAModal() {
  showModal('disableMFAModal');
}

function closeDisableMFAModal() {
  hideModal('disableMFAModal');
}

async function handleDisableMFA(e) {
  if (e) e.preventDefault();
  
  const password = document.getElementById('disableMfaPassword').value;
  const mfaCode = document.getElementById('disableMfaCode').value;
  
  if (!password || !mfaCode) {
    showToast('Please provide both password and MFA code', 'error');
    return;
  }
  
  try {
    const result = await disableMFA(password, mfaCode);
    if (result.success) {
      showToast('2FA disabled successfully. You will now be signed out.', 'success');
      closeDisableMFAModal();
      document.getElementById('disableMfaPassword').value = '';
      document.getElementById('disableMfaCode').value = '';
      
      // User will be signed out by Edge Function - redirect to login after short delay
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } else {
      // Show user-friendly error messages
      let errorMessage = result.error || 'Failed to disable 2FA';
      
      if (result.requiresAAL2) {
        errorMessage = 'Session expired. Please refresh the page and complete MFA verification again.';
      }
      
      showToast(errorMessage, 'error');
    }
  } catch (error) {
    console.error('Disable MFA error:', error);
    showToast('Failed to disable 2FA', 'error');
  }
}

// ========================================
// DELETE ACCOUNT
// ========================================
function openDeleteAccountModal() {
  showModal('deleteAccountModal');
}

function closeDeleteAccountModal() {
  hideModal('deleteAccountModal');
}

// ========================================
// MOBILE MENU
// ========================================
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  menu.classList.toggle('active');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('active');
}

// ========================================
// LOGOUT
// ========================================
async function handleLogout() {
  try {
    const result = await logout();
    if (result.success) {
      window.location.href = 'index.html';
    }
  } catch (error) {
    showToast('Logout failed', 'error');
  }
}

// ========================================
// MODAL HELPERS
// ========================================
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Delete confirmation modal
let pendingDeleteCallback = null;

function showDeleteConfirm(title, message, onConfirm) {
  document.getElementById('deleteConfirmTitle').textContent = title;
  document.getElementById('deleteConfirmMessage').textContent = message;
  pendingDeleteCallback = onConfirm;
  showModal('deleteConfirmModal');
}

function closeDeleteConfirmModal() {
  hideModal('deleteConfirmModal');
  pendingDeleteCallback = null;
}

function confirmDelete() {
  if (pendingDeleteCallback) {
    pendingDeleteCallback();
  }
  closeDeleteConfirmModal();
}

// ========================================
// USERNAME UPDATE
// ========================================
async function handleUsernameUpdate(e) {
  e.preventDefault();
  
  const username = document.getElementById('usernameInput').value.trim();
  
  if (!username) {
    showToast('Please enter a username', 'error');
    return;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: username })
      .eq('id', currentUser.id);

    if (error) throw error;

    showToast('Username updated successfully', 'success');
    await updateUserDisplay();
  } catch (error) {
    console.error('Error updating username:', error);
    showToast('Failed to update username', 'error');
  }
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ========================================
// EVENT LISTENERS SETUP
// ========================================
function setupEventListeners() {
  // Desktop sidebar nav
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Mobile menu
  document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleMobileMenu);
  document.getElementById('closeMobileMenu')?.addEventListener('click', closeMobileMenu);
  document.getElementById('mobileMenu')?.addEventListener('click', (e) => {
    if (e.target.id === 'mobileMenu') closeMobileMenu();
  });

  // Menu actions
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', handleLogout);
  });

  document.querySelectorAll('[data-action="profile"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeMobileMenu();
      switchTab('profile');
    });
  });

  // Click sidebar user section to open profile
  document.getElementById('sidebarUserBtn')?.addEventListener('click', () => {
    switchTab('profile');
  });

  // Click mobile menu user section to open profile
  document.querySelector('.menu-user-info')?.addEventListener('click', () => {
    closeMobileMenu();
    switchTab('profile');
  });

  // Income
  document.getElementById('addIncomeBtn')?.addEventListener('click', openIncomeModal);
  document.getElementById('addIncomeBtnDesktop')?.addEventListener('click', openIncomeModal);
  document.getElementById('incomeForm')?.addEventListener('submit', handleIncomeSubmit);

  // Expenses
  document.getElementById('addExpenseBtn')?.addEventListener('click', openExpenseModal);
  document.getElementById('addExpenseBtnDesktop')?.addEventListener('click', openExpenseModal);
  document.getElementById('expenseForm')?.addEventListener('submit', handleExpenseSubmit);

  // Password
  document.getElementById('changePasswordBtn')?.addEventListener('click', openPasswordModal);
  document.getElementById('passwordForm')?.addEventListener('submit', handlePasswordSubmit);

  // MFA
  document.getElementById('enableMFABtn')?.addEventListener('click', openEnableMFAModal);
  document.getElementById('disableMFABtn')?.addEventListener('click', openDisableMFAModal);
  document.getElementById('verifyMFAForm')?.addEventListener('submit', handleMFAVerify);

  // Delete account
  document.getElementById('deleteAccountBtn')?.addEventListener('click', openDeleteAccountModal);

  // Username update
  document.getElementById('updateUsernameForm')?.addEventListener('submit', handleUsernameUpdate);

  // Modal overlays (close on background click)
  // Track mousedown location to ensure both down and up happen on overlay
  let mouseDownTarget = null;
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('mousedown', (e) => {
      mouseDownTarget = e.target;
    });
    
    overlay.addEventListener('click', (e) => {
      // Only close if both mousedown and click occurred on the overlay (not modal content)
      if (e.target === overlay && mouseDownTarget === overlay) {
        overlay.classList.remove('active');
      }
      mouseDownTarget = null;
    });
  });
}
