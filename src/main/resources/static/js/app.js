/**
 * NOVA E-Commerce Application Frontend
 * Supports User Mode (Shopper), Seller Mode (Inventory Hub), and Admin Mode (Operations Dashboard)
 */

// Application State
const state = {
    currentMode: 'user', // 'user' | 'seller' | 'admin'
    token: localStorage.getItem('nova_auth_token') || null,
    currentUser: JSON.parse(localStorage.getItem('nova_auth_user') || 'null'),
    products: [],
    categories: [],
    cart: JSON.parse(localStorage.getItem('nova_cart') || '[]'),
    currentCategory: 'all',
    searchQuery: '',
    currentSort: 'default',
    lastPlacedOrder: null,
    sellerFilterQuery: '',
    adminOrders: [],
    adminSellers: [],
    adminUsers: [],
    adminSellersFilter: '',
    adminUsersFilter: '',
    adminCurrentTab: 'orders',
    sellerCurrentTab: 'inventory'
};

// Authenticated fetch wrapper (attaches JWT Bearer token automatically)
async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (state.token) {
        options.headers['Authorization'] = `Bearer ${state.token}`;
    }
    if (!options.headers['Content-Type'] && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }
    return fetch(url, options);
}

// Indian Currency Formatter (₹ INR)
function formatINR(val) {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    return Number(val).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// DOM Content Loaded Entrypoint
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initAuth();
    setupEventListeners();
    updateCartBadge();
    await fetchCategories();
    await loadProducts();

    // Check URL hash for initial mode
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['user', 'seller', 'admin'].includes(hash)) {
        switchMode(hash);
    } else {
        switchMode('user');
    }

    window.addEventListener('hashchange', () => {
        const h = window.location.hash.replace('#', '').toLowerCase();
        if (['user', 'seller', 'admin'].includes(h) && h !== state.currentMode) {
            switchMode(h);
        }
    });
}

// -------------------------------------------------------------
// MODE SWITCHER (USER / SELLER / ADMIN) WITH RBAC ENFORCEMENT
// -------------------------------------------------------------
function switchMode(mode) {
    if (!['user', 'seller', 'admin'].includes(mode)) mode = 'user';

    // RBAC Security Gate
    if (mode === 'admin') {
        if (!state.currentUser || state.currentUser.role !== 'ROLE_ADMIN') {
            showToast('Access Denied: Master Admin credentials required.', 'error');
            openAuthModal('admin');
            return;
        }
    } else if (mode === 'seller') {
        if (!state.currentUser || (state.currentUser.role !== 'ROLE_SELLER' && state.currentUser.role !== 'ROLE_ADMIN')) {
            showToast('Access Denied: Seller account required to access Seller Hub.', 'error');
            openAuthModal('seller');
            return;
        }
    }

    state.currentMode = mode;
    window.location.hash = mode;

    // 1. Update Header Button Active Classes
    const modeConfigs = {
        user: { label: 'User Mode (Shopper)', brand: 'Store', color: 'bg-brand-600' },
        seller: { label: 'Seller Mode (Merchant)', brand: 'Seller Hub', color: 'bg-emerald-600' },
        admin: { label: 'Admin Mode (Executive)', brand: 'Admin Portal', color: 'bg-purple-600' }
    };

    const cfg = modeConfigs[mode];
    const labelEl = document.getElementById('activeModeLabel');
    const brandSubTag = document.getElementById('brandSubTag');
    if (labelEl) labelEl.innerText = cfg.label;
    if (brandSubTag) brandSubTag.innerText = cfg.brand;

    ['user', 'seller', 'admin'].forEach(m => {
        const btn = document.getElementById(`modeBtn${m.charAt(0).toUpperCase() + m.slice(1)}`);
        if (btn) {
            if (m === mode) {
                btn.className = `mode-btn px-3.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-2 ${cfg.color} text-white shadow-sm`;
            } else {
                btn.className = 'mode-btn px-3.5 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white transition-all flex items-center gap-2';
            }
        }
    });

    // 2. Toggle Mode Views
    document.getElementById('viewUserMode')?.classList.toggle('hidden', mode !== 'user');
    document.getElementById('viewSellerMode')?.classList.toggle('hidden', mode !== 'seller');
    document.getElementById('viewAdminMode')?.classList.toggle('hidden', mode !== 'admin');

    // 3. Toggle Header Search and Actions
    document.getElementById('userHeaderSearch')?.classList.toggle('hidden', mode !== 'user');
    document.getElementById('userMobileSearch')?.classList.toggle('hidden', mode !== 'user');
    document.getElementById('userHeaderActions')?.classList.toggle('hidden', mode !== 'user');
    document.getElementById('sellerHeaderActions')?.classList.toggle('hidden', mode !== 'seller');
    document.getElementById('sellerHeaderActions')?.classList.toggle('flex', mode === 'seller');
    document.getElementById('adminHeaderActions')?.classList.toggle('hidden', mode !== 'admin');
    document.getElementById('adminHeaderActions')?.classList.toggle('flex', mode === 'admin');

    // 4. Trigger View Refreshes
    if (mode === 'user') {
        renderProducts();
    } else if (mode === 'seller') {
        renderSellerView();
    } else if (mode === 'admin') {
        renderAdminView();
    }

    showToast(`Switched to ${cfg.label}`, 'info');
}

// -------------------------------------------------------------
// EVENT LISTENERS SETUP
// -------------------------------------------------------------
function setupEventListeners() {
    // User search inputs
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.trim();
            if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', state.searchQuery.length === 0);
            renderProducts();
        }, 250));
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            clearSearchBtn.classList.add('hidden');
            renderProducts();
        });
    }

    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.trim();
            renderProducts();
        }, 250));
    }

    // Cart and Orders trigger
    document.getElementById('openCartBtn')?.addEventListener('click', openCart);
    document.getElementById('openOrdersBtn')?.addEventListener('click', openOrdersModal);

    // Payment method selector
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.querySelectorAll('.payment-option').forEach(el => {
                el.classList.remove('border-brand-500', 'bg-brand-50/50');
                el.classList.add('border-slate-200');
            });
            const parentLabel = e.target.closest('.payment-option');
            if (parentLabel) {
                parentLabel.classList.add('border-brand-500', 'bg-brand-50/50');
                parentLabel.classList.remove('border-slate-200');
            }
            const val = e.target.value;
            const upiFields = document.getElementById('upiFields');
            const razorpayFields = document.getElementById('razorpayFields');
            const cardFields = document.getElementById('cardFields');
            const codFields = document.getElementById('codFields');

            if (upiFields) upiFields.classList.toggle('hidden', val !== 'UPI');
            if (razorpayFields) razorpayFields.classList.toggle('hidden', val !== 'RAZORPAY');
            if (cardFields) cardFields.classList.toggle('hidden', val !== 'CARD');
            if (codFields) codFields.classList.toggle('hidden', val !== 'COD');

            updateSubmitButtonText();
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCart();
            closeProductModal();
            closeCheckoutModal();
            closeOrdersModal();
            closeSuccessModal();
            closeUpiModal();
            closeCardOtpModal();
            closeCodOtpModal();
            closeRazorpayModal();
            closeAddProductModal();
            closeQuickEditModal();
            closeAddCategoryModal();
            closeAuthModal();
            closeSellerStatsModal();
            closeAdminSellerModal();
            closeAdminUserModal();
        }
    });
}

// -------------------------------------------------------------
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// -------------------------------------------------------------
async function initAuth() {
    if (state.token) {
        try {
            const res = await authFetch('/api/auth/me');
            if (res.ok) {
                const userData = await res.json();
                state.currentUser = userData;
                localStorage.setItem('nova_auth_user', JSON.stringify(userData));
            } else {
                state.token = null;
                state.currentUser = null;
                localStorage.removeItem('nova_auth_token');
                localStorage.removeItem('nova_auth_user');
            }
        } catch (err) {
            console.warn('Auth check error:', err);
        }
    }
    renderAuthWidget();
}

function renderAuthWidget() {
    const container = document.getElementById('authHeaderWidget');
    const topAccountLabel = document.getElementById('topAccountLabel');

    if (!container) return;

    if (state.currentUser) {
        const roleConfig = {
            'ROLE_ADMIN': { badge: 'Admin', color: 'bg-purple-100 text-purple-800 border-purple-200' },
            'ROLE_SELLER': { badge: 'Seller', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            'ROLE_USER': { badge: 'Buyer', color: 'bg-blue-100 text-blue-800 border-blue-200' }
        };
        const cfg = roleConfig[state.currentUser.role] || { badge: 'User', color: 'bg-slate-100 text-slate-700 border-slate-200' };
        const initial = (state.currentUser.name || 'U').charAt(0).toUpperCase();

        if (topAccountLabel) {
            topAccountLabel.innerText = `${state.currentUser.name} (${cfg.badge})`;
        }

        container.innerHTML = `
            <div class="relative group">
                <button type="button" class="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-sm transition">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-inner">
                        ${initial}
                    </div>
                    <div class="text-left hidden xl:block pr-1">
                        <div class="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate">${escapeHtml(state.currentUser.name)}</div>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${cfg.color}">${cfg.badge}</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:text-slate-600 mr-1 transition-transform group-hover:rotate-180"></i>
                </button>

                <!-- Dropdown Menu -->
                <div class="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 hidden group-hover:block hover:block z-50">
                    <div class="px-4 py-2 border-b border-slate-100">
                        <p class="text-xs font-bold text-slate-900">${escapeHtml(state.currentUser.name)}</p>
                        <p class="text-[11px] text-slate-500 font-mono truncate">${escapeHtml(state.currentUser.email)}</p>
                        ${state.currentUser.storeName ? `<div class="mt-1 text-[11px] font-semibold text-emerald-700 flex items-center gap-1"><i class="fa-solid fa-store text-[10px]"></i> ${escapeHtml(state.currentUser.storeName)}</div>` : ''}
                    </div>
                    <div class="py-1">
                        <button onclick="switchMode('user')" class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
                            <i class="fa-solid fa-bag-shopping text-brand-600 w-4"></i>
                            <span>Shop Portal (Buyer)</span>
                        </button>
                        ${(state.currentUser.role === 'ROLE_SELLER' || state.currentUser.role === 'ROLE_ADMIN') ? `
                        <button onclick="switchMode('seller')" class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
                            <i class="fa-solid fa-boxes-packing text-emerald-600 w-4"></i>
                            <span>Seller Hub</span>
                        </button>` : ''}
                        ${state.currentUser.role === 'ROLE_ADMIN' ? `
                        <button onclick="switchMode('admin')" class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium">
                            <i class="fa-solid fa-shield-halved text-purple-600 w-4"></i>
                            <span>Executive Admin</span>
                        </button>` : ''}
                    </div>
                    <div class="pt-1 border-t border-slate-100">
                        <button onclick="openAuthModal()" class="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                            <i class="fa-solid fa-arrow-right-arrow-left text-slate-400 w-4"></i>
                            <span>Switch Account / Register</span>
                        </button>
                        <button onclick="handleLogout()" class="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold">
                            <i class="fa-solid fa-right-from-bracket text-rose-500 w-4"></i>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        if (topAccountLabel) {
            topAccountLabel.innerText = 'Sign In / Register';
        }
        container.innerHTML = `
            <button onclick="openAuthModal()" class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm">
                <i class="fa-solid fa-user text-xs"></i>
                <span>Sign In</span>
            </button>
        `;
    }
}

function openAuthModal(targetRole = null) {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    if (targetRole === 'seller') {
        const sellerRadio = document.querySelector('input[name="regRole"][value="ROLE_SELLER"]');
        if (sellerRadio) {
            sellerRadio.checked = true;
            toggleRegisterRoleFields();
        }
    } else if (targetRole === 'user') {
        const userRadio = document.querySelector('input[name="regRole"][value="ROLE_USER"]');
        if (userRadio) {
            userRadio.checked = true;
            toggleRegisterRoleFields();
        }
    }
}

function closeAuthModal() {
    document.getElementById('authModal')?.classList.add('hidden');
}

function switchAuthTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginBtn = document.getElementById('authTabLoginBtn');
    const registerBtn = document.getElementById('authTabRegisterBtn');

    if (tab === 'register') {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
        if (registerBtn) registerBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition bg-white text-slate-900 shadow-sm';
        if (loginBtn) loginBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900';
    } else {
        registerForm?.classList.add('hidden');
        loginForm?.classList.remove('hidden');
        if (loginBtn) loginBtn.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition bg-white text-slate-900 shadow-sm';
        if (registerBtn) registerBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg transition text-slate-600 hover:text-slate-900';
    }
}

function toggleRegisterRoleFields() {
    const selectedRole = document.querySelector('input[name="regRole"]:checked')?.value;
    const storeContainer = document.getElementById('regStoreNameContainer');
    const storeInput = document.getElementById('regStoreName');

    if (selectedRole === 'ROLE_SELLER') {
        storeContainer?.classList.remove('hidden');
        if (storeInput) storeInput.required = true;
    } else {
        storeContainer?.classList.add('hidden');
        if (storeInput) {
            storeInput.required = false;
            storeInput.value = '';
        }
    }
}

async function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!email || !password) {
        showToast('Please enter both email and password', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Signing In...';
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Authentication failed');
        }

        state.token = data.token;
        state.currentUser = {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            storeName: data.storeName,
            city: data.city,
            phone: data.phone
        };
        localStorage.setItem('nova_auth_token', state.token);
        localStorage.setItem('nova_auth_user', JSON.stringify(state.currentUser));

        closeAuthModal();
        renderAuthWidget();
        showToast(`Welcome back, ${data.name}! Signed in as ${data.role.replace('ROLE_', '')}.`, 'success');

        if (data.role === 'ROLE_ADMIN') {
            switchMode('admin');
        } else if (data.role === 'ROLE_SELLER') {
            switchMode('seller');
        } else {
            switchMode('user');
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right text-xs"></i>';
        }
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();
    const role = document.querySelector('input[name="regRole"]:checked')?.value || 'ROLE_USER';
    const name = document.getElementById('regName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const phone = document.getElementById('regPhone')?.value.trim();
    const storeName = document.getElementById('regStoreName')?.value.trim();
    const city = document.getElementById('regCity')?.value.trim();
    const stateVal = document.getElementById('regState')?.value.trim();
    const submitBtn = document.getElementById('registerSubmitBtn');

    if (role === 'ROLE_SELLER' && !storeName) {
        showToast('Please enter your business / store name', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Creating Account...';
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                password,
                role,
                storeName: role === 'ROLE_SELLER' ? storeName : null,
                phone,
                city,
                state: stateVal
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Registration failed');
        }

        state.token = data.token;
        state.currentUser = {
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            storeName: data.storeName,
            city: data.city,
            phone: data.phone
        };
        localStorage.setItem('nova_auth_token', state.token);
        localStorage.setItem('nova_auth_user', JSON.stringify(state.currentUser));

        closeAuthModal();
        renderAuthWidget();
        showToast(`Account created successfully! Welcome, ${data.name}.`, 'success');

        if (data.role === 'ROLE_SELLER') {
            switchMode('seller');
        } else {
            switchMode('user');
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Register & Sign In</span><i class="fa-solid fa-check text-xs"></i>';
        }
    }
}

function quickLoginDemo(email, password) {
    switchAuthTab('login');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
    handleLoginSubmit(null);
}

function handleLogout() {
    state.token = null;
    state.currentUser = null;
    localStorage.removeItem('nova_auth_token');
    localStorage.removeItem('nova_auth_user');

    renderAuthWidget();
    showToast('Signed out successfully.', 'info');
    if (state.currentMode !== 'user') {
        switchMode('user');
    }
}

// -------------------------------------------------------------
// API CALLS: CATEGORIES & PRODUCTS
// -------------------------------------------------------------
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        state.categories = await response.json();
        renderCategoryPills();
        populateCategorySelects();
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    const allBtn = container.querySelector('[data-category="all"]');
    container.innerHTML = '';
    if (allBtn) container.appendChild(allBtn);

    state.categories.forEach(cat => {
        const pill = document.createElement('button');
        pill.onclick = () => filterCategory(cat.slug);
        pill.setAttribute('data-category', cat.slug);
        pill.className = 'category-pill px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition';
        pill.innerText = cat.name;
        container.appendChild(pill);
    });
}

function populateCategorySelects() {
    const sel = document.getElementById('newProdCategory');
    if (sel) {
        sel.innerHTML = state.categories.map(c => `
            <option value="${c.id}">${escapeHtml(c.name)}</option>
        `).join('');
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        state.products = await response.json();

        if (state.currentMode === 'user') {
            renderProducts();
        } else if (state.currentMode === 'seller') {
            renderSellerView();
        } else if (state.currentMode === 'admin') {
            renderAdminView();
        }
    } catch (err) {
        console.error('Error fetching products:', err);
        showToast('Unable to load products from server.', 'error');
    }
}

// -------------------------------------------------------------
// USER MODE: CATALOG, SEARCH, FILTERING, SHOPPING
// -------------------------------------------------------------
function filterCategory(slug) {
    state.currentCategory = slug;
    document.querySelectorAll('.category-pill').forEach(btn => {
        const isMatch = btn.getAttribute('data-category') === slug;
        btn.classList.toggle('bg-brand-600', isMatch);
        btn.classList.toggle('text-white', isMatch);
        btn.classList.toggle('shadow-sm', isMatch);
        btn.classList.toggle('bg-white', !isMatch);
        btn.classList.toggle('text-slate-600', !isMatch);
    });
    renderProducts();
}

function filterByFeatured() {
    filterCategory('all');
    state.currentSort = 'default';
    const select = document.getElementById('sortBy');
    if (select) select.value = 'default';
    renderProducts();
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
}

function resetFilters() {
    state.currentCategory = 'all';
    state.searchQuery = '';
    state.currentSort = 'default';

    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const sortBy = document.getElementById('sortBy');

    if (searchInput) searchInput.value = '';
    if (mobileSearchInput) mobileSearchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (sortBy) sortBy.value = 'default';

    filterCategory('all');
}

function applySorting() {
    const sortBySelect = document.getElementById('sortBy');
    if (sortBySelect) {
        state.currentSort = sortBySelect.value;
        renderProducts();
    }
}

function getFilteredProducts() {
    let result = [...state.products];
    if (state.currentCategory !== 'all') {
        result = result.filter(p => p.category && p.category.slug === state.currentCategory);
    }
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.category && p.category.name.toLowerCase().includes(q))
        );
    }
    switch (state.currentSort) {
        case 'price-asc': result.sort((a, b) => a.price - b.price); break;
        case 'price-desc': result.sort((a, b) => b.price - a.price); break;
        case 'rating': result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
        case 'name': result.sort((a, b) => a.name.localeCompare(b.name)); break;
        default: result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    }
    return result;
}

function renderProducts() {
    const productGrid = document.getElementById('productGrid');
    const emptyState = document.getElementById('emptyState');
    const countLabel = document.getElementById('productCount');
    if (!productGrid) return;

    const filtered = getFilteredProducts();

    if (countLabel) {
        countLabel.innerText = `Showing ${filtered.length} product${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        productGrid.innerHTML = '';
        emptyState?.classList.remove('hidden');
        return;
    }

    emptyState?.classList.add('hidden');

    productGrid.innerHTML = filtered.map(product => {
        const badgeHtml = product.badge
            ? `<span class="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">${escapeHtml(product.badge)}</span>`
            : (product.featured ? `<span class="absolute top-3 left-3 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">Featured</span>` : '');

        const discountHtml = product.originalPrice && product.originalPrice > product.price
            ? `<span class="text-xs line-through text-slate-400 ml-1.5">₹${formatINR(product.originalPrice)}</span>`
            : '';

        return `
            <div class="product-card bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col group">
                <div class="product-img-wrapper relative h-56 bg-slate-100 overflow-hidden cursor-pointer" onclick="openProductModal(${product.id})">
                    ${badgeHtml}
                    <img src="${product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover object-center" loading="lazy">
                    <button onclick="event.stopPropagation(); openProductModal(${product.id})" class="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0" title="Quick View">
                        <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                </div>

                <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span class="font-medium uppercase tracking-wider text-[11px] text-brand-600">${escapeHtml(product.category?.name || 'General')}</span>
                            <div class="flex items-center gap-1 text-amber-500 text-xs">
                                <i class="fa-solid fa-star text-[11px]"></i>
                                <span class="font-bold text-slate-700">${product.rating ? product.rating.toFixed(1) : '4.5'}</span>
                                <span class="text-slate-400 text-[10px]">(${product.reviewCount || 0})</span>
                            </div>
                        </div>

                        <h3 class="font-bold text-slate-900 text-sm leading-snug hover:text-brand-600 transition-colors cursor-pointer line-clamp-1" onclick="openProductModal(${product.id})">
                            ${escapeHtml(product.name)}
                        </h3>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            ${escapeHtml(product.description || '')}
                        </p>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                            <span class="text-lg font-extrabold text-slate-900">₹${formatINR(product.price)}</span>
                            ${discountHtml}
                        </div>
                        <button onclick="addToCart(${product.id})" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-brand-600 text-white text-xs font-semibold transition-all shadow-sm active:scale-95">
                            <i class="fa-solid fa-cart-plus"></i>
                            <span>Add</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStarRating(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) stars += '<i class="fa-solid fa-star"></i>';
        else if (i - 0.5 <= rating) stars += '<i class="fa-solid fa-star-half-stroke"></i>';
        else stars += '<i class="fa-regular fa-star"></i>';
    }
    return stars;
}

// -------------------------------------------------------------
// PRODUCT QUICK VIEW MODAL
// -------------------------------------------------------------
function openProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('productModal');
    const content = document.getElementById('productModalContent');
    if (!modal || !content) return;

    const discountHtml = product.originalPrice && product.originalPrice > product.price
        ? `<span class="text-sm line-through text-slate-400 ml-2">₹${formatINR(product.originalPrice)}</span>`
        : '';

    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2">
            <div class="relative bg-slate-100 h-72 md:h-full min-h-[300px]">
                <img src="${product.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover">
                ${product.badge ? `<span class="absolute top-4 left-4 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">${escapeHtml(product.badge)}</span>` : ''}
            </div>
            <div class="p-6 md:p-8 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between pb-3">
                        <span class="text-xs font-bold text-brand-600 uppercase tracking-wider">${escapeHtml(product.category?.name || 'Category')}</span>
                        <button onclick="closeProductModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                    <h2 class="text-xl md:text-2xl font-extrabold text-slate-900 mb-2">${escapeHtml(product.name)}</h2>
                    <div class="flex items-center gap-2 mb-4">
                        <div class="text-amber-500 text-xs flex gap-0.5">${renderStarRating(product.rating || 4.8)}</div>
                        <span class="text-xs font-bold text-slate-700">${product.rating ? product.rating.toFixed(1) : '4.8'}</span>
                        <span class="text-xs text-slate-400">(${product.reviewCount || 0} reviews)</span>
                        <span class="text-slate-300">•</span>
                        <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <i class="fa-solid fa-check text-[10px]"></i> In Stock (${product.stockQuantity})
                        </span>
                    </div>
                    <div class="flex items-baseline mb-4 pb-4 border-b border-slate-100">
                        <span class="text-3xl font-extrabold text-slate-900">₹${formatINR(product.price)}</span>
                        ${discountHtml}
                    </div>
                    <p class="text-sm text-slate-600 leading-relaxed mb-6">${escapeHtml(product.description || '')}</p>
                </div>
                <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                        <button onclick="decrementModalQty()" class="px-3 py-2.5 text-slate-600 hover:bg-slate-200 transition"><i class="fa-solid fa-minus text-xs"></i></button>
                        <input id="modalQtyInput" type="number" value="1" min="1" max="${product.stockQuantity}" class="w-12 text-center text-sm font-bold bg-transparent focus:outline-none" readonly>
                        <button onclick="incrementModalQty(${product.stockQuantity})" class="px-3 py-2.5 text-slate-600 hover:bg-slate-200 transition"><i class="fa-solid fa-plus text-xs"></i></button>
                    </div>
                    <button onclick="addModalItemToCart(${product.id})" class="flex-1 py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition shadow-md shadow-brand-500/25 flex items-center justify-center gap-2">
                        <i class="fa-solid fa-bag-shopping"></i>
                        <span>Add to Cart</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeProductModal() { document.getElementById('productModal')?.classList.add('hidden'); }
function incrementModalQty(max) { const i = document.getElementById('modalQtyInput'); if (i && +i.value < max) i.value = +i.value + 1; }
function decrementModalQty() { const i = document.getElementById('modalQtyInput'); if (i && +i.value > 1) i.value = +i.value - 1; }
function addModalItemToCart(id) { const i = document.getElementById('modalQtyInput'); addToCart(id, i ? +i.value || 1 : 1); closeProductModal(); }

// -------------------------------------------------------------
// CART & CHECKOUT
// -------------------------------------------------------------
function addToCart(productId, quantity = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existing = state.cart.find(item => item.id === productId);
    if (existing) {
        if (existing.quantity + quantity > product.stockQuantity) {
            showToast(`Sorry, only ${product.stockQuantity} units available.`, 'error');
            return;
        }
        existing.quantity += quantity;
    } else {
        if (quantity > product.stockQuantity) {
            showToast(`Item is out of stock.`, 'error');
            return;
        }
        state.cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            imageUrl: product.imageUrl,
            categoryName: product.category?.name || 'General',
            stockQuantity: product.stockQuantity,
            quantity: quantity
        });
    }

    saveCart();
    updateCartBadge();
    showToast(`Added "${product.name}" to cart!`, 'success');
}

function updateCartQuantity(productId, newQty) {
    const itemIndex = state.cart.findIndex(i => i.id === productId);
    if (itemIndex === -1) return;
    if (newQty <= 0) { removeFromCart(productId); return; }

    const product = state.products.find(p => p.id === productId);
    const maxStock = product ? product.stockQuantity : state.cart[itemIndex].stockQuantity;
    if (newQty > maxStock) {
        showToast(`Cannot add more than ${maxStock} units in stock.`, 'error');
        return;
    }
    state.cart[itemIndex].quantity = newQty;
    saveCart();
    renderCart();
    updateCartBadge();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();
    updateCartBadge();
    showToast('Item removed from cart', 'info');
}

function saveCart() { localStorage.setItem('nova_cart', JSON.stringify(state.cart)); }

function updateCartBadge() {
    const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartCountBadge');
    if (badge) {
        badge.innerText = totalCount;
        badge.classList.toggle('scale-125', true);
        setTimeout(() => badge.classList.toggle('scale-125', false), 200);
    }
}

function calculateCartTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 999 || subtotal === 0 ? 0 : 99.00;
    const tax = +(subtotal * 0.18).toFixed(2); // 18% GST in India
    const total = +(subtotal + shipping + tax).toFixed(2);
    return { subtotal, shipping, tax, total };
}

function openCart() {
    renderCart();
    const drawer = document.getElementById('cartDrawer');
    const backdrop = document.getElementById('cartBackdrop');
    const panel = document.getElementById('cartPanel');

    if (drawer && backdrop && panel) {
        drawer.classList.remove('hidden');
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            backdrop.classList.add('opacity-100');
            panel.classList.remove('translate-x-full');
            panel.classList.add('translate-x-0');
        }, 10);
    }
}

function closeCart() {
    const backdrop = document.getElementById('cartBackdrop');
    const panel = document.getElementById('cartPanel');
    const drawer = document.getElementById('cartDrawer');

    if (backdrop && panel && drawer) {
        backdrop.classList.remove('opacity-100');
        backdrop.classList.add('opacity-0');
        panel.classList.remove('translate-x-0');
        panel.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

function renderCart() {
    const list = document.getElementById('cartItemsList');
    const empty = document.getElementById('cartEmptyState');
    const footer = document.getElementById('cartFooter');
    const countBadge = document.getElementById('drawerCartCount');
    if (!list) return;

    const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (countBadge) countBadge.innerText = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

    if (state.cart.length === 0) {
        list.classList.add('hidden');
        footer?.classList.add('hidden');
        empty?.classList.remove('hidden');
        return;
    }

    list.classList.remove('hidden');
    footer?.classList.remove('hidden');
    empty?.classList.add('hidden');

    list.innerHTML = state.cart.map(item => `
        <div class="pt-4 first:pt-0 flex gap-4 items-center">
            <img src="${item.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" alt="${escapeHtml(item.name)}" class="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0">
            <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-slate-900 truncate">${escapeHtml(item.name)}</h4>
                <p class="text-[11px] text-slate-500">₹${formatINR(item.price)} each</p>
                <div class="flex items-center gap-3 mt-2">
                    <div class="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})" class="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs">-</button>
                        <span class="px-2.5 py-0.5 text-xs font-bold text-slate-800">${item.quantity}</span>
                        <button onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})" class="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs">+</button>
                    </div>
                    <button onclick="removeFromCart(${item.id})" class="text-xs text-red-500 hover:text-red-700 font-medium transition">Remove</button>
                </div>
            </div>
            <div class="text-right">
                <span class="text-sm font-bold text-slate-900">₹${formatINR(item.price * item.quantity)}</span>
            </div>
        </div>
    `).join('');

    const { subtotal, shipping, tax, total } = calculateCartTotals();
    document.getElementById('cartSubtotal').innerText = `₹${formatINR(subtotal)}`;
    document.getElementById('cartShipping').innerText = shipping === 0 ? 'FREE' : `₹${formatINR(shipping)}`;
    document.getElementById('cartTax').innerText = `₹${formatINR(tax)}`;
    document.getElementById('cartTotal').innerText = `₹${formatINR(total)}`;

    const progressPercent = Math.min(100, Math.round((subtotal / 999) * 100));
    const progressBar = document.getElementById('shippingProgressBar');
    const progressText = document.getElementById('shippingProgressText');
    const percentText = document.getElementById('shippingProgressPercent');

    if (progressBar && progressText && percentText) {
        progressBar.style.width = `${progressPercent}%`;
        percentText.innerText = `${progressPercent}%`;
        progressText.innerHTML = subtotal >= 999
            ? `🎉 You've unlocked <strong class="text-emerald-700">FREE Delivery across India!</strong>`
            : `Add ₹${formatINR(999 - subtotal)} more for FREE Delivery!`;
    }
}

function updateSubmitButtonText() {
    const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'UPI';
    const { total } = calculateCartTotals();
    const btnText = document.getElementById('submitOrderText');
    if (!btnText) return;
    if (method === 'UPI') {
        btnText.innerText = `Scan & Pay via UPI (₹${formatINR(total)})`;
    } else if (method === 'RAZORPAY') {
        btnText.innerText = `Pay via Razorpay (₹${formatINR(total)})`;
    } else if (method === 'CARD') {
        btnText.innerText = `Pay with RuPay Card (₹${formatINR(total)})`;
    } else {
        btnText.innerText = `Place Order via COD (₹${formatINR(total)})`;
    }
}

function openCheckoutModal() {
    if (state.cart.length === 0) { showToast('Your cart is empty', 'error'); return; }
    closeCart();
    const { total } = calculateCartTotals();
    document.getElementById('checkoutTotalAmount').innerText = `₹${formatINR(total)}`;
    updateSubmitButtonText();

    // Auto-fill customer details if logged in
    if (state.currentUser) {
        const nameInput = document.getElementById('custName');
        const emailInput = document.getElementById('custEmail');
        const phoneInput = document.getElementById('custPhone');
        const cityInput = document.getElementById('custCity');
        const stateInput = document.getElementById('custState');

        if (nameInput && !nameInput.value) nameInput.value = state.currentUser.name || '';
        if (emailInput && !emailInput.value) emailInput.value = state.currentUser.email || '';
        if (phoneInput && !phoneInput.value && state.currentUser.phone) {
            phoneInput.value = state.currentUser.phone.replace('+91', '').trim();
        }
        if (cityInput && !cityInput.value && state.currentUser.city) cityInput.value = state.currentUser.city;
        if (stateInput && !stateInput.value && state.currentUser.state) stateInput.value = state.currentUser.state;
    }

    // Random 4-digit code for COD anti-spam
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const captchaDisplay = document.getElementById('codCaptchaDisplay');
    const captchaInput = document.getElementById('codCaptchaInput');
    if (captchaDisplay) captchaDisplay.innerText = randCode;
    if (captchaInput) captchaInput.value = randCode;

    document.getElementById('checkoutModal')?.classList.remove('hidden');

    // Initialize or refresh delivery map
    setTimeout(() => {
        const lat = parseFloat(document.getElementById('custLatitude')?.value) || 17.4483;
        const lon = parseFloat(document.getElementById('custLongitude')?.value) || 78.3839;
        initOrRefreshDeliveryMap(lat, lon);
    }, 120);
}

function closeCheckoutModal() { document.getElementById('checkoutModal')?.classList.add('hidden'); }

// -------------------------------------------------------------
// LEAFLET MAP & INDIAN PIN CODE IDENTIFIER
// -------------------------------------------------------------
let deliveryMapInstance = null;
let deliveryMarkerInstance = null;
let pincodeDebounceTimer = null;

function initOrRefreshDeliveryMap(lat = 17.4483, lon = 78.3839, areaLabel = "HITEC City / Madhapur, Hyderabad") {
    const mapEl = document.getElementById('deliveryMap');
    if (!mapEl) return;

    if (!deliveryMapInstance) {
        deliveryMapInstance = L.map('deliveryMap').setView([lat, lon], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(deliveryMapInstance);

        deliveryMarkerInstance = L.marker([lat, lon], { draggable: true }).addTo(deliveryMapInstance);
        deliveryMarkerInstance.bindPopup(`<b>${areaLabel}</b><br><span class="text-[10px] text-slate-500">📍 Drag pin to your doorstep</span>`).openPopup();

        // Marker drag handler
        deliveryMarkerInstance.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            document.getElementById('custLatitude').value = pos.lat;
            document.getElementById('custLongitude').value = pos.lng;
            deliveryMarkerInstance.bindPopup(`<b>Doorstep Pin Set</b><br>Lat: ${pos.lat.toFixed(4)}, Lon: ${pos.lng.toFixed(4)}`).openPopup();
            reverseGeocodeCoordinates(pos.lat, pos.lng);
        });

        // Click anywhere on map to reposition pin
        deliveryMapInstance.on('click', function (e) {
            deliveryMarkerInstance.setLatLng(e.latlng);
            document.getElementById('custLatitude').value = e.latlng.lat;
            document.getElementById('custLongitude').value = e.latlng.lng;
            deliveryMarkerInstance.bindPopup(`<b>Doorstep Pin Set</b><br>Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`).openPopup();
            reverseGeocodeCoordinates(e.latlng.lat, e.latlng.lng);
        });
    } else {
        setTimeout(() => {
            deliveryMapInstance.invalidateSize();
            deliveryMapInstance.setView([lat, lon], 14);
            if (deliveryMarkerInstance) {
                deliveryMarkerInstance.setLatLng([lat, lon]);
                deliveryMarkerInstance.bindPopup(`<b>${areaLabel}</b><br><span class="text-[10px] text-slate-500">📍 Drag pin to your doorstep</span>`).openPopup();
            }
        }, 120);
    }
}

async function reverseGeocodeCoordinates(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
            headers: { 'User-Agent': 'NovaEcommerceApp/1.0 (contact@novastore.in)' }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.address) {
                const sub = data.address.suburb || data.address.neighbourhood || data.address.road;
                if (sub) {
                    showToast(`📍 Doorstep refined near: ${sub}`, 'info');
                }
            }
        }
    } catch (e) {}
}

function handlePincodeInput(pincode) {
    const cleanPin = (pincode || '').replace(/[^0-9]/g, '');
    const statusEl = document.getElementById('pincodeStatus');
    const spinnerEl = document.getElementById('pincodeSpinner');

    if (cleanPin.length !== 6) {
        if (statusEl) {
            statusEl.className = 'text-[11px] font-semibold text-slate-400';
            statusEl.innerText = cleanPin.length === 0 ? 'Type 6 digits for instant map lookup' : `${6 - cleanPin.length} more digit(s) needed...`;
        }
        return;
    }

    if (spinnerEl) spinnerEl.classList.remove('hidden');
    if (statusEl) {
        statusEl.className = 'text-[11px] font-semibold text-brand-600 animate-pulse';
        statusEl.innerText = 'Detecting area & locating on map...';
    }

    clearTimeout(pincodeDebounceTimer);
    pincodeDebounceTimer = setTimeout(async () => {
        await lookupIndianPincode(cleanPin);
    }, 200);
}

function selectPresetPincode(pin) {
    const input = document.getElementById('custPostal');
    if (input) {
        input.value = pin;
        handlePincodeInput(pin);
    }
}

async function lookupIndianPincode(cleanPin) {
    const statusEl = document.getElementById('pincodeStatus');
    const spinnerEl = document.getElementById('pincodeSpinner');
    const areaInput = document.getElementById('custArea');
    const cityInput = document.getElementById('custCity');
    const stateInput = document.getElementById('custState');
    const areaLabel = document.getElementById('mapAreaLabel');

    try {
        const res = await fetch(`/api/location/pincode/${cleanPin}`);
        if (!res.ok) throw new Error('Lookup failed');
        const data = await res.json();

        let area = data.area || '';
        let city = data.city || '';
        let state = data.state || '';
        let lat = data.latitude || 20.5937;
        let lon = data.longitude || 78.9629;

        if (data.raw) {
            try {
                const parsed = JSON.parse(data.raw);
                if (Array.isArray(parsed) && parsed[0]?.PostOffice?.length > 0) {
                    const po = parsed[0].PostOffice[0];
                    area = po.Name;
                    city = po.District;
                    state = po.State;
                }
            } catch (e) {}
        }

        if (area && areaInput) areaInput.value = area;
        if (city && cityInput) cityInput.value = city;
        if (state && stateInput) stateInput.value = state;

        document.getElementById('custLatitude').value = lat;
        document.getElementById('custLongitude').value = lon;

        const displayName = `${area ? area + ', ' : ''}${city}, ${state} (${cleanPin})`;
        if (areaLabel) areaLabel.innerText = displayName;

        if (statusEl) {
            statusEl.className = 'text-[11px] font-bold text-emerald-600';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${displayName}`;
        }

        // Fly map to Indian neighborhood coordinates
        if (deliveryMapInstance) {
            deliveryMapInstance.flyTo([lat, lon], 14, { animate: true, duration: 1.2 });
            if (deliveryMarkerInstance) {
                deliveryMarkerInstance.setLatLng([lat, lon]);
                deliveryMarkerInstance.bindPopup(`<b>Delivering to: ${area || cleanPin}</b><br>${city}, ${state} - ${cleanPin}<br><span class="text-[10px] text-brand-600">📍 Drag marker to adjust exact doorstep</span>`).openPopup();
            }
        } else {
            initOrRefreshDeliveryMap(lat, lon, displayName);
        }

        showToast(`📍 Located PIN ${cleanPin}: ${area || city}, ${state}`, 'success');

    } catch (err) {
        console.error('Error looking up PIN code:', err);
        if (statusEl) {
            statusEl.className = 'text-[11px] font-bold text-amber-600';
            statusEl.innerText = 'Could not auto-detect area. Please enter details manually.';
        }
    } finally {
        if (spinnerEl) spinnerEl.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// PAYMENT INTEGRATION & ORDER PROCESSING
// -------------------------------------------------------------
let activePaymentSession = {
    order: null,
    initiateData: null,
    timerInterval: null
};

let activeCardSession = {
    order: null,
    cardLast4: '9012'
};

function finishSuccessfulOrder(order) {
    state.lastPlacedOrder = order;
    savePlacedOrderToHistory(order.orderNumber);
    state.cart = [];
    saveCart();
    updateCartBadge();
    loadProducts();
    closeCheckoutModal();
    showOrderConfirmation(order);
}

async function handlePlaceOrder(event) {
    event.preventDefault();
    if (state.cart.length === 0) return;

    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'UPI';

    // Anti-Spam Check for COD
    if (selectedMethod === 'COD') {
        const expectedCaptcha = document.getElementById('codCaptchaDisplay')?.innerText?.trim();
        const userCaptcha = document.getElementById('codCaptchaInput')?.value?.trim();
        if (expectedCaptcha && userCaptcha !== expectedCaptcha) {
            showToast('Incorrect security code for Cash on Delivery', 'error');
            return;
        }
    }

    // Basic Card Validation for CARD
    let cardLast4 = '9012';
    if (selectedMethod === 'CARD') {
        const cardNum = document.getElementById('cardNumInput')?.value?.replace(/\s+/g, '') || '';
        const expiry = document.getElementById('cardExpiryInput')?.value?.trim() || '';
        const cvv = document.getElementById('cardCvvInput')?.value?.trim() || '';
        if (cardNum.length < 15) {
            showToast('Please enter a valid 16-digit card number', 'error');
            return;
        }
        if (!expiry.includes('/') || expiry.length < 5) {
            showToast('Please enter expiry as MM/YY', 'error');
            return;
        }
        if (cvv.length < 3) {
            showToast('Please enter a valid CVV', 'error');
            return;
        }
        cardLast4 = cardNum.slice(-4);
    }

    const submitBtn = document.getElementById('submitOrderBtn');
    const spinner = document.getElementById('submitOrderSpinner');
    const btnText = document.getElementById('submitOrderText');

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerText = 'Initiating Secure Order...';

    const orderPayload = {
        customerName: document.getElementById('custName').value.trim(),
        customerEmail: document.getElementById('custEmail').value.trim(),
        customerPhone: '+91 ' + document.getElementById('custPhone').value.trim(),
        shippingAddress: document.getElementById('custAddress').value.trim(),
        area: document.getElementById('custArea')?.value.trim(),
        city: document.getElementById('custCity')?.value.trim(),
        state: document.getElementById('custState')?.value.trim(),
        postalCode: document.getElementById('custPostal').value.trim(),
        country: 'India',
        latitude: parseFloat(document.getElementById('custLatitude')?.value) || 17.4483,
        longitude: parseFloat(document.getElementById('custLongitude')?.value) || 78.3839,
        paymentMethod: selectedMethod === 'UPI' ? 'UPI' : selectedMethod === 'RAZORPAY' ? 'Razorpay' : selectedMethod === 'CARD' ? 'RuPay / Cards' : 'Cash On Delivery',
        paymentStatus: selectedMethod === 'COD' ? 'COD_PENDING' : 'PAYMENT_PENDING',
        items: state.cart.map(item => ({ productId: item.id, quantity: item.quantity }))
    };

    try {
        const response = await authFetch('/api/orders', {
            method: 'POST',
            body: JSON.stringify(orderPayload)
        });
        const orderData = await response.json();
        if (!response.ok) throw new Error(orderData.error || 'Failed to complete order');

        // Check which payment flow to trigger
        if (selectedMethod === 'COD') {
            closeCheckoutModal();
            openCodOtpModal(orderData);
        } else if (selectedMethod === 'UPI') {
            const vpaPref = document.getElementById('custUpiId')?.value?.trim();
            const initRes = await fetch('/api/payments/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderNumber: orderData.orderNumber,
                    paymentMethod: 'UPI',
                    amount: orderData.totalAmount,
                    merchantVpa: vpaPref && vpaPref.includes('@') ? vpaPref : 'novastore@okhdfcbank'
                })
            });
            const initData = await initRes.json();
            closeCheckoutModal();
            openUpiModal(orderData, initData);
        } else if (selectedMethod === 'RAZORPAY') {
            const initRes = await fetch('/api/payments/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderNumber: orderData.orderNumber,
                    paymentMethod: 'RAZORPAY',
                    amount: orderData.totalAmount
                })
            });
            const initData = await initRes.json();
            closeCheckoutModal();
            handleRazorpayCheckout(orderData, initData);
        } else if (selectedMethod === 'CARD') {
            closeCheckoutModal();
            openCardOtpModal(orderData, cardLast4);
        }
    } catch (err) {
        console.error('Error placing order:', err);
        showToast(err.message || 'Error submitting order', 'error');
    } finally {
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        updateSubmitButtonText();
    }
}

// -------------------------------------------------------------
// UPI PAYMENT MODAL HANDLERS
// -------------------------------------------------------------
function openUpiModal(order, initData) {
    activePaymentSession = {
        order: order,
        initiateData: initData,
        timerInterval: null
    };

    document.getElementById('upiModalAmount').innerText = `₹${formatINR(order.totalAmount)}`;
    document.getElementById('upiModalOrderNumber').innerText = order.orderNumber;
    const vpaInput = document.getElementById('upiReceiverVpaInput');
    if (vpaInput) vpaInput.value = initData.merchantVpa || 'novastore@okhdfcbank';

    renderUpiQrCode(initData.upiQrData || initData.upiUri);
    startUpiCountdown();
    document.getElementById('upiPaymentModal')?.classList.remove('hidden');
}

function renderUpiQrCode(text) {
    const qrWrapper = document.getElementById('upiQrCodeWrapper');
    if (!qrWrapper) return;
    qrWrapper.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrWrapper, {
            text: text,
            width: 200,
            height: 200,
            colorDark: "#020617",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
        img.alt = 'UPI QR Code';
        img.className = 'w-[200px] h-[200px] mx-auto';
        qrWrapper.appendChild(img);
    }
}

function updateReceiverVpaAndQr() {
    const newVpa = document.getElementById('upiReceiverVpaInput')?.value?.trim();
    if (!newVpa || !newVpa.includes('@')) {
        showToast('Please enter a valid UPI ID (e.g. name@okaxis or 9876543210@paytm)', 'error');
        return;
    }
    if (!activePaymentSession.order) return;

    const cleanName = encodeURIComponent('NOVA Store India');
    const cleanNote = encodeURIComponent(`Order ${activePaymentSession.order.orderNumber}`);
    const amount = Number(activePaymentSession.order.totalAmount).toFixed(2);
    const newUpiUri = `upi://pay?pa=${newVpa}&pn=${cleanName}&am=${amount}&cu=INR&tr=${activePaymentSession.order.orderNumber}&tn=${cleanNote}&mode=02`;

    activePaymentSession.initiateData.upiUri = newUpiUri;
    activePaymentSession.initiateData.upiQrData = newUpiUri;
    activePaymentSession.initiateData.merchantVpa = newVpa;

    renderUpiQrCode(newUpiUri);
    showToast(`QR Code refreshed for UPI ID: ${newVpa}`, 'success');
}

function closeUpiModal() {
    if (activePaymentSession.timerInterval) {
        clearInterval(activePaymentSession.timerInterval);
    }
    document.getElementById('upiPaymentModal')?.classList.add('hidden');
}

function startUpiCountdown() {
    if (activePaymentSession.timerInterval) {
        clearInterval(activePaymentSession.timerInterval);
    }
    let secondsLeft = 600; // 10 minutes
    const timerEl = document.getElementById('upiTimer');

    activePaymentSession.timerInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
            clearInterval(activePaymentSession.timerInterval);
            if (timerEl) timerEl.innerText = '00:00 (Expired)';
            showToast('UPI payment window expired. Please retry.', 'error');
            closeUpiModal();
            return;
        }
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        if (timerEl) {
            timerEl.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    }, 1000);
}

function copyMerchantVpa() {
    const vpa = document.getElementById('upiReceiverVpaInput')?.value || 'novastore@okhdfcbank';
    navigator.clipboard.writeText(vpa).then(() => {
        showToast(`Copied UPI ID: ${vpa}`, 'success');
    }).catch(() => {
        showToast(vpa, 'info');
    });
}

function openUpiApp(app) {
    if (!activePaymentSession.initiateData?.upiUri) {
        showToast('UPI URI not ready', 'error');
        return;
    }
    const uri = activePaymentSession.initiateData.upiUri;
    showToast(`Launching ${app.toUpperCase()}...`, 'info');
    window.location.href = uri;
}

async function handleVerifyUpiPayment() {
    if (!activePaymentSession.order) return;
    const utrInput = document.getElementById('upiUtrInput')?.value?.trim();
    const btn = document.getElementById('verifyUtrBtn');
    if (btn) btn.disabled = true;

    try {
        const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderNumber: activePaymentSession.order.orderNumber,
                paymentMethod: 'UPI',
                upiUtr: utrInput || null,
                transactionId: utrInput ? `UPI-UTR-${utrInput}` : `UPI-${Date.now()}`
            })
        });
        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.message || 'Payment verification failed');

        closeUpiModal();
        activePaymentSession.order.paymentStatus = 'PAID';
        activePaymentSession.order.paymentTransactionId = vData.transactionId;
        activePaymentSession.order.paymentMethod = 'UPI / QR';
        finishSuccessfulOrder(activePaymentSession.order);
        showToast('Payment verified successfully!', 'success');
    } catch (err) {
        showToast(err.message || 'Verification failed', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function simulateUpiApproval() {
    if (!activePaymentSession.order) return;
    const randomUtr = Math.floor(100000000000 + Math.random() * 900000000000);
    showToast('Simulating bank payment confirmation...', 'info');

    try {
        const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderNumber: activePaymentSession.order.orderNumber,
                paymentMethod: 'UPI',
                upiUtr: String(randomUtr),
                transactionId: `UPI-UTR-${randomUtr}`
            })
        });
        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.message || 'Approval simulation failed');

        closeUpiModal();
        activePaymentSession.order.paymentStatus = 'PAID';
        activePaymentSession.order.paymentTransactionId = vData.transactionId;
        activePaymentSession.order.paymentMethod = 'UPI / QR';
        finishSuccessfulOrder(activePaymentSession.order);
        showToast(`UPI Payment Approved! UTR: ${randomUtr}`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// REAL-TIME COD OTP VERIFICATION HANDLERS
// -------------------------------------------------------------
let activeCodSession = {
    order: null,
    otp: null,
    countdown: 60,
    timerInterval: null
};

async function openCodOtpModal(order) {
    activeCodSession.order = order;
    document.getElementById('codOtpAmountDisplay').innerText = `₹${formatINR(order.totalAmount)}`;
    document.getElementById('codOtpMobileDisplay').innerText = order.customerPhone || '+91 98765 43210';
    document.getElementById('codOtpInput').value = '';

    document.getElementById('codOtpModal')?.classList.remove('hidden');

    // Trigger real-time OTP dispatch via backend
    await dispatchCodOtp();
}

function closeCodOtpModal() {
    if (activeCodSession.timerInterval) clearInterval(activeCodSession.timerInterval);
    document.getElementById('codOtpModal')?.classList.add('hidden');
}

async function dispatchCodOtp() {
    if (!activeCodSession.order) return;
    try {
        const res = await fetch('/api/otp/send-cod-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: activeCodSession.order.customerPhone,
                orderNumber: activeCodSession.order.orderNumber
            })
        });
        const data = await res.json();
        if (data.demoOtp) {
            activeCodSession.otp = data.demoOtp;
            document.getElementById('codDemoOtpDisplay').innerText = data.demoOtp;
            showToast(`📲 SMS OTP to ${data.maskedPhone || 'your mobile'}: ${data.demoOtp}`, 'info');
        }
        startCodTimer();
    } catch (err) {
        showToast('Failed to dispatch OTP SMS', 'error');
    }
}

function autoFillCodOtp() {
    if (activeCodSession.otp) {
        document.getElementById('codOtpInput').value = activeCodSession.otp;
        showToast(`Auto-filled OTP: ${activeCodSession.otp}`, 'success');
    }
}

function startCodTimer() {
    if (activeCodSession.timerInterval) clearInterval(activeCodSession.timerInterval);
    activeCodSession.countdown = 60;
    const btn = document.getElementById('resendCodBtn');
    if (btn) btn.disabled = true;

    activeCodSession.timerInterval = setInterval(() => {
        activeCodSession.countdown--;
        if (btn) btn.innerHTML = `<i class="fa-solid fa-clock mr-1"></i> Resend in ${activeCodSession.countdown}s`;
        if (activeCodSession.countdown <= 0) {
            clearInterval(activeCodSession.timerInterval);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-rotate-right mr-1"></i> Resend OTP`;
            }
        }
    }, 1000);
}

async function resendCodOtp() {
    showToast('Sending fresh OTP code...', 'info');
    await dispatchCodOtp();
}

async function handleVerifyCodOtp() {
    if (!activeCodSession.order) return;
    const inputOtp = document.getElementById('codOtpInput')?.value?.trim();
    if (!inputOtp || inputOtp.length !== 6) {
        showToast('Please enter the 6-digit OTP', 'error');
        return;
    }

    const btn = document.getElementById('verifyCodOtpBtn');
    if (btn) btn.disabled = true;

    try {
        const res = await fetch('/api/otp/verify-cod-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: activeCodSession.order.customerPhone,
                orderNumber: activeCodSession.order.orderNumber,
                otp: inputOtp
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'OTP verification failed');

        closeCodOtpModal();
        activeCodSession.order.paymentStatus = 'COD_VERIFIED';
        activeCodSession.order.paymentTransactionId = `COD-OTP-${inputOtp}`;
        activeCodSession.order.paymentMethod = 'Cash on Delivery (OTP Verified)';
        finishSuccessfulOrder(activeCodSession.order);
        showToast('Cash on Delivery verified successfully via OTP!', 'success');
    } catch (err) {
        showToast(err.message || 'Incorrect OTP code', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// -------------------------------------------------------------
// RAZORPAY SANDBOX TESTING SUITE HANDLERS
// -------------------------------------------------------------
let activeRzpSession = {
    order: null,
    initData: null
};

function handleRazorpayCheckout(order, initData) {
    activeRzpSession.order = order;
    activeRzpSession.initData = initData;

    if (typeof Razorpay !== 'undefined') {
        try {
            const options = {
                key: initData.razorpayKeyId || 'rzp_test_TuVcSh0WCborg8',
                amount: Math.round(order.totalAmount * 100), // paise
                currency: "INR",
                name: "NOVA India Store",
                description: `Order ${order.orderNumber}`,
                image: "https://cdn-icons-png.flaticon.com/512/891/891462.png",
                order_id: initData.razorpayOrderId,
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch('/api/payments/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderNumber: order.orderNumber,
                                paymentMethod: 'RAZORPAY',
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature
                            })
                        });
                        const vData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(vData.message || 'Signature verification failed');

                        order.paymentStatus = 'PAID';
                        order.paymentTransactionId = response.razorpay_payment_id;
                        order.paymentMethod = 'Razorpay Test Checkout';
                        finishSuccessfulOrder(order);
                        showToast(`Payment Approved! Razorpay ID: ${response.razorpay_payment_id}`, 'success');
                    } catch (err) {
                        showToast(err.message || 'Verification error', 'error');
                    }
                },
                prefill: {
                    name: order.customerName,
                    email: order.customerEmail,
                    contact: order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '9876543210'
                },
                notes: {
                    orderNumber: order.orderNumber,
                    deliveryArea: order.area || order.city
                },
                theme: { color: "#4f46e5" },
                modal: {
                    ondismiss: function () {
                        showToast('Razorpay popup closed', 'info');
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function (resp) {
                showToast(`Payment failed: ${resp.error.description}`, 'error');
            });
            rzp.open();
            return;
        } catch (e) {
            console.warn('Razorpay SDK error, falling back to sandbox modal:', e);
        }
    }

    openRzpSandboxFallbackModal(order, initData);
}

function openRzpSandboxFallbackModal(order, initData) {
    document.getElementById('rzpModalAmount').innerText = `₹${formatINR(order.totalAmount)}`;
    document.getElementById('rzpModalOrderNumber').innerText = order.orderNumber;
    switchRzpTab('upi');
    document.getElementById('razorpayModal')?.classList.remove('hidden');
}

function closeRazorpayModal() {
    document.getElementById('razorpayModal')?.classList.add('hidden');
}

function switchRzpTab(tab) {
    const tabUpi = document.getElementById('rzpTabUpi');
    const tabCard = document.getElementById('rzpTabCard');
    const tabNb = document.getElementById('rzpTabNb');

    const paneUpi = document.getElementById('rzpPaneUpi');
    const paneCard = document.getElementById('rzpPaneCard');
    const paneNb = document.getElementById('rzpPaneNb');

    [tabUpi, tabCard, tabNb].forEach(t => {
        t?.classList.remove('border-brand-600', 'text-brand-600');
        t?.classList.add('border-transparent');
    });
    [paneUpi, paneCard, paneNb].forEach(p => p?.classList.add('hidden'));

    if (tab === 'upi') {
        tabUpi?.classList.add('border-brand-600', 'text-brand-600');
        tabUpi?.classList.remove('border-transparent');
        paneUpi?.classList.remove('hidden');
    } else if (tab === 'card') {
        tabCard?.classList.add('border-brand-600', 'text-brand-600');
        tabCard?.classList.remove('border-transparent');
        paneCard?.classList.remove('hidden');
    } else {
        tabNb?.classList.add('border-brand-600', 'text-brand-600');
        tabNb?.classList.remove('border-transparent');
        paneNb?.classList.remove('hidden');
    }
}

function fillRzpVpa(vpa) {
    const input = document.getElementById('rzpTestVpa');
    if (input) input.value = vpa;
    showToast(`Selected: ${vpa}`, 'info');
}

function fillRzpCard(card) {
    const input = document.getElementById('rzpCardNumber');
    if (input) input.value = card;
    showToast(`Selected test card: ${card}`, 'info');
}

async function executeRzpSandboxPayment() {
    if (!activeRzpSession.order) return;
    const vpa = document.getElementById('rzpTestVpa')?.value?.trim();

    if (vpa === 'failure@razorpay') {
        showToast('Simulated Razorpay error: Payment failed by customer bank', 'error');
        return;
    }

    const btn = document.getElementById('rzpSubmitBtn');
    if (btn) btn.disabled = true;

    const testPayId = 'pay_test_' + Math.random().toString(36).substring(2, 12);

    try {
        const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderNumber: activeRzpSession.order.orderNumber,
                paymentMethod: 'RAZORPAY',
                razorpayOrderId: activeRzpSession.initData?.razorpayOrderId || 'order_demo',
                razorpayPaymentId: testPayId,
                razorpaySignature: 'simulated_valid_test_signature'
            })
        });
        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.message || 'Razorpay authorization failed');

        closeRazorpayModal();
        activeRzpSession.order.paymentStatus = 'PAID';
        activeRzpSession.order.paymentTransactionId = testPayId;
        activeRzpSession.order.paymentMethod = 'Razorpay Test Sandbox';
        finishSuccessfulOrder(activeRzpSession.order);
        showToast(`Razorpay payment approved! Payment ID: ${testPayId}`, 'success');
    } catch (err) {
        showToast(err.message || 'Payment simulation failed', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// -------------------------------------------------------------
// CARD 3D-SECURE OTP HANDLERS
// -------------------------------------------------------------
function openCardOtpModal(order, cardLast4) {
    activeCardSession = { order, cardLast4 };
    document.getElementById('cardOtpModalAmount').innerText = `₹${formatINR(order.totalAmount)}`;
    document.getElementById('cardOtpModalCardNum').innerText = `•••• •••• •••• ${cardLast4}`;
    document.getElementById('cardOtpMobileDisplay').innerText = order.customerPhone || '+91 98765 43210';
    document.getElementById('cardOtpInput').value = '123456';
    document.getElementById('cardOtpModal')?.classList.remove('hidden');
}

function closeCardOtpModal() {
    document.getElementById('cardOtpModal')?.classList.add('hidden');
}

function fillTestOtp() {
    const input = document.getElementById('cardOtpInput');
    if (input) input.value = '123456';
    showToast('Autofilled Test OTP: 123456', 'info');
}

async function handleAuthorizeCardPayment() {
    if (!activeCardSession.order) return;
    const otp = document.getElementById('cardOtpInput')?.value?.trim();
    if (!otp || otp.length < 4) {
        showToast('Please enter the 6-digit OTP', 'error');
        return;
    }

    const btn = document.getElementById('authorizeCardBtn');
    if (btn) btn.disabled = true;

    try {
        const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderNumber: activeCardSession.order.orderNumber,
                paymentMethod: 'CARD',
                otp: otp,
                cardLast4: activeCardSession.cardLast4
            })
        });
        const vData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(vData.message || 'OTP Authorization failed');

        closeCardOtpModal();
        activeCardSession.order.paymentStatus = 'PAID';
        activeCardSession.order.paymentTransactionId = vData.transactionId;
        activeCardSession.order.paymentMethod = `RuPay Card (•••• ${activeCardSession.cardLast4})`;
        finishSuccessfulOrder(activeCardSession.order);
        showToast('Card 3D-Secure payment authorized!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// -------------------------------------------------------------
// ORDER CONFIRMATION DISPLAY
// -------------------------------------------------------------
function showOrderConfirmation(order) {
    document.getElementById('confirmedOrderNumber').innerText = order.orderNumber;
    document.getElementById('confirmedCustomerName').innerText = order.customerName;
    document.getElementById('confirmedTotalAmount').innerText = `₹${formatINR(order.totalAmount)}`;

    const addrStr = `${order.shippingAddress}, ${order.area ? order.area + ', ' : ''}${order.city}, ${order.state || ''} - ${order.postalCode}, India 🇮🇳`;
    const addrEl = document.getElementById('confirmedAddress');
    if (addrEl) addrEl.innerText = addrStr;

    // Payment status badge & transaction ID
    const badgeEl = document.getElementById('confirmedPaymentBadge');
    const txnEl = document.getElementById('confirmedTxnId');

    const isPaid = order.paymentStatus === 'PAID';
    if (badgeEl) {
        if (isPaid) {
            badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1';
            badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> PAID (${order.paymentMethod || 'Online'})`;
        } else if (order.paymentStatus === 'COD_VERIFIED') {
            badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1';
            badgeEl.innerHTML = `<i class="fa-solid fa-shield-halved"></i> COD VERIFIED (OTP)`;
        } else {
            badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1';
            badgeEl.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> COD CONFIRMED`;
        }
    }

    if (txnEl) {
        txnEl.innerText = order.paymentTransactionId || (isPaid ? 'TXN-' + order.orderNumber.slice(-6) : 'COD-UPON-DELIVERY');
    }

    document.getElementById('orderSuccessModal')?.classList.remove('hidden');
}

function closeSuccessModal() { document.getElementById('orderSuccessModal')?.classList.add('hidden'); }
function closeSuccessModalAndOpenOrders() { closeSuccessModal(); openOrdersModal(); }

// -------------------------------------------------------------
// USER: ORDER HISTORY TRACKER
// -------------------------------------------------------------
function savePlacedOrderToHistory(orderNumber) {
    const list = JSON.parse(localStorage.getItem('nova_my_orders') || '[]');
    if (!list.includes(orderNumber)) {
        list.unshift(orderNumber);
        localStorage.setItem('nova_my_orders', JSON.stringify(list));
    }
}

async function openOrdersModal() {
    document.getElementById('ordersModal')?.classList.remove('hidden');
    await fetchAndRenderOrders();
}

function closeOrdersModal() { document.getElementById('ordersModal')?.classList.add('hidden'); }

async function fetchAndRenderOrders() {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-6 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading order records...</div>';

    try {
        let response;
        if (state.token) {
            response = await authFetch('/api/orders/my-orders');
        } else {
            response = await fetch('/api/orders');
        }

        if (response.status === 401 || response.status === 403) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <i class="fa-solid fa-user-lock text-3xl text-slate-300 mb-2"></i>
                    <p class="text-xs font-bold text-slate-700">Please sign in to view your personal order history.</p>
                    <button onclick="openAuthModal('user')" class="mt-3 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm">
                        Sign In / Register
                    </button>
                    <div class="mt-4 text-[11px] text-slate-400">Or use the search box above to lookup a specific order number.</div>
                </div>
            `;
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch orders');
        const orders = await response.json();

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <i class="fa-solid fa-receipt text-3xl text-slate-300 mb-2"></i>
                    <p class="text-xs font-semibold">No orders recorded yet.</p>
                    <p class="text-[11px] text-slate-400 mt-1">Browse products and place your first order!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(ord => renderCustomerOrderCard(ord)).join('');
    } catch (err) {
        container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-xl text-xs">Failed to load order history: ${escapeHtml(err.message)}</div>`;
    }
}

async function lookupSpecificOrder() {
    const input = document.getElementById('lookupOrderNumber');
    const orderNumber = input ? input.value.trim() : '';
    if (!orderNumber) { showToast('Please enter an order number', 'info'); return; }

    const container = document.getElementById('ordersListContainer');
    container.innerHTML = '<div class="text-center py-6 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Looking up order...</div>';

    try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
        if (!response.ok) throw new Error('Order not found');
        const order = await response.json();
        container.innerHTML = renderCustomerOrderCard(order);
    } catch (err) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <i class="fa-solid fa-circle-xmark text-3xl text-red-400 mb-2"></i>
                <p class="text-xs font-bold text-slate-700">No order found: ${escapeHtml(orderNumber)}</p>
                <button onclick="fetchAndRenderOrders()" class="mt-3 text-xs text-brand-600 font-semibold hover:underline">View all orders</button>
            </div>
        `;
    }
}

function renderCustomerOrderCard(order) {
    const formattedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
    const itemsHtml = (order.items || []).map(item => `
        <div class="flex justify-between items-center text-xs text-slate-600 py-1">
            <span>${escapeHtml(item.productName)} <span class="text-slate-400 font-bold">× ${item.quantity}</span></span>
            <span class="font-semibold text-slate-900">₹${formatINR(item.subtotal)}</span>
        </div>
    `).join('');

    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                    <span class="text-xs font-mono font-bold text-brand-600">${order.orderNumber}</span>
                    <span class="text-[11px] text-slate-400 ml-2">${formattedDate}</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(order.status)}">
                    ${order.status || 'CONFIRMED'}
                </span>
            </div>
            <div class="divide-y divide-slate-100">${itemsHtml}</div>
            
            <!-- Indian Delivery Location -->
            <div class="text-[11px] text-slate-600 bg-white rounded-xl p-2.5 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <span class="font-bold text-slate-800"><i class="fa-solid fa-location-dot text-brand-600 mr-1"></i>Delivery:</span>
                    <span>${escapeHtml(order.shippingAddress || '')}, ${order.area ? escapeHtml(order.area) + ', ' : ''}${escapeHtml(order.city || '')}, ${escapeHtml(order.state || '')} - <strong>${escapeHtml(order.postalCode || '')}</strong> (India)</span>
                </div>
                ${order.latitude ? `<span class="font-mono text-[10px] text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">📍 ${order.latitude.toFixed(4)}, ${order.longitude.toFixed(4)}</span>` : ''}
            </div>

            <div class="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs">
                <span class="text-slate-500">Recipient: <strong class="text-slate-800">${escapeHtml(order.customerName)}</strong></span>
                <span class="text-sm font-extrabold text-slate-900">Total: ₹${formatINR(order.totalAmount)}</span>
            </div>

            <div class="flex flex-wrap items-center justify-between text-[11px] bg-slate-100/80 px-3 py-1.5 rounded-xl text-slate-600">
                <span>Payment: <strong>${escapeHtml(order.paymentMethod || 'UPI')}</strong></span>
                <span class="font-mono text-[10px] ${order.paymentStatus === 'PAID' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}">
                    <i class="fa-solid ${order.paymentStatus === 'PAID' ? 'fa-circle-check text-emerald-600' : 'fa-clock text-amber-600'}"></i>
                    ${order.paymentStatus || 'PAID'} ${order.paymentTransactionId ? '• ' + escapeHtml(order.paymentTransactionId) : ''}
                </span>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// SELLER MODE: INVENTORY MANAGEMENT & LISTINGS
// -------------------------------------------------------------
async function renderSellerView() {
    // If a seller is logged in, display their store name & contact
    if (state.currentUser && (state.currentUser.role === 'ROLE_SELLER' || state.currentUser.role === 'ROLE_ADMIN')) {
        const storeNameEl = document.getElementById('sellerActiveStoreName');
        const contactEl = document.getElementById('sellerActiveContact');
        if (storeNameEl) {
            storeNameEl.innerText = state.currentUser.storeName || `${state.currentUser.name}'s Merchant Store`;
        }
        if (contactEl) {
            contactEl.innerText = `Merchant Account: ${state.currentUser.name} (${state.currentUser.email}) • ${state.currentUser.city || 'India'}`;
        }
    }

    // Filter products for this specific seller if in seller role
    let sellerProducts = state.products;
    if (state.currentUser && state.currentUser.role === 'ROLE_SELLER') {
        sellerProducts = state.products.filter(p => p.seller && p.seller.id === state.currentUser.id);
    }

    const totalListings = sellerProducts.length;
    const totalStock = sellerProducts.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
    const lowStock = sellerProducts.filter(p => (p.stockQuantity || 0) > 0 && p.stockQuantity < 10).length;
    const outOfStock = sellerProducts.filter(p => (p.stockQuantity || 0) <= 0).length;

    document.getElementById('sellerTotalListings').innerText = totalListings;
    document.getElementById('sellerTotalStock').innerText = totalStock;
    document.getElementById('sellerLowStock').innerText = lowStock;
    document.getElementById('sellerOutOfStock').innerText = outOfStock;

    renderSellerTable(sellerProducts);
    await loadSellerOrders();
}

function filterSellerTable(query) {
    state.sellerFilterQuery = (query || '').toLowerCase().trim();
    let sellerProducts = state.products;
    if (state.currentUser && state.currentUser.role === 'ROLE_SELLER') {
        sellerProducts = state.products.filter(p => p.seller && p.seller.id === state.currentUser.id);
    }
    renderSellerTable(sellerProducts);
}

function renderSellerTable(itemsToRender) {
    const tbody = document.getElementById('sellerTableBody');
    if (!tbody) return;

    let items = itemsToRender || [...state.products];
    if (state.currentUser && state.currentUser.role === 'ROLE_SELLER') {
        items = items.filter(p => p.seller && p.seller.id === state.currentUser.id);
    }

    if (state.sellerFilterQuery) {
        items = items.filter(p =>
            p.name.toLowerCase().includes(state.sellerFilterQuery) ||
            (p.category && p.category.name.toLowerCase().includes(state.sellerFilterQuery))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No matching seller products found. Click "List New Product" to add one!</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(p => {
        const stock = p.stockQuantity || 0;
        let stockBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">In Stock</span>';
        if (stock === 0) {
            stockBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Out of Stock</span>';
        } else if (stock < 10) {
            stockBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Low Stock</span>';
        }

        const sellerStore = p.seller?.storeName || p.seller?.name || 'Assigned';

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-6 flex items-center gap-3">
                    <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" class="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0">
                    <div>
                        <div class="font-bold text-slate-900">${escapeHtml(p.name)}</div>
                        <div class="text-[11px] text-slate-400">ID: #${p.id} • <span class="text-emerald-700 font-medium">${escapeHtml(sellerStore)}</span></div>
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-600 font-medium">${escapeHtml(p.category?.name || 'General')}</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-900">₹${formatINR(p.price)}</td>
                <td class="py-3 px-4">
                    <span class="font-bold text-slate-800">${stock} units</span>
                </td>
                <td class="py-3 px-4">${stockBadge}</td>
                <td class="py-3 px-6 text-right space-x-1">
                    <button onclick="openQuickEditModal(${p.id})" class="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold transition" title="Adjust price and inventory">
                        <i class="fa-solid fa-pen-to-square mr-1"></i> Edit
                    </button>
                    <button onclick="handleDeleteProduct(${p.id}, '${escapeHtml(p.name)}')" class="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition" title="Delete listing">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleSellerView(view) {
    state.sellerCurrentTab = view;
    const invSection = document.getElementById('sellerInventorySection');
    const histSection = document.getElementById('sellerHistorySection');
    const invBtn = document.getElementById('sellerTabInventoryBtn');
    const histBtn = document.getElementById('sellerTabHistoryBtn');

    if (view === 'history') {
        invSection?.classList.add('hidden');
        histSection?.classList.remove('hidden');
        if (histBtn) histBtn.className = 'px-3.5 py-1.5 rounded-lg bg-white text-slate-800 text-xs font-bold shadow-sm transition';
        if (invBtn) invBtn.className = 'px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-semibold transition';
        loadSellerOrders();
    } else {
        histSection?.classList.add('hidden');
        invSection?.classList.remove('hidden');
        if (invBtn) invBtn.className = 'px-3.5 py-1.5 rounded-lg bg-white text-slate-800 text-xs font-bold shadow-sm transition';
        if (histBtn) histBtn.className = 'px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-semibold transition';
        renderSellerTable();
    }
}

async function loadSellerOrders() {
    const tbody = document.getElementById('sellerOrdersTableBody');
    const badge = document.getElementById('sellerOrdersCountBadge');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading sales history...</td></tr>';

    try {
        const res = await authFetch('/api/seller/orders');
        if (!res.ok) throw new Error('Failed to load seller orders');
        const orders = await res.json();

        if (badge) badge.innerText = `${orders.length} order(s) placed`;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">No orders placed for your listings yet.</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(ord => {
            const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
            const itemsHtml = (ord.items || []).map(i => `
                <div class="text-[11px] text-slate-800"><span class="font-bold text-slate-900">${i.quantity}x</span> ${escapeHtml(i.productName)} (₹${formatINR(i.unitPrice)})</div>
            `).join('');

            return `
                <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3 px-6">
                        <span class="font-mono font-bold text-emerald-700">${ord.orderNumber}</span>
                        <div class="text-[11px] text-slate-400">${formattedDate}</div>
                    </td>
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-900">${escapeHtml(ord.customerName)}</div>
                        <div class="text-[11px] text-slate-500">${escapeHtml(ord.customerCity || '')}, ${escapeHtml(ord.customerState || '')}</div>
                    </td>
                    <td class="py-3 px-4">${itemsHtml}</td>
                    <td class="py-3 px-4 font-mono font-extrabold text-emerald-600">₹${formatINR(ord.sellerEarnings)}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${escapeHtml(ord.paymentMethod || 'UPI')}</span>
                    </td>
                    <td class="py-3 px-6 text-right">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBadgeClass(ord.status)}">${ord.status}</span>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-500">${err.message}</td></tr>`;
    }
}

async function openSellerStatsModal() {
    const modal = document.getElementById('sellerStatsModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const storeNameEl = document.getElementById('statsModalStoreName');
    if (storeNameEl && state.currentUser) {
        storeNameEl.innerText = state.currentUser.storeName || `${state.currentUser.name} Store`;
    }

    try {
        const res = await authFetch('/api/seller/stats');
        if (res.ok) {
            const stats = await res.json();
            document.getElementById('statsModalRevenue').innerText = `₹${formatINR(stats.totalRevenue || 0)}`;
            document.getElementById('statsModalUnitsSold').innerText = stats.totalUnitsSold || 0;
            document.getElementById('statsModalActiveListings').innerText = stats.activeStockCount || 0;
            document.getElementById('statsModalOrdersCount').innerText = stats.totalOrdersCount || 0;
        }
    } catch (err) {
        console.error('Failed to load seller stats:', err);
    }
}

function closeSellerStatsModal() {
    document.getElementById('sellerStatsModal')?.classList.add('hidden');
}

// Seller: Quick Edit Price & Stock
function openQuickEditModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('quickEditId').value = product.id;
    document.getElementById('quickEditTitle').innerText = `Edit: ${product.name}`;
    document.getElementById('quickEditPrice').value = Number(product.price).toFixed(2);
    document.getElementById('quickEditStock').value = product.stockQuantity || 0;

    document.getElementById('quickEditModal')?.classList.remove('hidden');
}

function closeQuickEditModal() { document.getElementById('quickEditModal')?.classList.add('hidden'); }

async function handleQuickEditSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('quickEditId').value;
    const price = parseFloat(document.getElementById('quickEditPrice').value);
    const stockQuantity = parseInt(document.getElementById('quickEditStock').value);

    try {
        const response = await authFetch(`/api/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ price, stockQuantity })
        });
        if (!response.ok) throw new Error('Failed to update listing');
        showToast('Product updated successfully!', 'success');
        closeQuickEditModal();
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Seller & Admin: Add New Product
function openAddProductModal() {
    populateCategorySelects();
    document.getElementById('addProductForm')?.reset();
    document.getElementById('addProductModal')?.classList.remove('hidden');
}

function closeAddProductModal() { document.getElementById('addProductModal')?.classList.add('hidden'); }

async function handleCreateProduct(event) {
    event.preventDefault();

    const categoryId = document.getElementById('newProdCategory').value;
    const category = state.categories.find(c => c.id == categoryId) || null;

    const payload = {
        name: document.getElementById('newProdName').value.trim(),
        price: parseFloat(document.getElementById('newProdPrice').value),
        originalPrice: document.getElementById('newProdOriginalPrice').value ? parseFloat(document.getElementById('newProdOriginalPrice').value) : null,
        stockQuantity: parseInt(document.getElementById('newProdStock').value) || 0,
        imageUrl: document.getElementById('newProdImage').value.trim() || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
        badge: document.getElementById('newProdBadge').value.trim() || null,
        description: document.getElementById('newProdDesc').value.trim(),
        category: category
    };

    try {
        const response = await authFetch('/api/products', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to create product listing');

        showToast('New product listed successfully!', 'success');
        closeAddProductModal();
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleDeleteProduct(id, name) {
    if (!confirm(`Are you sure you want to delete listing "${name}"?`)) return;

    try {
        const response = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete listing');
        showToast(`Listing "${name}" deleted.`, 'info');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// ADMIN MODE: EXECUTIVE DASHBOARD & DIRECTORIES
// -------------------------------------------------------------
async function renderAdminView() {
    switchAdminTab(state.adminCurrentTab || 'orders');
}

function switchAdminTab(tab) {
    state.adminCurrentTab = tab;
    const ordersSection = document.getElementById('adminSectionOrders');
    const sellersSection = document.getElementById('adminSectionSellers');
    const usersSection = document.getElementById('adminSectionUsers');

    const ordersBtn = document.getElementById('adminTabOrdersBtn');
    const sellersBtn = document.getElementById('adminTabSellersBtn');
    const usersBtn = document.getElementById('adminTabUsersBtn');

    // Hide all sections
    ordersSection?.classList.add('hidden');
    sellersSection?.classList.add('hidden');
    usersSection?.classList.add('hidden');

    const activeBtnClass = 'px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-purple-600 text-white shadow-sm';
    const inactiveBtnClass = 'px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50';

    if (ordersBtn) ordersBtn.className = inactiveBtnClass;
    if (sellersBtn) sellersBtn.className = inactiveBtnClass;
    if (usersBtn) usersBtn.className = inactiveBtnClass;

    if (tab === 'sellers') {
        sellersSection?.classList.remove('hidden');
        if (sellersBtn) sellersBtn.className = activeBtnClass;
        loadAdminSellers();
    } else if (tab === 'users') {
        usersSection?.classList.remove('hidden');
        if (usersBtn) usersBtn.className = activeBtnClass;
        loadAdminUsers();
    } else {
        ordersSection?.classList.remove('hidden');
        if (ordersBtn) ordersBtn.className = activeBtnClass;
        refreshAdminData();
    }
}

async function refreshAdminData() {
    // 1. Fetch dashboard KPI stats
    try {
        const statsRes = await authFetch('/api/orders/stats/dashboard');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('adminTotalRevenue').innerText = `₹${formatINR(stats.totalRevenue || 0)}`;
            document.getElementById('adminTotalOrders').innerText = stats.totalOrders || 0;
            document.getElementById('adminPendingOrders').innerText = stats.pendingOrdersCount || 0;
            document.getElementById('adminTotalProducts').innerText = stats.totalProducts || 0;
        }
    } catch (err) {
        console.error('Error fetching admin stats:', err);
    }

    // 2. Fetch all orders for management table
    try {
        const ordersRes = await authFetch('/api/orders');
        if (ordersRes.ok) {
            state.adminOrders = await ordersRes.json();
            renderAdminOrdersTable();
        }
    } catch (err) {
        console.error('Error fetching admin orders:', err);
    }

    renderAdminCategories();
}

function renderAdminOrdersTable() {
    const tbody = document.getElementById('adminOrdersTableBody');
    const countLabel = document.getElementById('adminOrderCount');
    if (!tbody) return;

    if (countLabel) countLabel.innerText = `${state.adminOrders.length} order(s) registered`;

    if (state.adminOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No orders placed yet. Place an order in User Mode to see it here!</td></tr>`;
        return;
    }

    const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    tbody.innerHTML = state.adminOrders.map(ord => {
        const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
        const itemCount = (ord.items || []).reduce((sum, i) => sum + i.quantity, 0);

        const optionsHtml = statuses.map(s => `
            <option value="${s}" ${ord.status === s ? 'selected' : ''}>${s}</option>
        `).join('');

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-6">
                    <span class="font-mono font-bold text-brand-600">${ord.orderNumber}</span>
                    <div class="text-[11px] text-slate-400">${formattedDate}</div>
                </td>
                <td class="py-3 px-4">
                    <div class="font-bold text-slate-800">${escapeHtml(ord.customerName)}</div>
                    <div class="text-[11px] text-slate-500 font-medium">${escapeHtml(ord.customerPhone || ord.customerEmail)}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5" title="${escapeHtml(ord.shippingAddress || '')}">
                        📍 ${escapeHtml(ord.area ? ord.area + ', ' : '')}${escapeHtml(ord.city || '')} - ${escapeHtml(ord.postalCode || '')}
                    </div>
                </td>
                <td class="py-3 px-4 font-medium text-slate-700">${itemCount} item${itemCount === 1 ? '' : 's'}</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-900">₹${formatINR(ord.totalAmount)}</td>
                <td class="py-3 px-4 text-slate-600">
                    <div class="font-bold text-xs text-slate-800">${escapeHtml(ord.paymentMethod || 'UPI')}</div>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${ord.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                        <i class="fa-solid ${ord.paymentStatus === 'PAID' ? 'fa-circle-check text-emerald-600' : 'fa-clock text-amber-600'}"></i>
                        ${ord.paymentStatus || 'PAID'}
                    </span>
                    ${ord.paymentTransactionId ? `<div class="font-mono text-[9px] text-slate-400 truncate max-w-[120px]" title="${escapeHtml(ord.paymentTransactionId)}">${escapeHtml(ord.paymentTransactionId)}</div>` : ''}
                </td>
                <td class="py-3 px-6 text-right">
                    <select onchange="handleAdminOrderStatusChange('${ord.orderNumber}', this.value)"
                            class="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 bg-white shadow-sm focus:outline-none cursor-pointer ${getStatusSelectColor(ord.status)}">
                        ${optionsHtml}
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleAdminOrderStatusChange(orderNumber, newStatus) {
    try {
        const response = await authFetch(`/api/orders/${encodeURIComponent(orderNumber)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update order status');

        showToast(`Order ${orderNumber} updated to ${newStatus}!`, 'success');
        await refreshAdminData();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// ADMIN SELLERS DIRECTORY & DEEP INSPECTION
// -------------------------------------------------------------
async function loadAdminSellers() {
    const tbody = document.getElementById('adminSellersTableBody');
    const countBadge = document.getElementById('adminSellersCountBadge');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading sellers directory...</td></tr>';

    try {
        const res = await authFetch('/api/admin/sellers');
        if (!res.ok) throw new Error('Failed to load sellers');
        state.adminSellers = await res.json();

        if (countBadge) countBadge.innerText = state.adminSellers.length;
        renderAdminSellersTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-rose-500">${escapeHtml(err.message)}</td></tr>`;
    }
}

function filterAdminSellersTable(query) {
    state.adminSellersFilter = (query || '').toLowerCase().trim();
    renderAdminSellersTable();
}

function renderAdminSellersTable() {
    const tbody = document.getElementById('adminSellersTableBody');
    if (!tbody) return;

    let items = state.adminSellers || [];
    if (state.adminSellersFilter) {
        items = items.filter(s =>
            (s.name && s.name.toLowerCase().includes(state.adminSellersFilter)) ||
            (s.storeName && s.storeName.toLowerCase().includes(state.adminSellersFilter)) ||
            (s.email && s.email.toLowerCase().includes(state.adminSellersFilter)) ||
            (s.city && s.city.toLowerCase().includes(state.adminSellersFilter))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">No sellers matching the search criteria.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(s => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-6">
                <div class="font-bold text-slate-900 flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-store"></i></span>
                    <span>${escapeHtml(s.storeName || s.name)}</span>
                </div>
                <div class="text-[11px] text-slate-500 ml-9">Merchant: ${escapeHtml(s.name)} (ID: #${s.id})</div>
            </td>
            <td class="py-3 px-4">
                <div class="font-mono text-slate-700">${escapeHtml(s.email)}</div>
                <div class="text-[11px] text-slate-400">${escapeHtml(s.phone || 'No phone')}</div>
            </td>
            <td class="py-3 px-4 text-slate-600">
                <div>${escapeHtml(s.city || 'India')}</div>
                <div class="text-[11px] text-slate-400">${escapeHtml(s.state || '')}</div>
            </td>
            <td class="py-3 px-4 text-center font-bold text-slate-800">
                <span class="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">${s.totalProducts !== undefined ? s.totalProducts : (s.productsListed || 0)}</span>
            </td>
            <td class="py-3 px-4 text-center font-bold text-indigo-700">
                <span class="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200">${s.totalUnitsSold !== undefined ? s.totalUnitsSold : (s.unitsSold || 0)}</span>
            </td>
            <td class="py-3 px-4 font-mono font-black text-emerald-600">
                ₹${formatINR(s.totalRevenue !== undefined ? s.totalRevenue : (s.grossRevenue || 0))}
            </td>
            <td class="py-3 px-6 text-right">
                <button onclick="openAdminSellerModal(${s.id})" class="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs transition flex items-center gap-1.5 ml-auto">
                    <i class="fa-solid fa-eye text-xs"></i>
                    <span>Inspect</span>
                </button>
            </td>
        </tr>
    `).join('');
}

async function openAdminSellerModal(sellerId) {
    const modal = document.getElementById('adminSellerModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const titleEl = document.getElementById('adminSellerModalTitle');
    const subEl = document.getElementById('adminSellerModalSubtitle');
    const prodCountEl = document.getElementById('adminSellerModalProductsCount');
    const unitsSoldEl = document.getElementById('adminSellerModalUnitsSold');
    const revEl = document.getElementById('adminSellerModalRevenue');
    const prodContainer = document.getElementById('adminSellerProductsContainer');
    const histContainer = document.getElementById('adminSellerHistoryContainer');

    if (titleEl) titleEl.innerText = 'Loading Seller Details...';
    if (prodContainer) prodContainer.innerHTML = '<div class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading products...</div>';
    if (histContainer) histContainer.innerHTML = '<div class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading selling history...</div>';

    switchAdminSellerTab('products');

    try {
        const res = await authFetch(`/api/admin/sellers/${sellerId}`);
        if (!res.ok) throw new Error('Failed to load seller details');
        const detail = await res.json();

        const sellerObj = detail.seller || detail;
        const stats = detail.stats || {};
        const prods = detail.products || [];
        const orders = detail.sellingHistory || detail.sellingOrders || [];

        if (titleEl) titleEl.innerText = sellerObj.storeName || sellerObj.name;
        if (subEl) subEl.innerText = `Merchant: ${sellerObj.name} • ${sellerObj.email} • ${sellerObj.phone || 'No phone'} • 📍 ${sellerObj.city || ''}, ${sellerObj.state || 'India'}`;
        if (prodCountEl) prodCountEl.innerText = stats.activeStockCount !== undefined ? stats.activeStockCount : prods.length;
        if (unitsSoldEl) unitsSoldEl.innerText = stats.totalUnitsSold !== undefined ? stats.totalUnitsSold : 0;
        if (revEl) revEl.innerText = `₹${formatINR(stats.totalRevenue !== undefined ? stats.totalRevenue : 0)}`;

        // Render Listed Products
        if (prods.length === 0) {
            prodContainer.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">No products listed by this seller yet.</div>';
        } else {
            prodContainer.innerHTML = `
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                            <th class="py-2.5 px-3">Product</th>
                            <th class="py-2.5 px-3">Category</th>
                            <th class="py-2.5 px-3 font-mono">Price</th>
                            <th class="py-2.5 px-3">Stock Available</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${prods.map(p => `
                            <tr class="hover:bg-slate-50">
                                <td class="py-2.5 px-3 flex items-center gap-2">
                                    <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" class="w-8 h-8 rounded object-cover border border-slate-200 shrink-0">
                                    <div>
                                        <div class="font-bold text-slate-800">${escapeHtml(p.name)}</div>
                                        <div class="text-[10px] text-slate-400">ID: #${p.id}</div>
                                    </div>
                                </td>
                                <td class="py-2.5 px-3 text-slate-600">${escapeHtml(p.category?.name || p.categoryName || 'General')}</td>
                                <td class="py-2.5 px-3 font-mono font-bold text-slate-900">₹${formatINR(p.price)}</td>
                                <td class="py-2.5 px-3">
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${(p.stockQuantity || 0) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                                        ${p.stockQuantity || 0} units
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        // Render Selling History
        if (orders.length === 0) {
            histContainer.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">No sales recorded for this seller yet.</div>';
        } else {
            histContainer.innerHTML = `
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                            <th class="py-2.5 px-3">Order Number</th>
                            <th class="py-2.5 px-3">Customer</th>
                            <th class="py-2.5 px-3">Item(s) Sold</th>
                            <th class="py-2.5 px-3 font-mono">Seller Earnings</th>
                            <th class="py-2.5 px-3">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${orders.map(o => {
                            const itemsList = (o.items || []).map(i => `${i.quantity}x ${escapeHtml(i.productName)}`).join(', ');
                            return `
                                <tr class="hover:bg-slate-50">
                                    <td class="py-2.5 px-3 font-mono font-bold text-emerald-700">${escapeHtml(o.orderNumber)}</td>
                                    <td class="py-2.5 px-3">
                                        <div class="font-bold text-slate-800">${escapeHtml(o.customerName)}</div>
                                        <div class="text-[10px] text-slate-400">${escapeHtml(o.customerCity || '')}</div>
                                    </td>
                                    <td class="py-2.5 px-3 text-slate-700">${itemsList}</td>
                                    <td class="py-2.5 px-3 font-mono font-bold text-emerald-600">₹${formatINR(o.sellerEarnings)}</td>
                                    <td class="py-2.5 px-3">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(o.status)}">${o.status}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (err) {
        showToast(err.message, 'error');
        if (titleEl) titleEl.innerText = 'Error loading details';
    }
}

function closeAdminSellerModal() {
    document.getElementById('adminSellerModal')?.classList.add('hidden');
}

function switchAdminSellerTab(tab) {
    const prodContainer = document.getElementById('adminSellerProductsContainer');
    const histContainer = document.getElementById('adminSellerHistoryContainer');
    const prodBtn = document.getElementById('adminSellerTabProdBtn');
    const histBtn = document.getElementById('adminSellerTabHistBtn');

    if (tab === 'history') {
        prodContainer?.classList.add('hidden');
        histContainer?.classList.remove('hidden');
        if (histBtn) histBtn.className = 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold';
        if (prodBtn) prodBtn.className = 'px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200';
    } else {
        histContainer?.classList.add('hidden');
        prodContainer?.classList.remove('hidden');
        if (prodBtn) prodBtn.className = 'px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold';
        if (histBtn) histBtn.className = 'px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200';
    }
}

// -------------------------------------------------------------
// ADMIN USERS (BUYERS) DIRECTORY & DEEP INSPECTION
// -------------------------------------------------------------
async function loadAdminUsers() {
    const tbody = document.getElementById('adminUsersTableBody');
    const countBadge = document.getElementById('adminUsersCountBadge');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading users directory...</td></tr>';

    try {
        const res = await authFetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to load users');
        state.adminUsers = await res.json();

        if (countBadge) countBadge.innerText = state.adminUsers.length;
        renderAdminUsersTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-rose-500">${escapeHtml(err.message)}</td></tr>`;
    }
}

function filterAdminUsersTable(query) {
    state.adminUsersFilter = (query || '').toLowerCase().trim();
    renderAdminUsersTable();
}

function renderAdminUsersTable() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    let items = state.adminUsers || [];
    if (state.adminUsersFilter) {
        items = items.filter(u =>
            (u.name && u.name.toLowerCase().includes(state.adminUsersFilter)) ||
            (u.email && u.email.toLowerCase().includes(state.adminUsersFilter)) ||
            (u.city && u.city.toLowerCase().includes(state.adminUsersFilter)) ||
            (u.phone && u.phone.toLowerCase().includes(state.adminUsersFilter))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400">No customers matching the search criteria.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(u => {
        const lastOrderDate = u.lastOrderDate ? new Date(u.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-6">
                    <div class="font-bold text-slate-900 flex items-center gap-2">
                        <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-user"></i></span>
                        <span>${escapeHtml(u.name)}</span>
                    </div>
                    <div class="text-[11px] text-slate-400 ml-9">Customer ID: #${u.id}</div>
                </td>
                <td class="py-3 px-4 font-mono text-slate-700">${escapeHtml(u.email)}</td>
                <td class="py-3 px-4 text-slate-600">${escapeHtml(u.phone || 'No phone')}</td>
                <td class="py-3 px-4 text-slate-600">
                    <div>${escapeHtml(u.city || 'India')}</div>
                    <div class="text-[11px] text-slate-400">${escapeHtml(u.state || '')}</div>
                </td>
                <td class="py-3 px-4 text-center font-bold text-slate-800">
                    <span class="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">${u.totalOrders || 0}</span>
                </td>
                <td class="py-3 px-4 font-mono font-black text-emerald-600">
                    ₹${formatINR(u.totalSpent !== undefined ? u.totalSpent : (u.lifetimeSpend || 0))}
                </td>
                <td class="py-3 px-4 text-slate-500 text-[11px]">
                    ${lastOrderDate}
                </td>
                <td class="py-3 px-6 text-right">
                    <button onclick="openAdminUserModal(${u.id})" class="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition flex items-center gap-1.5 ml-auto">
                        <i class="fa-solid fa-eye text-xs"></i>
                        <span>History</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function openAdminUserModal(userId) {
    const modal = document.getElementById('adminUserModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const titleEl = document.getElementById('adminUserModalTitle');
    const subEl = document.getElementById('adminUserModalSubtitle');
    const ordersCountEl = document.getElementById('adminUserModalOrdersCount');
    const spentEl = document.getElementById('adminUserModalSpent');
    const historyContainer = document.getElementById('adminUserHistoryContainer');

    if (titleEl) titleEl.innerText = 'Loading Customer Profile...';
    if (historyContainer) historyContainer.innerHTML = '<div class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading order history...</div>';

    try {
        const res = await authFetch(`/api/admin/users/${userId}`);
        if (!res.ok) throw new Error('Failed to load user details');
        const detail = await res.json();

        const userObj = detail.user || detail;
        const orders = detail.buyingHistory || detail.orders || [];

        if (titleEl) titleEl.innerText = userObj.name;
        if (subEl) subEl.innerText = `Email: ${userObj.email} • Phone: ${userObj.phone || 'N/A'} • 📍 ${userObj.city || ''}, ${userObj.state || 'India'}`;
        if (ordersCountEl) ordersCountEl.innerText = detail.totalOrders !== undefined ? detail.totalOrders : orders.length;
        if (spentEl) spentEl.innerText = `₹${formatINR(detail.totalSpent !== undefined ? detail.totalSpent : (detail.lifetimeSpend || 0))}`;

        if (orders.length === 0) {
            historyContainer.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">This customer has not placed any orders yet.</div>';
        } else {
            historyContainer.innerHTML = `
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                            <th class="py-2.5 px-3">Order Number & Date</th>
                            <th class="py-2.5 px-3">Items Purchased</th>
                            <th class="py-2.5 px-3 font-mono">Total Amount</th>
                            <th class="py-2.5 px-3">Payment</th>
                            <th class="py-2.5 px-3">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${orders.map(o => {
                            const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
                            const itemsList = (o.items || []).map(i => `${i.quantity}x ${escapeHtml(i.productName)}`).join(', ');
                            return `
                                <tr class="hover:bg-slate-50">
                                    <td class="py-2.5 px-3">
                                        <div class="font-mono font-bold text-brand-600">${escapeHtml(o.orderNumber)}</div>
                                        <div class="text-[10px] text-slate-400">${dateStr}</div>
                                    </td>
                                    <td class="py-2.5 px-3 text-slate-700">${itemsList}</td>
                                    <td class="py-2.5 px-3 font-mono font-bold text-slate-900">₹${formatINR(o.totalAmount)}</td>
                                    <td class="py-2.5 px-3">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${o.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                            ${escapeHtml(o.paymentMethod || 'UPI')} (${o.paymentStatus || 'PAID'})
                                        </span>
                                    </td>
                                    <td class="py-2.5 px-3">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(o.status)}">${o.status}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (err) {
        showToast(err.message, 'error');
        if (titleEl) titleEl.innerText = 'Error loading customer';
    }
}

function closeAdminUserModal() {
    document.getElementById('adminUserModal')?.classList.add('hidden');
}

function renderAdminCategories() {
    const container = document.getElementById('adminCategoryCards');
    if (!container) return;

    container.innerHTML = state.categories.map(c => {
        const prodCount = state.products.filter(p => p.category && p.category.id === c.id).length;
        return `
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                    <h4 class="text-xs font-bold text-slate-900">${escapeHtml(c.name)}</h4>
                    <span class="text-[10px] font-mono text-slate-400">/${escapeHtml(c.slug)}</span>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    ${prodCount} items
                </span>
            </div>
        `;
    }).join('');
}

// Admin: Add Category
function openAddCategoryModal() {
    document.getElementById('addCategoryForm')?.reset();
    document.getElementById('addCategoryModal')?.classList.remove('hidden');
}

function closeAddCategoryModal() { document.getElementById('addCategoryModal')?.classList.add('hidden'); }

async function handleCreateCategory(event) {
    event.preventDefault();
    const name = document.getElementById('newCatName').value.trim();
    const slug = document.getElementById('newCatSlug').value.trim();
    const description = document.getElementById('newCatDesc').value.trim();

    try {
        const response = await authFetch('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name, slug, description })
        });
        if (!response.ok) throw new Error('Failed to create category');

        showToast(`Category "${name}" created!`, 'success');
        closeAddCategoryModal();
        await fetchCategories();
        renderAdminCategories();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// STATUS BADGES & HELPERS
// -------------------------------------------------------------
function getStatusBadgeClass(status) {
    switch (status) {
        case 'DELIVERED': return 'bg-emerald-100 text-emerald-800';
        case 'SHIPPED': return 'bg-blue-100 text-blue-800';
        case 'PROCESSING': return 'bg-indigo-100 text-indigo-800';
        case 'CONFIRMED': return 'bg-purple-100 text-purple-800';
        case 'CANCELLED': return 'bg-rose-100 text-rose-800';
        default: return 'bg-amber-100 text-amber-800';
    }
}

function getStatusSelectColor(status) {
    switch (status) {
        case 'DELIVERED': return 'text-emerald-700 border-emerald-300';
        case 'SHIPPED': return 'text-blue-700 border-blue-300';
        case 'CANCELLED': return 'text-rose-700 border-rose-300';
        default: return 'text-slate-800 border-slate-300';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-slate-900 text-white border-l-4 border-emerald-500',
        error: 'bg-slate-900 text-white border-l-4 border-rose-500',
        info: 'bg-slate-900 text-white border-l-4 border-brand-500'
    };

    const icons = {
        success: '<i class="fa-solid fa-circle-check text-emerald-400 mr-2"></i>',
        error: '<i class="fa-solid fa-circle-exclamation text-rose-400 mr-2"></i>',
        info: '<i class="fa-solid fa-circle-info text-brand-400 mr-2"></i>'
    };

    toast.className = `toast-enter flex items-center px-4 py-3 rounded-xl shadow-xl text-xs font-medium max-w-sm pointer-events-auto transition-all ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
