// Dark Mode Manager
const DarkMode = {
  // Initialize dark mode
  init() {
    this.applySavedTheme();
    this.setupThemeRadioButtons();
    this.setupToggleButton();
    this.detectSystemPreference();
  },

  // Set theme (called by radio buttons or toggle)
  setTheme(isDarkMode) {
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
    this.updateRadioButtons(isDarkMode);
    this.updateToggleButton(isDarkMode);
    console.log('Theme set to:', isDarkMode ? 'dark' : 'light');
  },

  // Toggle dark/light mode (for toggle button)
  toggle() {
    const isDarkMode = !document.body.classList.contains('dark-mode');
    this.setTheme(isDarkMode);
  },

  // Apply saved theme on page load
  applySavedTheme() {
    const savedTheme = localStorage.getItem('darkMode');
    
    if (savedTheme !== null) {
      const isDarkMode = savedTheme === 'true';
      document.body.classList.toggle('dark-mode', isDarkMode);
      this.updateRadioButtons(isDarkMode);
      this.updateToggleButton(isDarkMode);
      console.log('Applied saved theme:', isDarkMode ? 'dark' : 'light');
    } else {
      console.log('No saved theme found, using system preference or default');
    }
  },

  // Setup theme radio buttons (for profile page)
  setupThemeRadioButtons() {
    const lightRadio = document.getElementById('lightModeRadio');
    const darkRadio = document.getElementById('darkModeRadio');
    
    if (lightRadio && darkRadio) {
      lightRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.setTheme(false);
        }
      });
      
      darkRadio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.setTheme(true);
        }
      });
      
      console.log('Theme radio buttons initialized');
    }
  },

  // Update radio buttons to match current theme
  updateRadioButtons(isDarkMode) {
    const lightRadio = document.getElementById('lightModeRadio');
    const darkRadio = document.getElementById('darkModeRadio');
    
    if (lightRadio && darkRadio) {
      lightRadio.checked = !isDarkMode;
      darkRadio.checked = isDarkMode;
    }
  },

  // Setup toggle button click handler (for other pages)
  setupToggleButton() {
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn && !toggleBtn.closest('.theme-option')) {
      // Only set up if it's not part of the radio button labels
      toggleBtn.addEventListener('click', () => this.toggle());
      console.log('Theme toggle button initialized');
    }
  },

  // Update toggle button appearance
  updateToggleButton(isDarkMode) {
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn && !toggleBtn.closest('.theme-option')) {
      // Only update if it's not part of the radio button labels
      // Update icon
      toggleBtn.textContent = isDarkMode ? '☀️' : '🌙';
      
      // Update aria-label for accessibility
      toggleBtn.setAttribute('aria-label', isDarkMode ? 'Switch to light mode' : 'Switch to dark mode');
      
      // Update title tooltip
      toggleBtn.title = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
    }
  },

  // Detect system preference (only if no saved preference)
  detectSystemPreference() {
    if (localStorage.getItem('darkMode') === null) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Apply initial system preference
      document.body.classList.toggle('dark-mode', mediaQuery.matches);
      this.updateRadioButtons(mediaQuery.matches);
      this.updateToggleButton(mediaQuery.matches);
      console.log('Using system preference:', mediaQuery.matches ? 'dark' : 'light');

      // Listen for system preference changes
      mediaQuery.addEventListener('change', (e) => {
        // Only auto-update if user hasn't set a preference
        if (localStorage.getItem('darkMode') === null) {
          document.body.classList.toggle('dark-mode', e.matches);
          this.updateRadioButtons(e.matches);
          this.updateToggleButton(e.matches);
          console.log('System preference changed to:', e.matches ? 'dark' : 'light');
        }
      });
    }
  }
};

// Initialize dark mode when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DarkMode.init());
} else {
  DarkMode.init();
}

// Export for global access (optional)
window.DarkMode = DarkMode;