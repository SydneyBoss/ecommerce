/**
 * NOVA E-Commerce Application Frontend
 * Supports User Mode (Shopper), Seller Mode (Inventory Hub), and Admin Mode (Operations Dashboard)
 */

// Application State
const state = {
    currentMode: 'user', // 'user' | 'seller' | 'admin'
    products: [],
    categories: [],
    cart: JSON.parse(localStorage.getItem('nova_cart') || '[]'),
    currentCategory: 'all',
    searchQuery: '',
    currentSort: 'default',
    lastPlacedOrder: null,
    sellerFilterQuery: '',
    adminOrders: []
};

// DOM Content Loaded Entrypoint
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
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
// MODE SWITCHER (USER / SELLER / ADMIN)
// -------------------------------------------------------------
function switchMode(mode) {
    if (!['user', 'seller', 'admin'].includes(mode)) mode = 'user';
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
            const cardFields = document.getElementById('cardFields');
            if (cardFields) cardFields.style.display = e.target.value === 'Credit Card' ? 'block' : 'none';
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
            closeAddProductModal();
            closeQuickEditModal();
            closeAddCategoryModal();
        }
    });
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
            ? `<span class="text-xs line-through text-slate-400 ml-1.5">$${Number(product.originalPrice).toFixed(2)}</span>`
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
                            <span class="text-lg font-extrabold text-slate-900">$${Number(product.price).toFixed(2)}</span>
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
        ? `<span class="text-sm line-through text-slate-400 ml-2">$${Number(product.originalPrice).toFixed(2)}</span>`
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
                        <span class="text-3xl font-extrabold text-slate-900">$${Number(product.price).toFixed(2)}</span>
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
    const shipping = subtotal >= 100 || subtotal === 0 ? 0 : 9.99;
    const tax = +(subtotal * 0.075).toFixed(2);
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
                <p class="text-[11px] text-slate-500">$${item.price.toFixed(2)} each</p>
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
                <span class="text-sm font-bold text-slate-900">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    const { subtotal, shipping, tax, total } = calculateCartTotals();
    document.getElementById('cartSubtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartShipping').innerText = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    document.getElementById('cartTax').innerText = `$${tax.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;

    const progressPercent = Math.min(100, Math.round((subtotal / 100) * 100));
    const progressBar = document.getElementById('shippingProgressBar');
    const progressText = document.getElementById('shippingProgressText');
    const percentText = document.getElementById('shippingProgressPercent');

    if (progressBar && progressText && percentText) {
        progressBar.style.width = `${progressPercent}%`;
        percentText.innerText = `${progressPercent}%`;
        progressText.innerHTML = subtotal >= 100
            ? `🎉 You've unlocked <strong class="text-emerald-700">FREE Shipping!</strong>`
            : `Add $${(100 - subtotal).toFixed(2)} more for FREE Shipping!`;
    }
}

function openCheckoutModal() {
    if (state.cart.length === 0) { showToast('Your cart is empty', 'error'); return; }
    closeCart();
    const { total } = calculateCartTotals();
    document.getElementById('checkoutTotalAmount').innerText = `$${total.toFixed(2)}`;
    document.getElementById('checkoutModal')?.classList.remove('hidden');
}

function closeCheckoutModal() { document.getElementById('checkoutModal')?.classList.add('hidden'); }

async function handlePlaceOrder(event) {
    event.preventDefault();
    if (state.cart.length === 0) return;

    const submitBtn = document.getElementById('submitOrderBtn');
    const spinner = document.getElementById('submitOrderSpinner');
    const btnText = document.getElementById('submitOrderText');

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerText = 'Processing Order...';

    const orderPayload = {
        customerName: document.getElementById('custName').value.trim(),
        customerEmail: document.getElementById('custEmail').value.trim(),
        customerPhone: document.getElementById('custPhone')?.value.trim(),
        shippingAddress: document.getElementById('custAddress').value.trim(),
        city: document.getElementById('custCity').value.trim(),
        postalCode: document.getElementById('custPostal').value.trim(),
        country: 'United States',
        paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Credit Card',
        items: state.cart.map(item => ({ productId: item.id, quantity: item.quantity }))
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to complete order');

        state.lastPlacedOrder = data;
        savePlacedOrderToHistory(data.orderNumber);
        state.cart = [];
        saveCart();
        updateCartBadge();
        await loadProducts();

        closeCheckoutModal();
        showOrderConfirmation(data);
    } catch (err) {
        console.error('Error placing order:', err);
        showToast(err.message || 'Error submitting order', 'error');
    } finally {
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.innerText = 'Confirm & Place Order';
    }
}

function showOrderConfirmation(order) {
    document.getElementById('confirmedOrderNumber').innerText = order.orderNumber;
    document.getElementById('confirmedCustomerName').innerText = order.customerName;
    document.getElementById('confirmedTotalAmount').innerText = `$${Number(order.totalAmount).toFixed(2)}`;
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
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Failed to fetch orders');
        const orders = await response.json();

        if (orders.length === 0) {
            container.innerHTML = `<div class="text-center py-8 text-slate-500"><i class="fa-solid fa-receipt text-3xl text-slate-300 mb-2"></i><p class="text-xs font-semibold">No orders recorded yet.</p></div>`;
            return;
        }

        container.innerHTML = orders.map(ord => renderCustomerOrderCard(ord)).join('');
    } catch (err) {
        container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-xl text-xs">Failed to load order history.</div>`;
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
            <span class="font-semibold text-slate-900">$${Number(item.subtotal).toFixed(2)}</span>
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
            <div class="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs">
                <span class="text-slate-500">Recipient: <strong class="text-slate-800">${escapeHtml(order.customerName)}</strong></span>
                <span class="text-sm font-extrabold text-slate-900">Total: $${Number(order.totalAmount).toFixed(2)}</span>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// SELLER MODE: INVENTORY MANAGEMENT & LISTINGS
// -------------------------------------------------------------
function renderSellerView() {
    const totalListings = state.products.length;
    const totalStock = state.products.reduce((sum, p) => sum + (p.stockQuantity || 0), 0);
    const lowStock = state.products.filter(p => (p.stockQuantity || 0) > 0 && p.stockQuantity < 10).length;
    const outOfStock = state.products.filter(p => (p.stockQuantity || 0) <= 0).length;

    document.getElementById('sellerTotalListings').innerText = totalListings;
    document.getElementById('sellerTotalStock').innerText = totalStock;
    document.getElementById('sellerLowStock').innerText = lowStock;
    document.getElementById('sellerOutOfStock').innerText = outOfStock;

    renderSellerTable();
}

function filterSellerTable(query) {
    state.sellerFilterQuery = (query || '').toLowerCase().trim();
    renderSellerTable();
}

function renderSellerTable() {
    const tbody = document.getElementById('sellerTableBody');
    if (!tbody) return;

    let items = [...state.products];
    if (state.sellerFilterQuery) {
        items = items.filter(p =>
            p.name.toLowerCase().includes(state.sellerFilterQuery) ||
            (p.category && p.category.name.toLowerCase().includes(state.sellerFilterQuery))
        );
    }

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No matching seller products found.</td></tr>`;
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

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-6 flex items-center gap-3">
                    <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'}" class="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0">
                    <div>
                        <div class="font-bold text-slate-900">${escapeHtml(p.name)}</div>
                        <div class="text-[11px] text-slate-400">ID: #${p.id}</div>
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-600 font-medium">${escapeHtml(p.category?.name || 'General')}</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-900">$${Number(p.price).toFixed(2)}</td>
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
        const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete listing');
        showToast(`Listing "${name}" deleted.`, 'info');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// -------------------------------------------------------------
// ADMIN MODE: EXECUTIVE DASHBOARD & STATUS MANAGEMENT
// -------------------------------------------------------------
async function renderAdminView() {
    await refreshAdminData();
    renderAdminCategories();
}

async function refreshAdminData() {
    // 1. Fetch dashboard KPI stats
    try {
        const statsRes = await fetch('/api/orders/stats/dashboard');
        if (statsRes.ok) {
            const stats = await statsRes.json();
            document.getElementById('adminTotalRevenue').innerText = `$${Number(stats.totalRevenue || 0).toFixed(2)}`;
            document.getElementById('adminTotalOrders').innerText = stats.totalOrders || 0;
            document.getElementById('adminPendingOrders').innerText = stats.pendingOrdersCount || 0;
            document.getElementById('adminTotalProducts').innerText = stats.totalProducts || 0;
        }
    } catch (err) {
        console.error('Error fetching admin stats:', err);
    }

    // 2. Fetch all orders for management table
    try {
        const ordersRes = await fetch('/api/orders');
        if (ordersRes.ok) {
            state.adminOrders = await ordersRes.json();
            renderAdminOrdersTable();
        }
    } catch (err) {
        console.error('Error fetching admin orders:', err);
    }
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
                    <div class="text-[11px] text-slate-400">${escapeHtml(ord.customerEmail)}</div>
                </td>
                <td class="py-3 px-4 font-medium text-slate-700">${itemCount} item${itemCount === 1 ? '' : 's'}</td>
                <td class="py-3 px-4 font-mono font-bold text-slate-900">$${Number(ord.totalAmount).toFixed(2)}</td>
                <td class="py-3 px-4 text-slate-600">${escapeHtml(ord.paymentMethod || 'Credit Card')}</td>
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
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Failed to update order status');

        showToast(`Order ${orderNumber} updated to ${newStatus}!`, 'success');
        await refreshAdminData();
    } catch (err) {
        showToast(err.message, 'error');
    }
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
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
