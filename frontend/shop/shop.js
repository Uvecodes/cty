(function () {
  'use strict';

  const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://cty-7cyi.onrender.com';

  // ─── State ────────────────────────────────────────────────────────────────────
  let currentUser = null;
  let userBalance = 0;
  let userVirtualPurchases = [];
  let flwPublicKey = null;
  let activeOrderProduct = null;
  let activeOrderQty = 1;

  // ─── Products ─────────────────────────────────────────────────────────────────
  // Virtual items  → purchased with in-app coins (authenticated users only)
  // Physical items → purchased with real money via Flutterwave (all users)
  const PRODUCTS = [
    {
      id: 'avatar-1',
      name: 'Cool Avatar',
      description: 'A fun avatar to personalize your profile',
      category: 'avatars',
      price: 50,
      currency: 'coins',
      emoji: '🧑',
      type: 'virtual'
    },
    {
      id: 'avatar-2',
      name: 'Star Avatar',
      description: 'Shine bright with this star avatar',
      category: 'avatars',
      price: 75,
      currency: 'coins',
      emoji: '⭐',
      type: 'virtual'
    },
    {
      id: 'badge-1',
      name: 'Champion Badge',
      description: 'Show off your achievements with pride',
      category: 'badges',
      price: 150,
      currency: 'coins',
      emoji: '🏆',
      type: 'virtual'
    },
    {
      id: 'badge-2',
      name: 'Star Badge',
      description: 'You are a shining star!',
      category: 'badges',
      price: 120,
      currency: 'coins',
      emoji: '🌟',
      type: 'virtual'
    },
    {
      id: 'powerup-1',
      name: 'Double Points',
      description: 'Earn double points for one whole day',
      category: 'powerups',
      price: 200,
      currency: 'coins',
      emoji: '🚀',
      type: 'virtual'
    },
    {
      id: 'powerup-2',
      name: 'Streak Protector',
      description: 'Keep your streak safe for one day',
      category: 'powerups',
      price: 250,
      currency: 'coins',
      emoji: '🔥',
      type: 'virtual'
    },
    {
      id: 'shirt-1',
      name: 'CTY T-Shirt',
      description: 'Show your faith with our official Catch Them Young t-shirt. 100% premium cotton.',
      category: 'shirts',
      price: 10,
      currency: 'USD',
      emoji: '👕',
      type: 'physical',
      hasSizes: true
    },
    {
      id: 'cap-1',
      name: 'CTY Cap',
      description: 'A stylish cap featuring the Catch Them Young logo. One size fits all.',
      category: 'cap',
      price: 8,
      currency: 'USD',
      emoji: '🧢',
      type: 'physical'
    },
    {
      id: 'band-1',
      name: 'CTY Wrist Band',
      description: 'A fun rubber wrist band — wear your faith everywhere you go!',
      category: 'wrist-bands',
      price: 3,
      currency: 'USD',
      emoji: '💛',
      type: 'physical'
    }
  ];

  // ─── Toast ────────────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (toast.timeoutId) clearTimeout(toast.timeoutId);
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toast.timeoutId = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3500);
  }

  // ─── Load Flutterwave public key ──────────────────────────────────────────────
  async function loadPublicConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/support/public-config`);
      if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
      const data = await res.json();
      flwPublicKey = data.flwPublicKey;
    } catch (err) {
      console.warn('⚠️ Payment config unavailable:', err.message);
    }
  }

  // ─── Nav auth actions ─────────────────────────────────────────────────────────
  function updateNavAuth(user) {
    const container = document.getElementById('auth-nav-actions');
    if (!container) return;
    if (user) {
      container.innerHTML = `<a href="../dashboard-files/profile.html" class="nav-profile-link">My Profile</a>`;
    } else {
      container.innerHTML = `
        <a href="../authentication/login.html">Log In</a>
        <a href="../authentication/signup.html" class="nav-signup-btn">Sign Up</a>
      `;
    }
  }

  // ─── Balance / guest banner ───────────────────────────────────────────────────
  function renderBalanceDisplay(user) {
    const container = document.getElementById('balance-display');
    const guestBanner = document.getElementById('guest-banner');

    if (user) {
      if (guestBanner) guestBanner.style.display = 'none';
      if (container) {
        container.innerHTML = `
          <div class="balance-card">
            <img src="../assets/icons/six-sides-star-cty.svg" alt="coins" width="30" class="balance-icon">
            <div class="balance-info">
              <span class="balance-label">Your Coins</span>
              <span class="balance-amount" id="user-balance">${userBalance.toLocaleString()}</span>
            </div>
          </div>
        `;
      }
    } else {
      if (guestBanner) guestBanner.style.display = '';
      if (container) container.innerHTML = '';
    }
  }

  // ─── Load user Firestore data ─────────────────────────────────────────────────
  async function loadUserData() {
    if (!currentUser) return;
    try {
      const userDoc = await firebase.firestore()
        .collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        const d = userDoc.data();
        userBalance = d.coins || 0;
        userVirtualPurchases = d.purchases || [];
      } else {
        // First visit — give starter coins
        userBalance = 100;
        await firebase.firestore().collection('users').doc(currentUser.uid)
          .set({ coins: 100, purchases: [] }, { merge: true });
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }

  // ─── Render products ──────────────────────────────────────────────────────────
  function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    PRODUCTS.forEach(product => grid.appendChild(buildProductCard(product)));
    setupCategoryFilters();
  }

  function buildProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.category = product.category;
    card.dataset.productId = product.id;

    const isVirtual = product.type === 'virtual';
    const isOwned = isVirtual && userVirtualPurchases.includes(product.id);

    if (isOwned) card.classList.add('owned');

    // Price HTML
    const priceHTML = isVirtual
      ? `<div class="product-price">
           <img src="../assets/icons/six-sides-star-cty.svg" alt="coins" class="price-icon">
           <span>${product.price}</span>
         </div>`
      : `<div class="product-price physical-price">$${product.price} USD</div>`;

    // Button HTML
    let btnHTML;
    if (isOwned) {
      btnHTML = `<button class="buy-btn" disabled>Owned</button>`;
    } else if (isVirtual && !currentUser) {
      btnHTML = `<a href="../authentication/login.html" class="buy-btn btn-login-to-buy">Log in to Buy</a>`;
    } else if (isVirtual) {
      const canAfford = userBalance >= product.price;
      btnHTML = `<button class="buy-btn ${canAfford ? '' : 'insufficient-funds'}" data-product-id="${product.id}">
        ${canAfford ? 'Buy' : 'Need More Coins'}
      </button>`;
    } else {
      btnHTML = `<button class="buy-btn btn-buy-physical" data-product-id="${product.id}">Buy Now</button>`;
    }

    // Type badge
    const typeBadge = isVirtual
      ? `<span class="product-type-badge virtual-badge">Virtual</span>`
      : `<span class="product-type-badge physical-badge">Merchandise</span>`;

    card.innerHTML = `
      ${typeBadge}
      <div class="product-image">
        <span class="product-emoji">${product.emoji}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-footer">
          ${priceHTML}
          ${btnHTML}
        </div>
      </div>
    `;

    // Wire up buttons
    if (isVirtual && !isOwned && currentUser) {
      card.querySelector('.buy-btn').addEventListener('click', () => handleVirtualPurchase(product));
    } else if (!isVirtual) {
      card.querySelector('.buy-btn').addEventListener('click', () => openOrderModal(product));
    }

    return card;
  }

  // ─── Virtual purchase (coins) ─────────────────────────────────────────────────
  async function handleVirtualPurchase(product) {
    if (!currentUser) return;
    if (userVirtualPurchases.includes(product.id)) {
      showToast('You already own this item!', 'error');
      return;
    }
    if (userBalance < product.price) {
      showToast(`You need ${product.price - userBalance} more coins!`, 'error');
      return;
    }

    try {
      const newBalance = userBalance - product.price;
      const newPurchases = [...userVirtualPurchases, product.id];

      await firebase.firestore().collection('users').doc(currentUser.uid).update({
        coins: newBalance,
        purchases: newPurchases,
        lastPurchase: firebase.firestore.FieldValue.serverTimestamp()
      });

      userBalance = newBalance;
      userVirtualPurchases = newPurchases;

      const balEl = document.getElementById('user-balance');
      if (balEl) balEl.textContent = userBalance.toLocaleString();

      showToast(`You got ${product.name}!`, 'success');
      renderProducts();
      renderVirtualPurchases();
    } catch (err) {
      console.error('Virtual purchase error:', err);
      showToast('Purchase failed. Please try again.', 'error');
    }
  }

  // ─── Render virtual purchases panel ──────────────────────────────────────────
  function renderVirtualPurchases() {
    const section = document.getElementById('purchases-section');
    const grid = document.getElementById('purchases-grid');
    if (!section || !grid) return;

    if (!currentUser) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    grid.innerHTML = '';

    const owned = PRODUCTS.filter(p => p.type === 'virtual' && userVirtualPurchases.includes(p.id));
    if (owned.length === 0) {
      grid.innerHTML = '<p class="empty-message">No virtual items yet. Start shopping!</p>';
      return;
    }

    owned.forEach(product => {
      const item = document.createElement('div');
      item.className = 'purchase-item';
      item.innerHTML = `
        <span class="purchase-emoji">${product.emoji}</span>
        <span class="purchase-name">${product.name}</span>
      `;
      grid.appendChild(item);
    });
  }

  // ─── Order modal (physical items) ────────────────────────────────────────────
  function openOrderModal(product) {
    activeOrderProduct = product;
    activeOrderQty = 1;

    document.getElementById('modal-product-name').textContent = product.name;
    document.getElementById('modal-product-price').textContent = `$${product.price} USD`;
    document.getElementById('modal-product-icon').textContent = product.emoji;
    document.getElementById('qty-value').textContent = 1;

    const sizeField = document.getElementById('size-field');
    if (sizeField) sizeField.style.display = product.hasSizes ? '' : 'none';

    const emailInput = document.getElementById('order-email');
    if (emailInput) emailInput.value = currentUser ? (currentUser.email || '') : '';

    document.getElementById('order-modal').style.display = 'flex';
  }

  function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
    activeOrderProduct = null;
    activeOrderQty = 1;
  }

  function initOrderModal() {
    document.getElementById('modal-close').addEventListener('click', closeOrderModal);
    document.getElementById('order-modal').addEventListener('click', (e) => {
      if (e.target.id === 'order-modal') closeOrderModal();
    });

    document.getElementById('qty-decrease').addEventListener('click', () => {
      if (activeOrderQty > 1) {
        activeOrderQty--;
        document.getElementById('qty-value').textContent = activeOrderQty;
      }
    });

    document.getElementById('qty-increase').addEventListener('click', () => {
      if (activeOrderQty < 10) {
        activeOrderQty++;
        document.getElementById('qty-value').textContent = activeOrderQty;
      }
    });

    document.getElementById('btn-proceed').addEventListener('click', handleProceedToPayment);
  }

  function handleProceedToPayment() {
    if (!activeOrderProduct) return;

    if (!flwPublicKey) {
      showToast('Payment system is not available right now. Please try again later.', 'error');
      return;
    }

    const emailInput = document.getElementById('order-email');
    const email = emailInput ? emailInput.value.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      if (emailInput) emailInput.focus();
      return;
    }

    const sizeField = document.getElementById('size-field');
    const size = (activeOrderProduct.hasSizes && sizeField && sizeField.style.display !== 'none')
      ? document.getElementById('order-size').value
      : null;

    const product = activeOrderProduct;
    const qty = activeOrderQty;
    const totalAmount = product.price * qty;
    const txRef = `cty-shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    closeOrderModal();

    FlutterwaveCheckout({
      public_key: flwPublicKey,
      tx_ref: txRef,
      amount: totalAmount,
      currency: 'USD',
      payment_options: 'card',
      customer: {
        email: email,
        name: currentUser ? (currentUser.displayName || 'Customer') : 'Customer'
      },
      customizations: {
        title: 'CTY Shop',
        description: `${qty}× ${product.name}${size ? ` (Size: ${size})` : ''}`
      },
      callback: async function (data) {
        if (data.status === 'successful') {
          await verifyOrder(data.transaction_id, product, email, qty, size);
        } else {
          showToast('Payment was not completed.', 'error');
        }
      },
      onclose: function () {}
    });
  }

  // ─── Verify order with backend ────────────────────────────────────────────────
  async function verifyOrder(txId, product, email, qty, size) {
    try {
      const res = await fetch(`${API_BASE}/api/shop/verify-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txId,
          product_id: product.id,
          product_name: product.name,
          amount: product.price * qty,
          currency: 'USD',
          email,
          quantity: qty,
          size: size || null,
          uid: currentUser ? currentUser.uid : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Order verification failed:', data);
        showToast('Payment received but confirmation failed. Please contact support.', 'warning');
        return;
      }

      showToast('Order placed! Check your email for confirmation.', 'success');
    } catch (err) {
      console.error('Verify order error:', err.message);
      showToast('Payment received but confirmation failed. Please contact support.', 'warning');
    }
  }

  // ─── Category filters ─────────────────────────────────────────────────────────
  function setupCategoryFilters() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const category = btn.dataset.category;
        document.querySelectorAll('.product-card').forEach(card => {
          card.style.display = (category === 'all' || card.dataset.category === category) ? '' : 'none';
        });
      });
    });
  }

  // ─── Mobile nav hamburger ─────────────────────────────────────────────────────
  function initMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  async function initShop() {
    loadPublicConfig(); // non-blocking
    initMobileNav();
    initOrderModal();

    try {
      if (window.firebaseReady) {
        await window.firebaseReady;
      } else {
        await new Promise((resolve) => {
          window.addEventListener('firebase-ready', resolve, { once: true });
        });
      }

      firebase.auth().onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          await loadUserData();
        }
        updateNavAuth(user);
        renderBalanceDisplay(user);
        renderProducts();
        renderVirtualPurchases();
      });
    } catch (err) {
      console.error('Shop init error:', err);
      // Render shop in guest mode even if Firebase fails
      updateNavAuth(null);
      renderBalanceDisplay(null);
      renderProducts();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShop);
  } else {
    initShop();
  }

})();
