// Avatar upload logic for profile page
let selectedFile = null;
let cropperInstance = null;
let croppedBlob = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeAvatarUpload();
    loadExistingAvatar();
    initializeDeleteButton();
    initializeAvatarPreview();
});

// Initialize avatar upload functionality
function initializeAvatarUpload() {
    console.log('Initializing avatar upload...');
    const changePhotoBtn = document.getElementById('avatarInput');
    
    if (!changePhotoBtn) {
        console.error('Change Photo button not found!');
        return;
    }
    
    console.log('Change Photo button found:', changePhotoBtn);
    
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
    fileInput.style.display = 'none';
    fileInput.id = 'avatarFileInput';
    document.body.appendChild(fileInput);
    
    console.log('File input created and appended to body');
    
    // When "Change Photo" button is clicked, trigger file input
    changePhotoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Change Photo button clicked!');
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', handleAvatarSelect);
    
    console.log('Avatar upload initialized successfully');
}

// Initialize delete button
function initializeDeleteButton() {
    const deleteBtn = document.getElementById('deleteAvatarBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteAvatar);
    }
}

// Initialize avatar preview functionality
function initializeAvatarPreview() {
    // Main profile avatar
    const mainAvatar = document.getElementById('mainProfileAvatar');
    if (mainAvatar) {
        mainAvatar.addEventListener('click', function() {
            if (mainAvatar.src && !mainAvatar.src.includes('avatar-placeholder')) {
                showAvatarPreview(mainAvatar.src);
            }
        });
    }
    
    // Navbar avatar
    const navbarAvatar = document.getElementById('profileAvatar');
    if (navbarAvatar) {
        navbarAvatar.addEventListener('click', function() {
            if (navbarAvatar.src && !navbarAvatar.src.includes('official-logo')) {
                showAvatarPreview(navbarAvatar.src);
            }
        });
    }
}

// Show avatar in preview mode
function showAvatarPreview(avatarUrl) {
    console.log('Opening avatar preview...');
    
    // Create preview modal
    const modal = document.createElement('div');
    modal.className = 'avatar-preview-modal';
    modal.innerHTML = `
        <button class="preview-close-btn" onclick="closeAvatarPreview()">&times;</button>
        <img src="${avatarUrl}" alt="Avatar Preview">
    `;
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeAvatarPreview();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', handlePreviewEscape);
    
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// Close avatar preview
function closeAvatarPreview() {
    const modal = document.querySelector('.avatar-preview-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    
    // Remove escape key listener
    document.removeEventListener('keydown', handlePreviewEscape);
}

// Handle escape key for preview
function handlePreviewEscape(e) {
    if (e.key === 'Escape') {
        closeAvatarPreview();
    }
}

// Handle avatar file selection
function handleAvatarSelect(event) {
    console.log('File selected event triggered');
    const files = event.target.files;
    console.log('Number of files:', files.length);
    
    if (files.length > 0) {
        console.log('File selected:', files[0].name, files[0].type, files[0].size);
        handleAvatarFiles(files);
    }
}

// Handle avatar files
function handleAvatarFiles(files) {
    console.log('Handling avatar files...');
    const file = files[0];
    
    // Validate image file
    const validation = validateAvatarFile(file);
    console.log('Validation result:', validation);
    
    if (!validation.isValid) {
        console.error('Validation failed:', validation.message);
        showNotification(validation.message, 'error');
        return;
    }
    
    // Store selected file
    selectedFile = file;
    console.log('File stored, showing upload modal...');
    
    // Show preview and upload modal
    showUploadModal(file);
}

// Validate avatar file
function validateAvatarFile(file) {
    // Check if file is an image
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!allowedTypes.includes(file.type)) {
        return {
            isValid: false,
            message: 'Please select a valid image file (JPEG, PNG, GIF, or WebP)'
        };
    }
    
    // Check file size (max 2MB for avatar)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            isValid: false,
            message: 'Image size must be less than 2MB'
        };
    }
    
    return {
        isValid: true,
        message: 'Valid image file'
    };
}

// Show crop modal
function showUploadModal(file) {
    console.log('Creating crop modal...');
    
    // Check if Cropper is available
    if (typeof Cropper === 'undefined') {
        console.error('Cropper.js is not loaded!');
        showNotification('Image cropper library not loaded. Please refresh the page.', 'error');
        return;
    }
    
    // Create crop modal
    const modal = document.createElement('div');
    modal.className = 'avatar-crop-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Crop & Upload Avatar</h3>
                <button class="modal-close" onclick="closeCropModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="cropper-container-wrapper">
                    <img id="avatarPreviewImg" src="" alt="Avatar Preview" class="avatar-preview-crop">
                </div>
                <div class="crop-controls">
                    <button class="crop-btn" onclick="rotateCropperLeft()" title="Rotate Left">↶</button>
                    <button class="crop-btn" onclick="rotateCropperRight()" title="Rotate Right">↷</button>
                    <button class="crop-btn" onclick="flipCropperHorizontal()" title="Flip Horizontal">⇄</button>
                    <button class="crop-btn" onclick="flipCropperVertical()" title="Flip Vertical">⇅</button>
                    <button class="crop-btn" onclick="resetCropper()" title="Reset">↺</button>
                </div>
                <p class="file-info-text">
                    <span class="file-name">${file.name}</span> • 
                <span class="file-size">${formatFileSize(file.size)}</span>
                </p>
                <div class="upload-progress-container" style="display: none;">
                    <div id="uploadProgressBar" class="upload-progress-bar">
                        <span id="uploadProgressText">0%</span>
                    </div>
                </div>
                <p id="uploadStatusText" class="upload-status-text"></p>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeCropModal()">Cancel</button>
                <button id="uploadAvatarBtn" class="btn-upload" onclick="uploadCroppedAvatar()">Upload</button>
            </div>
            </div>
        `;
    
    document.body.appendChild(modal);
    console.log('Modal appended to body');
    
    // Preview the image and initialize cropper
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('Image loaded into FileReader');
        const previewImg = document.getElementById('avatarPreviewImg');
        
        if (previewImg) {
            previewImg.src = e.target.result;
            console.log('Image src set, initializing Cropper...');
            
            // Wait for image to load before initializing cropper
            previewImg.onload = function() {
                try {
                    // Initialize Cropper.js
                    cropperInstance = new Cropper(previewImg, {
                        aspectRatio: 1, // Square crop for avatar
                        viewMode: 2,
                        dragMode: 'move',
                        autoCropArea: 0.8,
                        restore: false,
                        guides: true,
                        center: true,
                        highlight: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                    });
                    console.log('Cropper initialized successfully');
                } catch (error) {
                    console.error('Error initializing Cropper:', error);
                    showNotification('Error initializing image cropper: ' + error.message, 'error');
                }
            };
        } else {
            console.error('Preview image element not found!');
        }
    };
    
    reader.onerror = function(error) {
        console.error('Error reading file:', error);
        showNotification('Error reading image file', 'error');
    };
    
    reader.readAsDataURL(file);
    
    // Show modal
    setTimeout(() => {
        modal.classList.add('show');
        console.log('Modal shown');
    }, 10);
}

// Upload cropped avatar directly
async function uploadCroppedAvatar() {
    console.log('Starting upload...');
    
    if (!cropperInstance) {
        showNotification('No cropper instance found', 'error');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadAvatarBtn');
    const progressContainer = document.querySelector('.upload-progress-container');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    const statusText = document.getElementById('uploadStatusText');
    const cropControls = document.querySelector('.crop-controls');
    
    // Set loading state
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
    }
    
    // Hide crop controls during upload
    if (cropControls) {
        cropControls.style.display = 'none';
    }
    
    // Show progress container
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    
    if (statusText) {
        statusText.textContent = 'Processing image...';
        statusText.className = 'upload-status-text uploading';
    }
    
    try {
        // Check authentication
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User not authenticated. Please log in.');
        }
        
        console.log('User authenticated:', user.uid);
        
        // Get cropped canvas
        const canvas = cropperInstance.getCroppedCanvas({
            width: 400,
            height: 400,
            imageSmoothingQuality: 'high'
        });
        
        console.log('Canvas created');
        
        // Convert canvas to blob
        croppedBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });
        
        console.log('Blob created, starting upload...');
        
        if (statusText) {
            statusText.textContent = 'Uploading avatar...';
        }
        
        // Create storage reference
        const timestamp = Date.now();
        const fileName = `avatars/${user.uid}/avatar_${timestamp}.jpg`;
        
        const storageRef = firebase.storage().ref();
        const fileRef = storageRef.child(fileName);
        
        // Upload cropped blob with progress tracking
        const uploadTask = fileRef.put(croppedBlob);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress:', progress + '%');
                if (progressBar) {
                    progressBar.style.width = progress + '%';
                }
                if (progressText) {
                    progressText.textContent = Math.round(progress) + '%';
                }
            },
            (error) => {
                console.error('Upload error:', error);
                throw error;
            },
            async () => {
                console.log('Upload complete, getting download URL...');
                
                // Get download URL
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                console.log('Download URL:', downloadURL);
                
                // Save avatar URL to Firestore
                await firebase.firestore().collection('users').doc(user.uid).update({
                    avatarUrl: downloadURL,
                    avatarUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('Avatar URL saved to Firestore');
                
                // Update UI
                if (statusText) {
                    statusText.textContent = 'Avatar uploaded successfully!';
                    statusText.className = 'upload-status-text success';
                }
                
                showNotification('Avatar uploaded successfully!', 'success');
                
                // Update avatar display in profile
                updateAvatarDisplay(downloadURL);
                
                // Close modal after a short delay
                setTimeout(() => {
                    closeCropModal();
                }, 1500);
            }
        );
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        
        if (statusText) {
            statusText.textContent = 'Upload failed. Please try again.';
            statusText.className = 'upload-status-text error';
        }
        
        showNotification('Failed to upload avatar: ' + error.message, 'error');
        
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Retry Upload';
        }
        
        if (cropControls) {
            cropControls.style.display = 'flex';
        }
    }
}

// Close crop modal
function closeCropModal() {
    const modal = document.querySelector('.avatar-crop-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
    
    // Destroy cropper instance
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    
    selectedFile = null;
    croppedBlob = null;
}

// Cropper control functions
function rotateCropperLeft() {
    if (cropperInstance) {
        cropperInstance.rotate(-90);
    }
}

function rotateCropperRight() {
    if (cropperInstance) {
        cropperInstance.rotate(90);
    }
}

function flipCropperHorizontal() {
    if (cropperInstance) {
        const scaleX = cropperInstance.getData().scaleX || 1;
        cropperInstance.scaleX(-scaleX);
    }
}

function flipCropperVertical() {
    if (cropperInstance) {
        const scaleY = cropperInstance.getData().scaleY || 1;
        cropperInstance.scaleY(-scaleY);
    }
}

function resetCropper() {
    if (cropperInstance) {
        cropperInstance.reset();
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update avatar display
function updateAvatarDisplay(avatarUrl) {
    // Update main profile avatar
    const avatarImg = document.querySelector('.profile-avatar');
    const avatarContainer = document.querySelector('.avatar-container');
    const deleteBtn = document.getElementById('deleteAvatarBtn');
    
    if (avatarImg) {
        avatarImg.src = avatarUrl;
    }
    
    // Add visual indicator that avatar is clickable
    if (avatarContainer) {
        avatarContainer.classList.add('has-avatar');
    }
    
    // Show delete button
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
    
    // Update navbar avatar
    const navbarAvatar = document.getElementById('profileAvatar');
    if (navbarAvatar) {
        navbarAvatar.src = avatarUrl;
        navbarAvatar.style.width = '50px';
        navbarAvatar.style.height = '50px';
        navbarAvatar.style.borderRadius = '50%';
        navbarAvatar.style.objectFit = 'cover';
        navbarAvatar.style.border = '2px solid var(--color-green)';
        navbarAvatar.style.cursor = 'pointer';
        navbarAvatar.title = 'Click to view';
    }
}

// Load existing avatar
async function loadExistingAvatar() {
    console.log('Loading existing avatar...');
    
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined') {
            console.error('Firebase is not loaded!');
            return;
        }
        
        console.log('Firebase is available');
        
        // Wait for Firebase Auth to initialize
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                console.log('No user logged in');
                return;
            }
            
            console.log('User logged in:', user.uid);
            
            try {
                const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                
                console.log('User data:', userData);
                
                if (userData && userData.avatarUrl) {
                    console.log('Avatar URL found:', userData.avatarUrl);
                    updateAvatarDisplay(userData.avatarUrl);
                } else {
                    console.log('No avatar URL found for user');
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        });
        
    } catch (error) {
        console.error('Error loading avatar:', error);
    }
}

// Delete avatar (can be called from HTML)
async function deleteAvatar() {
    if (!confirm('Are you sure you want to delete your avatar?')) {
        return;
    }
    
    try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('User not authenticated');
        
        // Remove avatar URL from Firestore
        await firebase.firestore().collection('users').doc(user.uid).update({
            avatarUrl: firebase.firestore.FieldValue.delete()
        });
        
        showNotification('Avatar deleted successfully', 'success');
        
        // Reset main profile avatar to default
        const avatarImg = document.querySelector('.profile-avatar');
        const avatarContainer = document.querySelector('.avatar-container');
        const deleteBtn = document.getElementById('deleteAvatarBtn');
        
        if (avatarImg) {
            avatarImg.src = 'assets/images/avatar-placeholder.png';
        }
        
        // Remove clickable indicator
        if (avatarContainer) {
            avatarContainer.classList.remove('has-avatar');
        }
        
        // Hide delete button
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // Reset navbar avatar to logo
        const navbarAvatar = document.getElementById('profileAvatar');
        if (navbarAvatar) {
            navbarAvatar.src = '../assets/images/official-logo.svg';
            navbarAvatar.style.width = 'auto';
            navbarAvatar.style.height = 'auto';
            navbarAvatar.style.borderRadius = '0';
            navbarAvatar.style.objectFit = 'initial';
            navbarAvatar.style.border = 'none';
            navbarAvatar.style.cursor = 'default';
            navbarAvatar.title = '';
        }
        
    } catch (error) {
        console.error('Error deleting avatar:', error);
        showNotification('Failed to delete avatar', 'error');
    }
}

// Show notification helper
function showNotification(message, type = 'info') {
    if (typeof utils !== 'undefined' && utils.showNotification) {
        utils.showNotification(message, type);
    } else {
        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Export functions to global scope
window.closeCropModal = closeCropModal;
window.uploadCroppedAvatar = uploadCroppedAvatar;
window.deleteAvatar = deleteAvatar;
window.rotateCropperLeft = rotateCropperLeft;
window.rotateCropperRight = rotateCropperRight;
window.flipCropperHorizontal = flipCropperHorizontal;
window.flipCropperVertical = flipCropperVertical;
window.resetCropper = resetCropper;
window.showAvatarPreview = showAvatarPreview;
window.closeAvatarPreview = closeAvatarPreview; 