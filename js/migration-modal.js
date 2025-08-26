// Migration Modal JavaScript

class MigrationModal {
    constructor() {
        this.modal = document.getElementById('migrationModal');
        this.form = document.getElementById('migrationForm');
        this.birthMonthSelect = document.getElementById('birthMonth');
        this.birthDaySelect = document.getElementById('birthDay');
        this.currentAgeInput = document.getElementById('currentAge');
        this.saveButton = document.getElementById('saveButton');
        this.skipButton = document.getElementById('skipButton');
        this.closeButton = document.getElementById('closeButton');
        this.testButton = document.getElementById('testModalButton');
        
        this.onSaveCallback = null;
        this.onSkipCallback = null;
        
        this.initializeEventListeners();
        this.setupDemo();
    }
    
    initializeEventListeners() {
        // Close modal events
        this.closeButton.addEventListener('click', () => this.close());
        this.skipButton.addEventListener('click', () => this.handleSkip());
        this.saveButton.addEventListener('click', () => this.handleSave());
        
        // Close on overlay click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
        
        // Form validation
        this.birthMonthSelect.addEventListener('change', () => this.validateForm());
        this.birthDaySelect.addEventListener('change', () => this.validateForm());
        
        // Demo button
        if (this.testButton) {
            this.testButton.addEventListener('click', () => this.open());
        }
    }
    
    setupDemo() {
        // Set a demo age for testing
        this.currentAgeInput.value = '10';
    }
    
    open(onSave = null, onSkip = null) {
        this.onSaveCallback = onSave;
        this.onSkipCallback = onSkip;
        
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus first form element
        this.birthMonthSelect.focus();
        
        // Validate form initially
        this.validateForm();
        
        console.log('Migration modal opened');
    }
    
    close() {
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Reset form
        this.resetForm();
        
        console.log('Migration modal closed');
    }
    
    isOpen() {
        return this.modal.classList.contains('show');
    }
    
    resetForm() {
        this.form.reset();
        this.currentAgeInput.value = '10'; // Reset to demo age
        this.saveButton.disabled = true;
    }
    
    validateForm() {
        const month = this.birthMonthSelect.value;
        const day = this.birthDaySelect.value;
        
        const isValid = month && day;
        this.saveButton.disabled = !isValid;
        
        return isValid;
    }
    
    getFormData() {
        const month = parseInt(this.birthMonthSelect.value);
        const day = parseInt(this.birthDaySelect.value);
        
        if (!this.validateForm()) {
            return null;
        }
        
        return { month, day };
    }
    
    handleSave() {
        const formData = this.getFormData();
        
        if (!formData) {
            console.warn('Form validation failed');
            return;
        }
        
        console.log('Saving migration data:', formData);
        
        // Call the onSave callback if provided
        if (this.onSaveCallback && typeof this.onSaveCallback === 'function') {
            this.onSaveCallback(formData.month, formData.day);
        }
        
        this.close();
    }
    
    handleSkip() {
        console.log('Migration skipped');
        
        // Call the onSkip callback if provided
        if (this.onSkipCallback && typeof this.onSkipCallback === 'function') {
            this.onSkipCallback();
        }
        
        this.close();
    }
    
    setCurrentAge(age) {
        if (age >= 4 && age <= 17) {
            this.currentAgeInput.value = age;
        } else {
            console.warn('Invalid age for migration modal:', age);
        }
    }
    
    // Static method to open modal (for compatibility with existing code)
    static open(onSave, onSkip) {
        if (window.migrationModalInstance) {
            window.migrationModalInstance.open(onSave, onSkip);
        } else {
            console.error('Migration modal not initialized');
        }
    }
}

// Initialize modal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.migrationModalInstance = new MigrationModal();
    
    // Replace the stub function with the real modal
    if (typeof openMigrationModal === 'function') {
        // Store the original stub function
        const originalStub = openMigrationModal;
        
        // Replace with real modal function
        window.openMigrationModal = (onSave, onSkip) => {
            console.log('Opening real migration modal...');
            MigrationModal.open(onSave, onSkip);
        };
        
        console.log('Migration modal stub replaced with real implementation');
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MigrationModal;
}



