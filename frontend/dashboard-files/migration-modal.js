// console.log() redec;laration to avoid errors in some environments
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};

        // Firebase configuration (replace with your actual config)
        // const firebaseConfig = {
        //     apiKey: "YOUR_API_KEY",
        //     authDomain: "YOUR_AUTH_DOMAIN",
        //     projectId: "YOUR_PROJECT_ID",
        //     storageBucket: "YOUR_STORAGE_BUCKET",
        //     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        //     appId: "YOUR_APP_ID"
        // };

        // Initialize Firebase
        // firebase.initializeApp(firebaseConfig);
        // const db = firebase.firestore();
        // const auth = firebase.auth();

        // Migration Modal JavaScript
        class MigrationModal {
            constructor(db) {
                this.db = db; // Store Firestore instance
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
                this.populateDays();
            }
            
            initializeEventListeners() {
                this.closeButton.addEventListener('click', () => this.close());
                this.skipButton.addEventListener('click', () => this.handleSkip());
                this.saveButton.addEventListener('click', () => this.handleSave());
                
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) {
                        this.close();
                    }
                });
                
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.isOpen()) {
                        this.close();
                    }
                });
                
                this.birthMonthSelect.addEventListener('change', () => this.validateForm());
                this.birthDaySelect.addEventListener('change', () => this.validateForm());
                
                if (this.testButton) {
                    this.testButton.addEventListener('click', () => this.openWithCallbacks());
                }
            }
            
            populateDays() {
                this.birthDaySelect.innerHTML = '<option value="">Select Day</option>';
                for (let i = 1; i <= 31; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = i;
                    this.birthDaySelect.appendChild(option);
                }
            }
            
            setupDemo() {
                this.currentAgeInput.value = '10';
            }
            
            async checkUserBirthDate(userId) {
                try {
                    const userDoc = await this.db.collection('users').doc(userId).get();
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        return !!(data.birthMonth && data.birthDay);
                    }
                    return false;
                } catch (error) {
                    console.error('Error checking birth date:', error);
                    return false;
                }
            }
            
            openWithCallbacks() {
                this.onSaveCallback = async (month, day) => {
                    try {
                        const user = auth.currentUser;
                        if (!user) {
                            console.error('No user logged in');
                            return;
                        }
                        await this.db.collection('users').doc(user.uid).set({
                            birthMonth: month,
                            birthDay: day,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log('Birth date saved to Firestore:', { month, day });
                    } catch (error) {
                        console.error('Error saving to Firestore:', error);
                    }
                };
                
                this.onSkipCallback = async () => {
                    try {
                        const user = auth.currentUser;
                        if (!user) {
                            console.error('No user logged in');
                            return;
                        }
                        await this.db.collection('users').doc(user.uid).set({
                            migrationSkipped: true,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log('Migration skipped recorded in Firestore');
                    } catch (error) {
                        console.error('Error recording skip in Firestore:', error);
                    }
                };
                
                this.open(this.onSaveCallback, this.onSkipCallback);
            }
            
            open(onSave = null, onSkip = null) {
                this.onSaveCallback = onSave;
                this.onSkipCallback = onSkip;
                
                this.modal.classList.add('show');
                document.body.style.overflow = 'hidden';
                
                this.birthMonthSelect.focus();
                this.validateForm();
                
                console.log('Migration modal opened');
            }
            
            close() {
                this.modal.classList.remove('show');
                document.body.style.overflow = '';
                this.resetForm();
                console.log('Migration modal closed');
            }
            
            isOpen() {
                return this.modal.classList.contains('show');
            }
            
            resetForm() {
                this.form.reset();
                this.currentAgeInput.value = '10';
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
                if (this.onSaveCallback && typeof this.onSaveCallback === 'function') {
                    this.onSaveCallback(formData.month, formData.day);
                }
                this.close();
            }
            
            handleSkip() {
                console.log('Migration skipped');
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
            
            static open(onSave, onSkip) {
                if (window.migrationModalInstance) {
                    window.migrationModalInstance.open(onSave, onSkip);
                } else {
                    console.error('Migration modal not initialized');
                }
            }
        }

        // Initialize modal and trigger after 2 seconds if needed
        document.addEventListener('DOMContentLoaded', () => {
            window.migrationModalInstance = new MigrationModal(db);
            
            if (typeof openMigrationModal === 'function') {
                const originalStub = openMigrationModal;
                window.openMigrationModal = (onSave, onSkip) => {
                    console.log('Opening real migration modal...');
                    MigrationModal.open(onSave, onSkip);
                };
                console.log('Migration modal stub replaced with real implementation');
            }
            
            window.addEventListener('load', async () => {
                try {
                    await auth.onAuthStateChanged(async (user) => {
                        if (user) {
                            const hasBirthDate = await window.migrationModalInstance.checkUserBirthDate(user.uid);
                            if (!hasBirthDate) {
                                setTimeout(() => {
                                    window.migrationModalInstance.openWithCallbacks();
                                }, 6000);
                            } else {
                                console.log('User already has birth date, skipping modal');
                            }
                        } else {
                            console.log('No user logged in, skipping modal');
                        }
                    });
                } catch (error) {
                    console.error('Error checking auth state:', error);
                }
            });
        });

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = MigrationModal;
        }
    