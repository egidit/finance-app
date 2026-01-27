// ============================================================================
// Categories Data Access Layer
// ============================================================================
// Centralized module for loading categories from backend and managing
// status colors consistently across the application.
// ============================================================================

// Cache for categories to avoid repeated database calls
let categoriesCache = null;
let categoriesCacheUserId = null;

// Predefined color palette for category creation (10 colors)
const CATEGORY_COLOR_PALETTE = [
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Gray', value: '#64748b' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Teal', value: '#14b8a6' }
];

// Centralized subscription status colors
const STATUS_COLORS = {
  active: {
    badge: 'badge-success',
    color: 'var(--color-success)',
    bgColor: 'var(--color-success-light)',
    text: 'Active'
  },
  inactive: {
    badge: 'badge-default',
    color: 'var(--text-muted)',
    bgColor: 'var(--bg-muted)',
    text: 'Inactive'
  }
};

/**
 * Load all categories (global + user-specific) from database
 * @param {Object} client - Supabase client instance
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of category objects
 */
async function loadCategories(client, forceRefresh = false) {
  if (!client) {
    console.error('Supabase client required');
    return [];
  }

  const { data: { user } } = await client.auth.getUser();
  const userId = user?.id;

  // Return cached if valid
  if (!forceRefresh && categoriesCache && categoriesCacheUserId === userId) {
    return categoriesCache;
  }

  try {
    // RLS policy will return global categories (user_id IS NULL) + user's own
    const { data, error } = await client
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;

    categoriesCache = data || [];
    categoriesCacheUserId = userId;
    return categoriesCache;
  } catch (err) {
    console.error('Error loading categories:', err);
    return [];
  }
}

/**
 * Get a category by name
 * @param {Array} categories - Array of categories
 * @param {string} name - Category name to find
 * @returns {Object|null} Category object or null
 */
function getCategoryByName(categories, name) {
  if (!name || !categories) return null;
  return categories.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Get category color by name
 * @param {Array} categories - Array of categories
 * @param {string} name - Category name
 * @returns {string} Hex color or default gray
 */
function getCategoryColor(categories, name) {
  const category = getCategoryByName(categories, name);
  return category?.color || '#94a3b8'; // Default gray
}

/**
 * Format category name for display (capitalize first letter)
 * @param {string} name - Category name (lowercase)
 * @returns {string} Formatted name
 */
function formatCategoryName(name) {
  if (!name) return 'Uncategorized';
  if (name === 'uncategorized') return 'Uncategorized';
  // Handle special cases
  if (name === 'health') return 'Health & Fitness';
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
}

/**
 * Create a new user category
 * @param {Object} client - Supabase client
 * @param {string} name - Category name
 * @param {string} color - Hex color
 * @returns {Promise<Object>} Created category or error
 */
async function createCategory(client, name, color) {
  if (!client) throw new Error('Supabase client required');

  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await client
    .from('categories')
    .insert({
      name: name.toLowerCase().trim(),
      color: color,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  categoriesCache = null;
  return data;
}

/**
 * Update a user category
 * @param {Object} client - Supabase client
 * @param {string} id - Category ID
 * @param {Object} updates - Fields to update (name, color)
 * @returns {Promise<Object>} Updated category or error
 */
async function updateCategory(client, id, updates) {
  if (!client) throw new Error('Supabase client required');

  const updateData = {};
  if (updates.name) updateData.name = updates.name.toLowerCase().trim();
  if (updates.color) updateData.color = updates.color;

  const { data, error } = await client
    .from('categories')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  categoriesCache = null;
  return data;
}

/**
 * Delete a user category
 * @param {Object} client - Supabase client
 * @param {string} id - Category ID
 * @returns {Promise<void>}
 */
async function deleteCategory(client, id) {
  if (!client) throw new Error('Supabase client required');

  const { error } = await client
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Invalidate cache
  categoriesCache = null;
}

/**
 * Check if a category is global (default/system category)
 * @param {Object} category - Category object
 * @returns {boolean}
 */
function isGlobalCategory(category) {
  return category && category.user_id === null;
}

/**
 * Get status display info
 * @param {boolean} isActive - Status boolean
 * @returns {Object} Status display info
 */
function getStatusInfo(isActive) {
  return isActive ? STATUS_COLORS.active : STATUS_COLORS.inactive;
}

/**
 * Render a category badge with color
 * @param {Array} categories - Array of categories
 * @param {string} name - Category name
 * @returns {string} HTML string for badge
 */
function renderCategoryBadge(categories, name) {
  const color = getCategoryColor(categories, name);
  const displayName = formatCategoryName(name);
  return `<span class="badge" style="background: ${color}15; color: ${color}; border: 1px solid ${color}40;">${displayName}</span>`;
}

/**
 * Render a status badge
 * @param {boolean} isActive - Status boolean
 * @returns {string} HTML string for badge
 */
function renderStatusBadge(isActive) {
  const info = getStatusInfo(isActive);
  return `<span class="badge ${info.badge}">${info.text}</span>`;
}

/**
 * Populate a select dropdown with categories
 * @param {HTMLSelectElement} selectEl - Select element
 * @param {Array} categories - Array of categories
 * @param {string} selectedValue - Currently selected value
 * @param {boolean} includeEmpty - Include empty option
 */
function populateCategorySelect(selectEl, categories, selectedValue = '', includeEmpty = true) {
  if (!selectEl || !categories) return;

  selectEl.innerHTML = '';

  if (includeEmpty) {
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Select category';
    selectEl.appendChild(emptyOption);
  }

  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = formatCategoryName(cat.name);
    option.style.color = cat.color;
    if (cat.name === selectedValue) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

/**
 * Render color palette swatches for selection
 * @param {string} containerId - Container element ID
 * @param {string} selectedColor - Currently selected color
 * @param {Function} onSelect - Callback when color selected
 */
function renderColorPalette(containerId, selectedColor, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = CATEGORY_COLOR_PALETTE.map(color => `
    <button type="button"
            class="color-swatch ${color.value === selectedColor ? 'selected' : ''}"
            data-color="${color.value}"
            style="background-color: ${color.value};"
            title="${color.name}">
    </button>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      if (onSelect) onSelect(swatch.dataset.color);
    });
  });
}

/**
 * Clear categories cache (call when user signs out)
 */
function clearCategoriesCache() {
  categoriesCache = null;
  categoriesCacheUserId = null;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.CategoriesAPI = {
    loadCategories,
    getCategoryByName,
    getCategoryColor,
    formatCategoryName,
    createCategory,
    updateCategory,
    deleteCategory,
    isGlobalCategory,
    getStatusInfo,
    renderCategoryBadge,
    renderStatusBadge,
    populateCategorySelect,
    renderColorPalette,
    clearCategoriesCache,
    CATEGORY_COLOR_PALETTE,
    STATUS_COLORS
  };
}
