(function () {
  'use strict';

  // Auto-detect backend URL (mirrors firebase-config.js pattern)
  const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://cty-7cyi.onrender.com';

  // Flutterwave public key — fetched from backend
  let flwPublicKey = null;

  // Currently selected donation amounts
  const selectedAmounts = { monthly: 5, 'one-time': 5 };

  // Currency state
  let selectedCurrency = 'USD';
  let exchangeRates = { USD: 1 };

  const CURRENCY_CONFIG = {
    USD: { symbol: '$',   name: 'USD' },
    NGN: { symbol: '₦',  name: 'NGN' },
    GHS: { symbol: 'GH₵', name: 'GHS' },
    GBP: { symbol: '£',  name: 'GBP' },
  };

  function formatCurrencyAmount(amount, currency) {
    const sym = (CURRENCY_CONFIG[currency] || {}).symbol || (currency + ' ');
    return `${sym}${Math.round(amount).toLocaleString()}`;
  }

  // =============================================
  // Toast
  // =============================================
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

  // =============================================
  // Format numbers nicely (e.g. 1200 → "1,200")
  // =============================================
  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString();
  }

  // =============================================
  // Animate a number counting up
  // =============================================
  function animateCount(el, target) {
    const duration = 1200;
    const start = performance.now();
    const from = 0;

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(from + eased * (target - from));
      el.textContent = formatNumber(current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // =============================================
  // Fetch Flutterwave public key from backend
  // =============================================
  async function loadPublicConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/support/public-config`);
      if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
      const data = await res.json();
      flwPublicKey = data.flwPublicKey;
    } catch (err) {
      console.error('❌ Could not load payment config:', err.message);
      // Disable donate buttons gracefully
      ['monthly-btn', 'onetime-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Payments unavailable';
        }
      });
    }
  }

  // =============================================
  // Fetch and render live stats
  // =============================================
  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/support/stats`);
      if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
      const { childrenReached, versesDelivered, supporters } = await res.json();

      const childrenEl = document.getElementById('stat-children');
      const versesEl = document.getElementById('stat-verses');
      const supportersEl = document.getElementById('stat-supporters');

      if (childrenEl && childrenReached > 0) animateCount(childrenEl, childrenReached);
      else if (childrenEl) childrenEl.textContent = '—';

      if (versesEl && versesDelivered > 0) animateCount(versesEl, versesDelivered);
      else if (versesEl) versesEl.textContent = '—';

      if (supportersEl && supporters > 0) animateCount(supportersEl, supporters);
      else if (supportersEl) supportersEl.textContent = '—';

    } catch (err) {
      console.warn('⚠️ Stats unavailable:', err.message);
      // Leave stats as '—' — already set in HTML
    }
  }

  // =============================================
  // Fetch and render activity feed
  // =============================================
  async function loadActivity() {
    const list = document.getElementById('activity-list');
    if (!list) return;

    try {
      const res = await fetch(`${API_BASE}/api/support/activity`);
      if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
      const { activity } = await res.json();

      list.innerHTML = '';

      if (!activity || activity.length === 0) {
        list.innerHTML = '<li class="activity-item">Be the first to support!</li>';
        return;
      }

      activity.forEach(item => {
        const li = document.createElement('li');
        li.className = 'activity-item';
        const typeLabel = item.type === 'monthly' ? ' · <strong>monthly</strong>' : '';
        li.innerHTML = `<span class="activity-dot"></span> ${item.display}${typeLabel} · ${item.relativeTime}`;
        list.appendChild(li);
      });

    } catch (err) {
      console.warn('⚠️ Activity unavailable:', err.message);
      // Fall back to static placeholder list
      list.innerHTML = `
        <li class="activity-item"><span class="activity-dot"></span> Someone donated USD 5 · 2d</li>
        <li class="activity-item"><span class="activity-dot"></span> Someone donated USD 10 · 5d</li>
        <li class="activity-item"><span class="activity-dot"></span> A family started <strong>monthly support</strong> · 1w</li>
      `;
    }
  }

  // =============================================
  // Fetch and render credits
  // =============================================
  async function loadCredits() {
    const supportersList = document.getElementById('credits-supporters');
    const partnersList = document.getElementById('credits-partners');
    if (!supportersList || !partnersList) return;

    try {
      const res = await fetch(`${API_BASE}/api/support/credits`);
      if (!res.ok) throw new Error(`Credits fetch failed: ${res.status}`);
      const { supporters, partners } = await res.json();

      supportersList.innerHTML = supporters.length > 0
        ? supporters.map(name => `<li>${name}</li>`).join('')
        : '<li>Our growing community</li><li>You could be listed here</li>';

      partnersList.innerHTML = partners.length > 0
        ? partners.map(name => `<li>${name}</li>`).join('')
        : '<li>Contact us to partner</li>';

    } catch (err) {
      console.warn('⚠️ Credits unavailable:', err.message);
      supportersList.innerHTML = '<li>Our growing community</li><li>You could be listed here</li>';
      partnersList.innerHTML = '<li>Contact us to partner</li>';
    }
  }

  // =============================================
  // Exchange rates (open.er-api.com — free, no key)
  // =============================================
  async function loadExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);
      const data = await res.json();
      if (data.result !== 'success') throw new Error('Invalid rate response');

      exchangeRates = data.rates;
      exchangeRates.USD = 1;

      // Enable all currency buttons now that rates are loaded
      const picker = document.getElementById('currency-picker');
      if (picker) picker.querySelectorAll('.currency-btn').forEach(b => { b.disabled = false; });

      updateAmountButtons();
      updateRateDisplay();

    } catch (err) {
      console.warn('⚠️ Exchange rates unavailable:', err.message);
      const rateEl = document.getElementById('rate-display');
      if (rateEl) rateEl.textContent = '';
      // Non-USD buttons stay disabled — only USD available
    }
  }

  function updateAmountButtons() {
    const rate = exchangeRates[selectedCurrency] || 1;

    ['monthly', 'onetime'].forEach(prefix => {
      const type = prefix === 'monthly' ? 'monthly' : 'one-time';
      const container = document.getElementById(`${prefix}-amounts`);
      const customInput = document.getElementById(`${prefix}-custom`);
      if (!container) return;

      container.querySelectorAll('.amount-btn').forEach(btn => {
        const usdBase = parseFloat(btn.dataset.usd);
        const converted = Math.round(usdBase * rate);
        btn.dataset.amount = converted;
        btn.textContent = formatCurrencyAmount(converted, selectedCurrency);
        if (btn.classList.contains('active')) {
          selectedAmounts[type] = converted;
        }
      });

      if (customInput) {
        const sym = (CURRENCY_CONFIG[selectedCurrency] || {}).symbol || selectedCurrency + ' ';
        customInput.placeholder = `Custom amount (${sym})`;
        customInput.value = '';
      }
    });
  }

  function updateRateDisplay() {
    const el = document.getElementById('rate-display');
    if (!el) return;
    if (selectedCurrency === 'USD') { el.textContent = ''; return; }
    const rate = exchangeRates[selectedCurrency];
    if (rate) {
      const sym = (CURRENCY_CONFIG[selectedCurrency] || {}).symbol || selectedCurrency + ' ';
      el.textContent = `1 USD ≈ ${sym}${Math.round(rate).toLocaleString()}`;
    }
  }

  function initCurrencyPicker() {
    const picker = document.getElementById('currency-picker');
    if (!picker) return;
    picker.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCurrency = btn.dataset.currency;
        updateAmountButtons();
        updateRateDisplay();
      });
    });
  }

  // =============================================
  // Amount selector buttons
  // =============================================
  function initAmountSelectors() {
    ['monthly', 'onetime'].forEach(prefix => {
      const type = prefix === 'monthly' ? 'monthly' : 'one-time';
      const container = document.getElementById(`${prefix}-amounts`);
      const customInput = document.getElementById(`${prefix}-custom`);
      if (!container || !customInput) return;

      // Preset button clicks
      container.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedAmounts[type] = parseFloat(btn.dataset.amount);
          customInput.value = '';
        });
      });

      // Custom input overrides preset selection
      customInput.addEventListener('input', () => {
        const val = parseFloat(customInput.value);
        container.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
        if (val > 0) selectedAmounts[type] = val;
      });
    });
  }

  // =============================================
  // Verify payment with backend after FLW success
  // =============================================
  async function verifyPayment(txId, amount, currency, type, optedInName) {
    try {
      const res = await fetch(`${API_BASE}/api/support/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: txId,
          amount,
          currency,
          type,
          opted_in_name: optedInName || ''
        })
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('❌ Verification failed:', data);
        showToast('Payment received but could not be confirmed. Please contact support.', 'warning');
        return;
      }

      showToast('Thank you for your support! 🙏', 'success');
      // Refresh activity feed and stats to reflect new donation
      loadActivity();
      loadStats();

    } catch (err) {
      console.error('❌ Verify payment error:', err.message);
      showToast('Payment received but confirmation failed. Please contact support.', 'warning');
    }
  }

  // =============================================
  // Open Flutterwave checkout
  // =============================================
  function openDonation(type) {
    if (!flwPublicKey) {
      showToast('Payment system is not available right now. Please try again later.', 'error');
      return;
    }

    const prefix = type === 'monthly' ? 'monthly' : 'onetime';
    const emailInput = document.getElementById(`${prefix}-email`);
    const nameInput = document.getElementById(`${prefix}-name`);

    const email = emailInput ? emailInput.value.trim() : '';
    const optedInName = nameInput ? nameInput.value.trim() : '';
    const amount = selectedAmounts[type];

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      if (emailInput) emailInput.focus();
      return;
    }

    if (!amount || amount < 1) {
      showToast('Please select or enter a valid amount.', 'error');
      return;
    }

    const txRef = `cty-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    FlutterwaveCheckout({
      public_key: flwPublicKey,
      tx_ref: txRef,
      amount: amount,
      currency: selectedCurrency,
      payment_options: 'card',
      customer: {
        email: email,
        name: optedInName || 'Supporter',
      },
      customizations: {
        title: 'Support Catch Them Young',
        description: type === 'monthly' ? 'Monthly Support' : 'One-time Donation',
      },
      callback: function (data) {
        if (data.status === 'successful') {
          verifyPayment(data.transaction_id, amount, selectedCurrency, type, optedInName);
        } else {
          showToast('Payment was not completed.', 'error');
        }
      },
      onclose: function () {
        // No action — user closed the popup
      }
    });
  }

  // =============================================
  // Mobile nav hamburger toggle
  // =============================================
  function initMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('nav-links');
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', navLinks.classList.contains('open'));
    });

    // Close nav when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // =============================================
  // Init
  // =============================================
  function init() {
    loadPublicConfig();
    loadExchangeRates();
    loadStats();
    loadActivity();
    loadCredits();
    initAmountSelectors();
    initCurrencyPicker();
    initMobileNav();

    const monthlyBtn = document.getElementById('monthly-btn');
    const onetimeBtn = document.getElementById('onetime-btn');
    if (monthlyBtn) monthlyBtn.addEventListener('click', () => openDonation('monthly'));
    if (onetimeBtn) onetimeBtn.addEventListener('click', () => openDonation('one-time'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
