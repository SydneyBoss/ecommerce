/**
 * NOVA E-Commerce Application Frontend
 * Clean modern Vanilla JavaScript communicating with Spring Boot REST API
 */

// Application State
const state = {
    products: [],
    categories: [],
    cart: JSON.parse(localStorage.getItem('nova_cart') || '[]'),
    currentCategory: 'all',
    searchQuery: '',
    currentSort: 'default',
    lastPlacedOrder: null
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
}

// -------------------------------------------------------------
// EVENT LISTENERS SETUP
// -------------------------------------------------------------
function setupEventListeners() {
    // Search inputs
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            state.searchQuery = e.target.value.trim();
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('hidden', state.searchQuery.length === 0);
            }
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

    // Open/Close Cart
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
            if (cardFields) {
                cardFields.style.display = e.target.value === 'Credit Card' ? 'block' : 'none';
            }
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
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

function renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    // Keep "All Products" button and append dynamic categories
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

async function loadProducts() {
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        // Show shimmer skeletons
        productGrid.innerHTML = Array(8).fill(0).map(() => `
            <div class="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                <div class="w-full h-48 rounded-xl shimmer"></div>
                <div class="h-4 w-3/4 rounded shimmer"></div>
                <div class="h-3 w-1/2 rounded shimmer"></div>
                <div class="flex justify-between items-center pt-2">
                    <div class="h-5 w-1/3 rounded shimmer"></div>
                    <div class="h-8 w-1/3 rounded-xl shimmer"></div>
                </div>
            </div>
        `).join('');
    }

    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        state.products = await response.json();
        renderProducts();
    } catch (err) {
        console.error('Error fetching products:', err);
        showToast('Unable to load products from server.', 'error');
    }
}

// -------------------------------------------------------------
// FILTERING & SORTING LOGIC
// -------------------------------------------------------------
function filterCategory(slug) {
    state.currentCategory = slug;

    // Update active pill styling
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
    const catalog = document.getElementById('catalog');
    if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
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

    // Category filter
    if (state.currentCategory !== 'all') {
        result = result.filter(p => p.category && p.category.slug === state.currentCategory);
    }

    // Search query filter
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.category && p.category.name.toLowerCase().includes(q))
        );
    }

    // Sort
    switch (state.currentSort) {
        case 'price-asc':
            result.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            result.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'name':
            result.sort((a, b) => a.name.localeCompare(b.name));
            break;
        default:
            // Featured items first
            result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
            break;
    }

    return result;
}

// -------------------------------------------------------------
// RENDER PRODUCT CARDS
// -------------------------------------------------------------
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
            ? `<span class="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">${product.badge}</span>`
            : (product.featured ? `<span class="absolute top-3 left-3 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm z-10">Featured</span>` : '');

        const discountHtml = product.originalPrice && product.originalPrice > product.price
            ? `<span class="text-xs line-through text-slate-400 ml-1.5">$${Number(product.originalPrice).toFixed(2)}</span>`
            : '';

        const starsHtml = renderStarRating(product.rating || 4.5);

        return `
            <div class="product-card bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col group">
                <!-- Thumbnail -->
                <div class="product-img-wrapper relative h-56 bg-slate-100 overflow-hidden cursor-pointer" onclick="openProductModal(${product.id})">
                    ${badgeHtml}
                    <img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover object-center" loading="lazy">
                    <button onclick="event.stopPropagation(); openProductModal(${product.id})" class="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0" title="Quick View">
                        <i class="fa-solid fa-eye text-xs"></i>
                    </button>
                </div>

                <!-- Info -->
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

                    <!-- Price & Add Button -->
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
        if (i <= Math.floor(rating)) {
            stars += '<i class="fa-solid fa-star"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fa-solid fa-star-half-stroke"></i>';
        } else {
            stars += '<i class="fa-regular fa-star"></i>';
        }
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
            <!-- Modal Image -->
            <div class="relative bg-slate-100 h-72 md:h-full min-h-[300px]">
                <img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover">
                ${product.badge ? `<span class="absolute top-4 left-4 bg-slate-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">${product.badge}</span>` : ''}
            </div>

            <!-- Modal Details -->
            <div class="p-6 md:p-8 flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between pb-3">
                        <span class="text-xs font-bold text-brand-600 uppercase tracking-wider">${escapeHtml(product.category?.name || 'Category')}</span>
                        <button onclick="closeProductModal()" class="text-slate-400 hover:text-slate-600 p-1">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>

                    <h2 class="text-xl md:text-2xl font-extrabold text-slate-900 mb-2">${escapeHtml(product.name)}</h2>

                    <!-- Ratings -->
                    <div class="flex items-center gap-2 mb-4">
                        <div class="text-amber-500 text-xs flex gap-0.5">
                            ${renderStarRating(product.rating || 4.8)}
                        </div>
                        <span class="text-xs font-bold text-slate-700">${product.rating ? product.rating.toFixed(1) : '4.8'}</span>
                        <span class="text-xs text-slate-400">(${product.reviewCount || 0} reviews)</span>
                        <span class="text-slate-300">•</span>
                        <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <i class="fa-solid fa-check text-[10px]"></i> In Stock (${product.stockQuantity})
                        </span>
                    </div>

                    <!-- Price -->
                    <div class="flex items-baseline mb-4 pb-4 border-b border-slate-100">
                        <span class="text-3xl font-extrabold text-slate-900">$${Number(product.price).toFixed(2)}</span>
                        ${discountHtml}
                    </div>

                    <!-- Description -->
                    <div class="space-y-2 text-sm text-slate-600 leading-relaxed mb-6">
                        <p>${escapeHtml(product.description || '')}</p>
                    </div>

                    <!-- Perks -->
                    <div class="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-6 py-3 border-y border-slate-100">
                        <div class="flex items-center gap-1.5"><i class="fa-solid fa-truck text-brand-600"></i> Free Delivery >$100</div>
                        <div class="flex items-center gap-1.5"><i class="fa-solid fa-shield text-brand-600"></i> 2-Year Warranty</div>
                    </div>
                </div>

                <!-- Add to Cart in Modal -->
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

function closeProductModal() {
    document.getElementById('productModal')?.classList.add('hidden');
}

function incrementModalQty(maxStock) {
    const input = document.getElementById('modalQtyInput');
    if (input) {
        let val = parseInt(input.value) || 1;
        if (val < maxStock) input.value = val + 1;
    }
}

function decrementModalQty() {
    const input = document.getElementById('modalQtyInput');
    if (input) {
        let val = parseInt(input.value) || 1;
        if (val > 1) input.value = val - 1;
    }
}

function addModalItemToCart(productId) {
    const input = document.getElementById('modalQtyInput');
    const qty = input ? parseInt(input.value) || 1 : 1;
    addToCart(productId, qty);
    closeProductModal();
}

// -------------------------------------------------------------
// SHOPPING CART MANAGEMENT
// -------------------------------------------------------------
function addToCart(productId, quantity = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existing = state.cart.find(item => item.id === productId);

    if (existing) {
        if (existing.quantity + quantity > product.stockQuantity) {
            showToast(`Sorry, only ${product.stockQuantity} units available in stock.`, 'error');
            return;
        }
        existing.quantity += quantity;
    } else {
        if (quantity > product.stockQuantity) {
            showToast(`Sorry, item is out of stock.`, 'error');
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

    if (newQty <= 0) {
        removeFromCart(productId);
        return;
    }

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

function saveCart() {
    localStorage.setItem('nova_cart', JSON.stringify(state.cart));
}

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
        setTimeout(() => {
            drawer.classList.add('hidden');
        }, 300);
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
            <img src="${item.imageUrl}" alt="${escapeHtml(item.name)}" class="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0">
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

    // Update Totals
    const { subtotal, shipping, tax, total } = calculateCartTotals();
    document.getElementById('cartSubtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('cartShipping').innerText = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    document.getElementById('cartTax').innerText = `$${tax.toFixed(2)}`;
    document.getElementById('cartTotal').innerText = `$${total.toFixed(2)}`;

    // Free shipping bar
    const progressPercent = Math.min(100, Math.round((subtotal / 100) * 100));
    const progressBar = document.getElementById('shippingProgressBar');
    const progressText = document.getElementById('shippingProgressText');
    const percentText = document.getElementById('shippingProgressPercent');

    if (progressBar && progressText && percentText) {
        progressBar.style.width = `${progressPercent}%`;
        percentText.innerText = `${progressPercent}%`;
        if (subtotal >= 100) {
            progressText.innerHTML = `🎉 You've unlocked <strong class="text-emerald-700">FREE Shipping!</strong>`;
        } else {
            const needed = (100 - subtotal).toFixed(2);
            progressText.innerText = `Add $${needed} more for FREE Shipping!`;
        }
    }
}

// -------------------------------------------------------------
// CHECKOUT & ORDER PLACEMENT
// -------------------------------------------------------------
function openCheckoutModal() {
    if (state.cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }
    closeCart();

    const { total } = calculateCartTotals();
    document.getElementById('checkoutTotalAmount').innerText = `$${total.toFixed(2)}`;
    document.getElementById('checkoutModal')?.classList.remove('hidden');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal')?.classList.add('hidden');
}

async function handlePlaceOrder(event) {
    event.preventDefault();

    if (state.cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitOrderBtn');
    const spinner = document.getElementById('submitOrderSpinner');
    const btnText = document.getElementById('submitOrderText');

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.innerText = 'Processing Order...';

    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'Credit Card';

    const orderPayload = {
        customerName: document.getElementById('custName').value.trim(),
        customerEmail: document.getElementById('custEmail').value.trim(),
        customerPhone: document.getElementById('custPhone')?.value.trim(),
        shippingAddress: document.getElementById('custAddress').value.trim(),
        city: document.getElementById('custCity').value.trim(),
        postalCode: document.getElementById('custPostal').value.trim(),
        country: 'United States',
        paymentMethod: selectedPayment,
        items: state.cart.map(item => ({
            productId: item.id,
            quantity: item.quantity
        }))
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete order');
        }

        // Success!
        state.lastPlacedOrder = data;

        // Save order number to local tracking storage
        savePlacedOrderToHistory(data.orderNumber);

        // Clear cart
        state.cart = [];
        saveCart();
        updateCartBadge();

        // Refresh stock numbers in UI
        await loadProducts();

        // Close checkout and show confirmation
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

function closeSuccessModal() {
    document.getElementById('orderSuccessModal')?.classList.add('hidden');
}

function closeSuccessModalAndOpenOrders() {
    closeSuccessModal();
    openOrdersModal();
}

// -------------------------------------------------------------
// ORDER TRACKING & HISTORY MODAL
// -------------------------------------------------------------
function savePlacedOrderToHistory(orderNumber) {
    const list = JSON.parse(localStorage.getItem('nova_my_orders') || '[]');
    if (!list.includes(orderNumber)) {
        list.unshift(orderNumber);
        localStorage.setItem('nova_my_orders', JSON.stringify(list));
    }
}

async function openOrdersModal() {
    const modal = document.getElementById('ordersModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    await fetchAndRenderOrders();
}

function closeOrdersModal() {
    document.getElementById('ordersModal')?.classList.add('hidden');
}

async function fetchAndRenderOrders() {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-6 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading order records...</div>';

    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Failed to fetch orders');
        const orders = await response.json();

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <i class="fa-solid fa-receipt text-3xl text-slate-300 mb-2"></i>
                    <p class="text-xs font-semibold">No orders recorded yet.</p>
                    <p class="text-[11px] text-slate-400">Place an order to see it live here!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(ord => renderOrderCard(ord)).join('');
    } catch (err) {
        console.error('Error fetching orders:', err);
        container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-xl text-xs">Failed to load order history from backend.</div>`;
    }
}

async function lookupSpecificOrder() {
    const input = document.getElementById('lookupOrderNumber');
    const orderNumber = input ? input.value.trim() : '';
    if (!orderNumber) {
        showToast('Please enter an order number', 'info');
        return;
    }

    const container = document.getElementById('ordersListContainer');
    container.innerHTML = '<div class="text-center py-6 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Looking up order...</div>';

    try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
        if (!response.ok) throw new Error('Order not found');
        const order = await response.json();
        container.innerHTML = renderOrderCard(order);
    } catch (err) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <i class="fa-solid fa-circle-xmark text-3xl text-red-400 mb-2"></i>
                <p class="text-xs font-bold text-slate-700">No order found with number: ${escapeHtml(orderNumber)}</p>
                <button onclick="fetchAndRenderOrders()" class="mt-3 text-xs text-brand-600 font-semibold hover:underline">View all orders</button>
            </div>
        `;
    }
}

function renderOrderCard(order) {
    const formattedDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recently';

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
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                    ${order.status || 'CONFIRMED'}
                </span>
            </div>
            
            <!-- Items -->
            <div class="divide-y divide-slate-100">
                ${itemsHtml}
            </div>

            <!-- Totals & Customer -->
            <div class="pt-2 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs">
                <span class="text-slate-500">Recipient: <strong class="text-slate-800">${escapeHtml(order.customerName)}</strong></span>
                <span class="text-sm font-extrabold text-slate-900">Total: $${Number(order.totalAmount).toFixed(2)}</span>
            </div>
        </div>
    `;
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS & UTILS
// -------------------------------------------------------------
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
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
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
