/* ============================================================================
   Custom UI Components
   ============================================================================
   Custom dropdowns, date picker, number inputs, context menu
   ============================================================================ */

// Helper to resolve element from selector or element
function resolveElement(elementOrSelector) {
  if (typeof elementOrSelector === 'string') {
    return document.querySelector(elementOrSelector);
  }
  return elementOrSelector;
}

// ============================================================================
// Custom Select Dropdown
// ============================================================================
class CustomSelect {
  constructor(elementOrSelector, options = {}) {
    this.element = resolveElement(elementOrSelector);
    if (!this.element) return;
    
    this.trigger = this.element.querySelector('.custom-select-trigger');
    this.options = this.element.querySelector('.custom-select-options');
    this.hiddenInput = this.element.querySelector('input[type="hidden"]');
    this.items = this.element.querySelectorAll('.custom-select-option');
    this.valueDisplay = this.trigger?.querySelector('.custom-select-value');
    
    this.isOpen = false;
    this.init();
  }
  
  init() {
    if (!this.trigger) return;
    
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    this.items.forEach(item => {
      item.addEventListener('click', () => this.select(item));
    });
    
    document.addEventListener('click', () => this.close());
  }
  
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  
  open() {
    this.element.classList.add('open');
    this.isOpen = true;
  }
  
  close() {
    this.element.classList.remove('open');
    this.isOpen = false;
  }
  
  select(item) {
    const value = item.dataset.value;
    const label = item.textContent;
    
    this.items.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    
    if (this.hiddenInput) this.hiddenInput.value = value;
    if (this.valueDisplay) this.valueDisplay.textContent = label;
    
    this.element.dispatchEvent(new CustomEvent('change', { detail: { value, label } }));
    this.close();
  }
  
  setValue(value) {
    const item = Array.from(this.items).find(i => i.dataset.value === value);
    if (item) this.select(item);
  }
}

// ============================================================================
// Custom Date Picker
// ============================================================================
class DatePicker {
  constructor(elementOrSelector, options = {}) {
    this.container = resolveElement(elementOrSelector);
    if (!this.container) return;
    
    this.options = options;
    this.currentDate = new Date();
    this.selectedDate = options.defaultDate ? new Date(options.defaultDate) : null;
    this.viewDate = this.selectedDate ? new Date(this.selectedDate) : new Date();
    
    this.monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    this.dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    
    this.isOpen = false;
    this.build();
    this.init();
  }
  
  build() {
    this.container.innerHTML = `
      <div class="date-picker">
        <input type="text" class="input date-picker-input" placeholder="${this.options.placeholder || 'Select date'}" readonly>
        <input type="hidden" name="${this.options.name || ''}">
        <div class="date-picker-dropdown"></div>
      </div>
    `;
    
    this.element = this.container.querySelector('.date-picker');
    this.input = this.container.querySelector('.date-picker-input');
    this.dropdown = this.container.querySelector('.date-picker-dropdown');
    this.hiddenInput = this.container.querySelector('input[type="hidden"]');
  }
  
  init() {
    this.buildDropdown();
    
    this.input.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) this.close();
    });
    
    // Set initial date if provided
    if (this.selectedDate) {
      this.updateInput();
    }
  }
  
  buildDropdown() {
    this.dropdown.innerHTML = `
      <div class="date-picker-header">
        <button type="button" class="date-picker-nav-btn" data-action="prev-month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span class="date-picker-month"></span>
        <button type="button" class="date-picker-nav-btn" data-action="next-month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="date-picker-weekdays">
        ${this.dayNames.map(d => `<span class="date-picker-weekday">${d}</span>`).join('')}
      </div>
      <div class="date-picker-days"></div>
    `;
    
    this.dropdown.querySelector('[data-action="prev-month"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevMonth();
    });
    
    this.dropdown.querySelector('[data-action="next-month"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextMonth();
    });
    
    this.render();
  }
  
  render() {
    const monthLabel = this.dropdown.querySelector('.date-picker-month');
    monthLabel.textContent = `${this.monthNames[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`;
    
    const daysContainer = this.dropdown.querySelector('.date-picker-days');
    daysContainer.innerHTML = '';
    
    const firstDay = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const lastDay = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 0);
    const startPadding = firstDay.getDay();
    
    // Previous month days
    const prevLastDay = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      const day = document.createElement('button');
      day.type = 'button';
      day.className = 'date-picker-day other-month';
      day.textContent = prevLastDay - i;
      daysContainer.appendChild(day);
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const day = document.createElement('button');
      day.type = 'button';
      day.className = 'date-picker-day';
      day.textContent = i;
      day.dataset.date = `${this.viewDate.getFullYear()}-${String(this.viewDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      const thisDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), i);
      
      if (this.isToday(thisDate)) day.classList.add('today');
      if (this.isSelected(thisDate)) day.classList.add('selected');
      
      day.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectDate(day.dataset.date);
      });
      
      daysContainer.appendChild(day);
    }
    
    // Next month days
    const remaining = 42 - daysContainer.children.length;
    for (let i = 1; i <= remaining; i++) {
      const day = document.createElement('button');
      day.type = 'button';
      day.className = 'date-picker-day other-month';
      day.textContent = i;
      daysContainer.appendChild(day);
    }
  }
  
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
  
  isSelected(date) {
    return this.selectedDate && date.toDateString() === this.selectedDate.toDateString();
  }
  
  selectDate(dateStr) {
    this.selectedDate = new Date(dateStr);
    if (this.hiddenInput) this.hiddenInput.value = dateStr;
    this.updateInput();
    this.render();
    this.close();
    
    this.element.dispatchEvent(new CustomEvent('change', { detail: { date: dateStr } }));
  }
  
  updateInput() {
    if (this.selectedDate) {
      const formatted = this.selectedDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      this.input.value = formatted;
    }
  }
  
  prevMonth() {
    this.viewDate.setMonth(this.viewDate.getMonth() - 1);
    this.render();
  }
  
  nextMonth() {
    this.viewDate.setMonth(this.viewDate.getMonth() + 1);
    this.render();
  }
  
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  
  open() {
    this.element.classList.add('open');
    this.isOpen = true;
  }
  
  close() {
    this.element.classList.remove('open');
    this.isOpen = false;
  }
  
  getValue() {
    return this.hiddenInput ? this.hiddenInput.value : null;
  }
  
  setValue(dateStr) {
    if (!dateStr) return;
    this.selectedDate = new Date(dateStr);
    this.viewDate = new Date(this.selectedDate);
    // Store as YYYY-MM-DD format
    const formatted = this.selectedDate.toISOString().split('T')[0];
    if (this.hiddenInput) this.hiddenInput.value = formatted;
    this.updateInput();
    this.render();
  }
}

// ============================================================================
// Custom Number Input
// ============================================================================
class NumberInput {
  constructor(elementOrSelector, options = {}) {
    this.container = resolveElement(elementOrSelector);
    if (!this.container) return;
    
    this.options = options;
    this.min = options.min !== undefined ? options.min : -Infinity;
    this.max = options.max !== undefined ? options.max : Infinity;
    this.step = options.step !== undefined ? options.step : 1;
    
    this.build();
    this.init();
  }
  
  build() {
    const prefix = this.options.prefix || '';
    this.container.innerHTML = `
      <div class="number-input">
        <button type="button" class="number-input-btn" data-action="minus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <div class="number-input-field">
          ${prefix ? `<span class="number-input-prefix">${prefix}</span>` : ''}
          <input type="number" class="input" placeholder="${this.options.placeholder || '0'}" 
                 min="${this.min !== -Infinity ? this.min : ''}" 
                 max="${this.max !== Infinity ? this.max : ''}" 
                 step="${this.step}">
        </div>
        <button type="button" class="number-input-btn" data-action="plus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    `;
    
    this.element = this.container.querySelector('.number-input');
    this.input = this.container.querySelector('input');
    this.minusBtn = this.container.querySelector('[data-action="minus"]');
    this.plusBtn = this.container.querySelector('[data-action="plus"]');
  }
  
  init() {
    this.minusBtn?.addEventListener('click', () => this.decrement());
    this.plusBtn?.addEventListener('click', () => this.increment());
    
    this.input.addEventListener('change', () => this.validate());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); this.increment(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.decrement(); }
    });
  }
  
  getValue() {
    return parseFloat(this.input.value) || 0;
  }
  
  setValue(value) {
    this.input.value = Math.min(this.max, Math.max(this.min, value));
    this.input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  increment() {
    this.setValue(this.getValue() + this.step);
  }
  
  decrement() {
    this.setValue(this.getValue() - this.step);
  }
  
  validate() {
    let value = this.getValue();
    value = Math.min(this.max, Math.max(this.min, value));
    this.input.value = value;
  }
}

// ============================================================================
// Context Menu
// ============================================================================
class ContextMenu {
  constructor() {
    this.menu = null;
    this.currentTarget = null;
    this.init();
  }
  
  init() {
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', (e) => {
      // Only handle elements with data-context-menu
      if (!e.target.closest('[data-context-menu]')) return;
    });
    window.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
  }
  
  show(e, items, target) {
    e.preventDefault();
    this.hide();
    
    this.currentTarget = target;
    this.menu = document.createElement('div');
    this.menu.className = 'context-menu';
    
    items.forEach(item => {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        this.menu.appendChild(divider);
      } else {
        const btn = document.createElement('button');
        btn.className = `context-menu-item${item.danger ? ' danger' : ''}`;
        btn.innerHTML = `
          ${item.icon || ''}
          <span>${item.label}</span>
        `;
        btn.addEventListener('click', () => {
          item.action(this.currentTarget);
          this.hide();
        });
        this.menu.appendChild(btn);
      }
    });
    
    document.body.appendChild(this.menu);
    
    // Position the menu
    const menuRect = this.menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuRect.width > window.innerWidth) {
      x = window.innerWidth - menuRect.width - 8;
    }
    if (y + menuRect.height > window.innerHeight) {
      y = window.innerHeight - menuRect.height - 8;
    }
    
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.menu.classList.add('visible');
    });
  }
  
  hide() {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
      this.currentTarget = null;
    }
  }
}

// Global context menu instance
const contextMenu = new ContextMenu();

// ============================================================================
// Mobile Navigation
// ============================================================================
function initMobileNav() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!menuBtn || !sidebar) return;
  
  function openMenu() {
    sidebar.classList.add('open');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  function closeMenu() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  menuBtn.addEventListener('click', openMenu);
  overlay?.addEventListener('click', closeMenu);
  
  // Close on nav item click (mobile)
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', closeMenu);
  });
}

// ============================================================================
// Theme Toggle
// ============================================================================
function initTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ============================================================================
// Toast Notifications
// ============================================================================
class Toast {
  static container = null;
  
  static init() {
    if (!Toast.container) {
      Toast.container = document.createElement('div');
      Toast.container.className = 'toast-container';
      Toast.container.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 16px;
        z-index: 600;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;
      document.body.appendChild(Toast.container);
    }
  }
  
  static show(message, type = 'info', duration = 3000) {
    Toast.init();
    
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = `
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      min-width: 280px;
      box-shadow: var(--shadow-lg);
    `;
    toast.textContent = message;
    
    Toast.container.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  static success(message) { Toast.show(message, 'success'); }
  static error(message) { Toast.show(message, 'error'); }
  static warning(message) { Toast.show(message, 'warning'); }
  static info(message) { Toast.show(message, 'info'); }
}

// ============================================================================
// Modal Dialog
// ============================================================================
class Modal {
  constructor(options = {}) {
    this.options = {
      title: options.title || '',
      content: options.content || '',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      confirmClass: options.confirmClass || 'btn-primary',
      showCancel: options.showCancel !== false,
      danger: options.danger || false,
      onConfirm: options.onConfirm || (() => {}),
      onCancel: options.onCancel || (() => {}),
      closeOnOverlay: options.closeOnOverlay !== false
    };
    
    this.overlay = null;
    this.build();
  }
  
  build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    
    const confirmClass = this.options.danger ? 'btn-danger' : this.options.confirmClass;
    
    this.overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${this.options.title}</h3>
          <button class="modal-close" data-action="close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          ${this.options.content}
        </div>
        <div class="modal-footer">
          ${this.options.showCancel ? `<button class="btn btn-secondary" data-action="cancel">${this.options.cancelText}</button>` : ''}
          <button class="btn ${confirmClass}" data-action="confirm">${this.options.confirmText}</button>
        </div>
      </div>
    `;
    
    // Bind events
    this.overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());
    this.overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      this.options.onCancel();
      this.close();
    });
    this.overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
      this.options.onConfirm();
      this.close();
    });
    
    if (this.options.closeOnOverlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });
    }
    
    // Close on Escape
    this.handleKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
  }
  
  show() {
    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.handleKeydown);
    document.body.style.overflow = 'hidden';
    
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
    
    return this;
  }
  
  close() {
    this.overlay.classList.remove('visible');
    document.removeEventListener('keydown', this.handleKeydown);
    document.body.style.overflow = '';
    
    setTimeout(() => {
      this.overlay.remove();
    }, 300);
  }
  
  // Static helper methods
  static confirm(options) {
    return new Promise((resolve) => {
      new Modal({
        ...options,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      }).show();
    });
  }
  
  static alert(options) {
    return new Promise((resolve) => {
      new Modal({
        ...options,
        showCancel: false,
        onConfirm: () => resolve(true)
      }).show();
    });
  }
  
  static danger(options) {
    return Modal.confirm({
      ...options,
      danger: true,
      confirmClass: 'btn-danger'
    });
  }
}

// ============================================================================
// Initialize Custom Components
// ============================================================================
function initCustomComponents() {
  // Initialize custom selects
  document.querySelectorAll('.custom-select').forEach(el => new CustomSelect(el));
  
  // Initialize date pickers
  document.querySelectorAll('.date-picker').forEach(el => new DatePicker(el));
  
  // Initialize number inputs
  document.querySelectorAll('.number-input').forEach(el => new NumberInput(el));
}

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  initCustomComponents();
});
