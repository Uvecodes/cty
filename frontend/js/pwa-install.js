// PWA Install Handler - Fixed Installation Version

class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isInstalled = false;
    this.debugMode = true; // Set to false in production
    
    this.init();
  }
  
  init() {
    this.log('Initializing PWA Installer...');
    
    // Get the install button element
    this.installButton = document.getElementById('installBtn');
    
    if (!this.installButton) {
      this.log('ERROR: Install button not found in DOM', 'error');
      return;
    }
    
    this.log('Install button found');
    
    // Check if already installed FIRST
    if (this.checkIfInstalled()) {
      this.log('App is already installed, hiding button');
      this.hideInstallButton();
      return;
    }
    
    this.log('App not installed, setting up listeners');
    
    // Add click handler - use arrow function to preserve 'this' context
    this.installButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.install();
    });
    
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      this.log('🎉 beforeinstallprompt event fired!', 'success');
      e.preventDefault();
      this.deferredPrompt = e;
      
      // Show and enable the button
      if (!this.isInstalled) {
        this.showInstallButton();
        this.installButton.classList.remove('not-ready');
        this.log('Install button is now ready!', 'success');
      }
    });
    
    // Listen for successful installation
    window.addEventListener('appinstalled', (event) => {
      this.log('🎉 App installed successfully!', 'success');
      this.isInstalled = true;
      this.hideInstallButton();
      
      // Store installation flag
      try {
        localStorage.setItem('pwa-installed', 'true');
        localStorage.setItem('pwa-install-date', new Date().toISOString());
      } catch (e) {
        this.log('Could not save installation status: ' + e.message, 'warn');
      }
      
      // Show success message
      this.showToast('App installed successfully! 🎉', 'success');
    });
    
    // Debug: Run comprehensive check after delay
    setTimeout(() => {
      this.runDiagnostics();
    }, 3000);
  }
  
  log(message, type = 'info') {
    if (!this.debugMode && type !== 'error') return;
    
    const prefix = 'PWA Install:';
    switch(type) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      case 'success':
        console.log('%c' + prefix + ' ' + message, 'color: green; font-weight: bold');
        break;
      default:
        console.log(prefix, message);
    }
  }
  
  checkIfInstalled() {
    // Method 1: Check standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Method 2: Check iOS standalone
    const isIOSStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    
    // Method 3: Check localStorage flag
    let wasInstalled = false;
    try {
      wasInstalled = localStorage.getItem('pwa-installed') === 'true';
    } catch (e) {
      this.log('Could not check localStorage: ' + e.message, 'warn');
    }
    
    this.isInstalled = isStandalone || isIOSStandalone || wasInstalled;
    
    this.log('Installation check:', {
      isStandalone,
      isIOSStandalone,
      wasInstalled,
      result: this.isInstalled
    });
    
    return this.isInstalled;
  }
  
  showInstallButton() {
    if (this.installButton && !this.isInstalled) {
      this.installButton.style.display = 'inline-block';
      this.installButton.classList.add('show');
      this.log('Install button shown');
    }
  }
  
  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
      this.installButton.classList.remove('show');
      this.log('Install button hidden');
    }
  }
  
  async install() {
    this.log('🔘 Install button clicked');
    
    if (!this.deferredPrompt) {
      this.log('❌ No deferred prompt available', 'error');
      
      // Check if already installed
      if (this.checkIfInstalled()) {
        this.showToast('The app is already installed on your device!', 'info');
        this.hideInstallButton();
      } else {
        const reason = this.getDiagnosticMessage();
        this.showToast('Installation not available yet. Check console for details.', 'error');
        console.error('PWA Install: Installation unavailable -', reason);
      }
      return;
    }
    
    try {
      this.log('📱 Showing install prompt...');
      
      // Disable button during installation
      this.installButton.disabled = true;
      this.installButton.textContent = 'Installing...';
      
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      this.log('⏳ Waiting for user response...');
      
      // Wait for user response
      const choiceResult = await this.deferredPrompt.userChoice;
      
      this.log('User choice: ' + choiceResult.outcome);
      
      if (choiceResult.outcome === 'accepted') {
        this.log('✅ User accepted installation', 'success');
        this.isInstalled = true;
        
        // Store installation flag
        try {
          localStorage.setItem('pwa-installed', 'true');
          localStorage.setItem('pwa-install-date', new Date().toISOString());
        } catch (e) {
          this.log('Could not save installation status', 'warn');
        }
        
        this.showToast('Installing app...', 'success');
        
        // Hide button after short delay
        setTimeout(() => {
          this.hideInstallButton();
        }, 2000);
        
      } else {
        this.log('❌ User dismissed installation');
        this.showToast('Installation cancelled', 'info');
        
        // Re-enable button
        this.installButton.disabled = false;
        this.installButton.innerHTML = 'Install App<span class="tooltip">Install for a better personalized experience</span>';
      }
      
      // Clear the prompt
      this.deferredPrompt = null;
      
    } catch (error) {
      this.log('❌ Error during installation: ' + error.message, 'error');
      console.error('PWA Install: Full error:', error);
      
      this.showToast('Installation failed: ' + error.message, 'error');
      
      // Re-enable button
      this.installButton.disabled = false;
      this.installButton.innerHTML = 'Install App<span class="tooltip">Install for a better personalized experience</span>';
      
      this.deferredPrompt = null;
    }
  }
  
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Hide and remove toast
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  getDiagnosticMessage() {
    const issues = [];
    
    if (window.location.protocol !== 'https:' && 
        window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1') {
      issues.push('• Site must be served over HTTPS');
    }
    
    if (!('serviceWorker' in navigator)) {
      issues.push('• Service Workers not supported in this browser');
    }
    
    if (!document.querySelector('link[rel="manifest"]')) {
      issues.push('• Web manifest not found');
    }
    
    if (issues.length > 0) {
      return 'Issues detected:\n' + issues.join('\n');
    }
    
    return 'Browser may not support PWA installation, or you may need to interact with the site more first.';
  }
  
  async runDiagnostics() {
    this.log('========================================');
    this.log('Running PWA Diagnostics...');
    this.log('========================================');
    
    // 1. Browser support
    this.log('1. Browser Support:');
    this.log('   - Service Worker: ' + ('serviceWorker' in navigator ? '✓ Supported' : '✗ Not supported'), 
      'serviceWorker' in navigator ? 'success' : 'error');
    this.log('   - beforeinstallprompt: ' + ('onbeforeinstallprompt' in window ? '✓ Supported' : '? Unknown (may still work)'));
    
    // 2. Installation status
    this.log('2. Installation Status:');
    this.log('   - Standalone mode: ' + (window.matchMedia('(display-mode: standalone)').matches ? '✓ Yes' : '✗ No'));
    this.log('   - iOS Standalone: ' + (window.navigator.standalone ? '✓ Yes' : '✗ No'));
    this.log('   - Is Installed: ' + (this.isInstalled ? '✓ Yes' : '✗ No'));
    
    // 3. Manifest
    this.log('3. Web Manifest:');
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      this.log('   - Manifest link: ✓ Found (' + manifestLink.href + ')', 'success');
      
      try {
        const response = await fetch(manifestLink.href);
        const manifest = await response.json();
        this.log('   - Manifest loaded: ✓ Success', 'success');
        this.log('   - Name: ' + (manifest.name || 'Not set'));
        this.log('   - Start URL: ' + (manifest.start_url || 'Not set'));
        this.log('   - Scope: ' + (manifest.scope || 'Not set'));
        this.log('   - Display: ' + (manifest.display || 'Not set'));
        this.log('   - Icons: ' + (manifest.icons?.length || 0) + ' defined');
        
        // Check icons
        if (manifest.icons && manifest.icons.length > 0) {
          for (const icon of manifest.icons) {
            try {
              const iconResponse = await fetch(icon.src);
              this.log('   - Icon (' + icon.sizes + '): ' + 
                (iconResponse.ok ? '✓ Accessible' : '✗ Not found'), 
                iconResponse.ok ? 'success' : 'error');
            } catch (e) {
              this.log('   - Icon (' + icon.sizes + '): ✗ Error (' + e.message + ')', 'error');
            }
          }
        }
      } catch (e) {
        this.log('   - Manifest load: ✗ Failed (' + e.message + ')', 'error');
      }
    } else {
      this.log('   - Manifest link: ✗ Not found', 'error');
    }
    
    // 4. Service Worker
    this.log('4. Service Worker:');
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          this.log('   - Registration: ✓ Found', 'success');
          this.log('   - Scope: ' + registration.scope);
          this.log('   - State: ' + (registration.active?.state || 'Not active'));
          
          // Check if scopes match
          const manifestLink = document.querySelector('link[rel="manifest"]');
          if (manifestLink) {
            const manifestResponse = await fetch(manifestLink.href);
            const manifest = await manifestResponse.json();
            const manifestScope = new URL(manifest.scope || '/', window.location.origin).href;
            const swScope = registration.scope;
            
            if (manifestScope === swScope) {
              this.log('   - Scope match: ✓ Manifest and SW scopes match', 'success');
            } else {
              this.log('   - Scope match: ✗ MISMATCH!', 'error');
              this.log('     Manifest scope: ' + manifestScope, 'error');
              this.log('     SW scope: ' + swScope, 'error');
              this.log('     THIS PREVENTS INSTALLATION!', 'error');
            }
          }
        } else {
          this.log('   - Registration: ✗ Not found', 'error');
        }
      } catch (e) {
        this.log('   - Error checking registration: ' + e.message, 'error');
      }
    }
    
    // 5. Security context
    this.log('5. Security Context:');
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    this.log('   - Secure context: ' + (isSecure ? '✓ Yes (HTTPS/localhost)' : '✗ No (requires HTTPS)'), 
      isSecure ? 'success' : 'error');
    this.log('   - Protocol: ' + window.location.protocol);
    this.log('   - Hostname: ' + window.location.hostname);
    
    // 6. Install prompt status
    this.log('6. Install Prompt:');
    this.log('   - Deferred prompt: ' + (this.deferredPrompt ? '✓ Available' : '✗ Not available'));
    this.log('   - Button element: ' + (this.installButton ? '✓ Found' : '✗ Not found'));
    this.log('   - Button display: ' + (this.installButton ? getComputedStyle(this.installButton).display : 'N/A'));
    
    // 7. Summary
    this.log('========================================');
    if (this.deferredPrompt) {
      this.log('✅ PWA IS INSTALLABLE!', 'success');
    } else if (this.isInstalled) {
      this.log('✅ PWA IS ALREADY INSTALLED', 'success');
    } else {
      this.log('⚠️ PWA NOT INSTALLABLE YET', 'warn');
      this.log('Common reasons:', 'warn');
      this.log('  1. Service worker scope doesn\'t match manifest scope', 'warn');
      this.log('  2. Icons not accessible (404 errors)', 'warn');
      this.log('  3. Not served over HTTPS', 'warn');
      this.log('  4. Manifest has errors', 'warn');
      this.log('  5. Browser requires user engagement first', 'warn');
    }
    this.log('========================================');
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
    
    console.log('PWA Install: Registering service worker:', swPath);
    
    navigator.serviceWorker.register(swPath, { scope: '/frontend/' })
      .then(function(registration) {
        console.log('PWA Install: Service Worker registered successfully');
        console.log('PWA Install: Scope:', registration.scope);
        
        // Listen for updates
        registration.addEventListener('updatefound', function () {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('PWA Install: New version available');
            }
          });
        });
      })
      .catch(function (error) {
        console.error('PWA Install: Service Worker registration failed:', error);
      });
  });
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstaller();
});