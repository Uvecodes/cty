// PWA Install Handler - Enhanced Version
// Handles install button visibility based on installation status

class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isInstalled = false;
    
    this.init();
  }
  
  init() {
    // Get the install button element
    this.installButton = document.getElementById('installBtn');
    
    if (!this.installButton) {
      console.warn('PWA Install: Install button not found in DOM');
      return;
    }
    
    console.log('PWA Install: Button found, initializing...');
    
    // Check if already installed FIRST (before setting up listeners)
    if (this.checkIfInstalled()) {
      console.log('PWA Install: App is already installed, hiding button');
      this.hideInstallButton();
      return; // Exit early if already installed
    }
    
    // Add click handler
    this.installButton.addEventListener('click', () => {
      this.install();
    });
    
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA Install: beforeinstallprompt event fired!');
      e.preventDefault();
      this.deferredPrompt = e;
      
      // Only show button if not already installed
      if (!this.isInstalled) {
        this.showInstallButton();
      }
    });
    
    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA Install: App installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      
      // Store installation flag in localStorage for persistence
      try {
        localStorage.setItem('pwa-installed', 'true');
      } catch (e) {
        console.warn('PWA Install: Could not save installation status', e);
      }
    });
    
    // Debug PWA criteria after a delay
    setTimeout(() => {
      this.debugPWACriteria();
    }, 2000);
  }
  
  checkIfInstalled() {
    // Method 1: Check if running in standalone mode (most reliable)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Method 2: Check iOS standalone mode
    const isIOSStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    
    // Method 3: Check if previously installed (stored flag)
    let wasInstalled = false;
    try {
      wasInstalled = localStorage.getItem('pwa-installed') === 'true';
    } catch (e) {
      console.warn('PWA Install: Could not check localStorage', e);
    }
    
    // Method 4: Check display mode from URL params (some browsers add this)
    const urlParams = new URLSearchParams(window.location.search);
    const displayMode = urlParams.get('display-mode');
    
    this.isInstalled = isStandalone || isIOSStandalone || wasInstalled || displayMode === 'standalone';
    
    console.log('PWA Install: Installation check results:', {
      isStandalone,
      isIOSStandalone,
      wasInstalled,
      displayMode,
      finalResult: this.isInstalled
    });
    
    return this.isInstalled;
  }
  
  showInstallButton() {
    if (this.installButton && !this.isInstalled) {
      this.installButton.style.display = 'inline-block';
      this.installButton.classList.add('show');
      console.log('PWA Install: Install button displayed');
    }
  }
  
  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
      this.installButton.classList.remove('show');
      console.log('PWA Install: Install button hidden');
    }
  }
  
  async install() {
    console.log('PWA Install: install() called');
    
    if (!this.deferredPrompt) {
      console.warn('PWA Install: No deferred prompt available');
      
      // Check if already installed
      if (this.checkIfInstalled()) {
        alert('The app is already installed on your device!');
      } else {
        alert('PWA installation is not available at this time. Make sure you\'re using a supported browser (Chrome, Edge, Safari) and accessing the site over HTTPS.');
      }
      return;
    }
    
    try {
      console.log('PWA Install: Showing install prompt...');
      
      // Show the install prompt
      await this.deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('PWA Install: User choice:', outcome);
      
      if (outcome === 'accepted') {
        console.log('PWA Install: User accepted the install prompt');
        this.isInstalled = true;
        
        // Store installation flag
        try {
          localStorage.setItem('pwa-installed', 'true');
        } catch (e) {
          console.warn('PWA Install: Could not save installation status', e);
        }
      } else {
        console.log('PWA Install: User dismissed the install prompt');
      }
      
      // Clear the prompt and hide button
      this.deferredPrompt = null;
      this.hideInstallButton();
      
    } catch (error) {
      console.error('PWA Install: Error during install', error);
      alert('Installation failed: ' + (error.message || 'Unknown error'));
      this.deferredPrompt = null;
    }
  }
  
  debugPWACriteria() {
    console.log('PWA Install: Debugging PWA criteria...');
    console.log('  - Service Worker:', 'serviceWorker' in navigator ? 'Supported' : 'Not supported');
    console.log('  - Standalone mode:', window.matchMedia('(display-mode: standalone)').matches ? 'Yes (installed)' : 'No');
    console.log('  - iOS Standalone:', ('standalone' in window.navigator) && window.navigator.standalone ? 'Yes' : 'No');
    console.log('  - Manifest link:', document.querySelector('link[rel="manifest"]')?.href || 'Not found');
    console.log('  - Button display:', this.installButton ? window.getComputedStyle(this.installButton).display : 'N/A');
    console.log('  - Deferred prompt:', this.deferredPrompt ? 'Available' : 'Not available');
    console.log('  - Installation status:', this.isInstalled ? 'INSTALLED' : 'NOT INSTALLED');
    
    // Check service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        console.log('  - Service Worker registered:', reg ? 'Yes' : 'No');
        if (reg) {
          console.log('  - Service Worker state:', reg.active?.state || 'Not active');
          console.log('  - Service Worker scope:', reg.scope);
        }
      });
    }
    
    // Verify HTTPS or localhost
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    console.log('  - Secure context:', isSecure ? 'Yes' : 'No');
  }
}

// Service Worker Registration
(function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('PWA Install: Service Workers not supported');
    return;
  }

  window.addEventListener('load', function () {
    const swPath = window.location.pathname.includes('/dashboard-files/') || 
                   window.location.pathname.includes('/authentication/') 
                   ? '../sw.js' 
                   : './sw.js';
    
    navigator.serviceWorker.register(swPath, { scope: '/frontend/' })
      .then(function(reg) {
        console.log('PWA Install: Service Worker registered', reg);
        console.log('PWA Install: Service Worker scope:', reg.scope);
        
        // Listen for updates
        reg.addEventListener('updatefound', function () {
          const newWorker = reg.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('PWA Install: New version available');
              // Optionally notify user about update
            }
          });
        });
      })
      .catch(function (error) {
        console.error('PWA Install: Service Worker registration failed', error);
      });
  });
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstaller();
});