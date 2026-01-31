// Console redeclaration to avoid errors in some environments (optional; remove for debugging)

// PWA Installation Handler
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
    if (this.installButton) {
      this.installButton.addEventListener('click', () => this.install());
    }

    // Register service worker (path works from index and dashboard-files)
    if ('serviceWorker' in navigator) {
      const swPath = window.location.pathname.includes('/dashboard-files/') ? '../js/sw.js' : './js/sw.js';
      const onLoad = () => {
        navigator.serviceWorker.register(swPath).then((reg) => {
          if (reg.waiting) this.promptUpdate(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                this.promptUpdate(nw);
              }
            });
          });
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
        }).catch((e) => {
          console.warn('[SW]', e);
        });
      };
      if (document.readyState === 'complete') {
        onLoad();
      } else {
        window.addEventListener('load', onLoad);
      }
    }

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      // Show the install button
      this.showInstallButton();
    });
    
    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallButton();
      console.log('PWA was installed successfully');
    });
    
    // Check if already installed
    this.checkIfInstalled();
  }
  
  showInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'inline-block';
    }
  }
  
  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  promptUpdate(worker) {
    if (confirm('A new version is ready. Update now?')) {
      worker.postMessage('SKIP_WAITING');
    }
  }
  
  async install() {
    if (!this.deferredPrompt) {
      alert('Install is not available right now.');
      this.hideInstallButton();
      return;
    }
    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.hideInstallButton();
    } catch (error) {
      this.deferredPrompt = null;
      this.hideInstallButton();
    }
  }
  
  checkIfInstalled() {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      this.hideInstallButton();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PWAInstaller();
});