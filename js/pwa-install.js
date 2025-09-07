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
  
  // async install() {
  //   if (!this.deferredPrompt) return;
    
  //   // Show the install prompt
  //   this.deferredPrompt.prompt();
    
  //   // Wait for the user to respond to the prompt
  //   const { outcome } = await this.deferredPrompt.userChoice;
    
  //   if (outcome === 'accepted') {
  //     console.log('User accepted the install prompt');
  //   } else {
  //     console.log('User dismissed the install prompt');
  //   }
    
  //   // Clear the deferredPrompt
  //   this.deferredPrompt = null;
  // }
  
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