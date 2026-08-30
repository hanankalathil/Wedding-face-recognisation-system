import { fetchAPI, compressImage, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const cameraBtn = document.getElementById('cameraBtn');
    
    const cameraModal = document.getElementById('cameraModal');
    const cameraContainer = document.getElementById('cameraContainer');
    const cameraFeed = document.getElementById('cameraFeed');
    const captureBtn = document.getElementById('captureBtn');
    const cancelCameraBtn = document.getElementById('cancelCameraBtn');
    
    const previewSection = document.getElementById('previewSection');
    const previewImg = document.getElementById('previewImg');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const retryBtn = document.getElementById('retryBtn');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    const resultsSection = document.getElementById('resultsSection');
    const resultsGrid = document.getElementById('resultsGrid');
    const emptyState = document.getElementById('emptyState');
    
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    const closeModal = document.querySelector('.close-modal');

    let stream = null;
    let selectedFile = null;
    let currentMatches = [];

    // Drag and Drop Handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    uploadArea.addEventListener('click', (e) => {
        if(e.target !== cameraBtn && !cameraBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });

    let detectionInterval = null;
    let isDetecting = false;

    // Camera Handlers
    cameraBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering file input click
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            cameraFeed.srcObject = stream;
            cameraModal.classList.add('active');
            document.body.classList.add('modal-open');
            startRealtimeFaceDetection();
        } catch (err) {
            console.error('Error accessing camera:', err);
            showToast('Could not access camera. Please check permissions.', 'error');
        }
    });

    captureBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            stopCamera();
            handleFile(file);
        }, 'image/jpeg', 0.9);
    });

    cancelCameraBtn.addEventListener('click', () => {
        stopCamera();
    });

    function stopCamera() {
        stopRealtimeFaceDetection();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function startRealtimeFaceDetection() {
        const cameraCutoutRing = document.getElementById('cameraCutoutRing');
        const cameraStatusMsg = document.getElementById('cameraStatusMsg');
        
        // Reset classes
        if (cameraCutoutRing) {
            cameraCutoutRing.className = 'camera-cutout-ring';
        }
        if (cameraStatusMsg) {
            cameraStatusMsg.className = 'camera-status-msg';
            cameraStatusMsg.innerText = 'Align your face inside the circle';
        }
        
        // Check face every 800ms
        detectionInterval = setInterval(async () => {
            if (isDetecting || !stream) return;
            
            const videoW = cameraFeed.videoWidth;
            const videoH = cameraFeed.videoHeight;
            if (videoW === 0 || videoH === 0) return;
            
            isDetecting = true;
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 200;
            tempCanvas.height = 200;
            const ctx = tempCanvas.getContext('2d');
            
            const size = Math.min(videoW, videoH) * 0.5;
            const sx = (videoW - size) / 2;
            const sy = (videoH - size) * 0.45;
            
            ctx.drawImage(cameraFeed, sx, sy, size, size, 0, 0, 200, 200);
            
            tempCanvas.toBlob(async (blob) => {
                if (!blob) {
                    isDetecting = false;
                    return;
                }
                
                try {
                    const formData = new FormData();
                    formData.append('file', blob, 'detect.jpg');
                    
                    const response = await fetch('/api/recognize/detect-face', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const res = await response.json();
                        
                        if (stream) {
                            if (res.has_face) {
                                if (cameraCutoutRing) {
                                    cameraCutoutRing.className = 'camera-cutout-ring face-detected';
                                }
                                if (cameraStatusMsg) {
                                    cameraStatusMsg.className = 'camera-status-msg detected';
                                    cameraStatusMsg.innerText = 'Face Aligned - Ready!';
                                }
                            } else {
                                if (cameraCutoutRing) {
                                    cameraCutoutRing.className = 'camera-cutout-ring no-face';
                                }
                                if (cameraStatusMsg) {
                                    cameraStatusMsg.className = 'camera-status-msg not-detected';
                                    cameraStatusMsg.innerText = 'No face detected in circle';
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Real-time face detection error:', err);
                } finally {
                    isDetecting = false;
                }
            }, 'image/jpeg', 0.5);
        }, 800);
    }
    
    function stopRealtimeFaceDetection() {
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        isDetecting = false;
    }

    // File Handling
    function handleFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a valid image file (JPG, PNG, WebP).', 'error');
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            document.querySelector('.upload-area-content').style.display = 'none';
            previewSection.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }

    retryBtn.addEventListener('click', () => {
        selectedFile = null;
        previewSection.style.display = 'none';
        document.querySelector('.upload-area-content').style.display = 'block';
        fileInput.value = '';
    });

    // Upload & API Interaction
    uploadSubmitBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        try {
            showLoadingState('Compressing image...');
            const compressedFile = await compressImage(selectedFile);
            
            showLoadingState('Scanning your face...');
            const formData = new FormData();
            formData.append('file', compressedFile);

            setTimeout(() => updateLoadingText('Searching wedding gallery...'), 1500);
            setTimeout(() => updateLoadingText('Matching photos...'), 3000);

            // Fetch from backend API
            const data = await fetchAPI('/recognize', { method: 'POST', body: formData });
            
            hideLoadingState();

            // Check if no face was detected in the photo
            if (data.message && data.message.toLowerCase().includes("no faces detected")) {
                showToast("Face is not clear. Please align your face inside the circle and ensure good lighting.", "error");
                return;
            }
            
            if (data.matches && data.matches.length > 0) {
                // Compatibility with potential different backend responses
                // Assuming data.matches is array of strings (URLs) or objects {image_url, confidence}
                const formattedMatches = data.matches.map(m => {
                    if (typeof m === 'string') return { image_url: m, confidence: 'N/A' };
                    return m;
                });
                renderResults(formattedMatches, data.persons || []);
            } else {
                showEmptyState();
            }

        } catch (error) {
            console.error('Upload failed:', error);
            hideLoadingState();
            showToast('An error occurred during the analysis. Please try again.', 'error');
        }
    });

    function showLoadingState(text) {
        loadingText.textContent = text;
        loadingOverlay.style.display = 'flex';
    }

    function updateLoadingText(text) {
        if(loadingOverlay.style.display === 'flex') {
            loadingText.textContent = text;
        }
    }

    function hideLoadingState() {
        loadingOverlay.style.display = 'none';
    }

    // Results Rendering
    function renderResults(matches, persons) {
        currentMatches = matches.map(m => m.image_url || m);
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        resultsSection.style.display = 'block';
        resultsGrid.style.display = 'grid';
        resultsGrid.innerHTML = '';
        emptyState.style.display = 'none';

        // Render greeting / name prompt for each matched person
        const personInfoContainer = document.getElementById('personInfoContainer');
        if (personInfoContainer) {
            personInfoContainer.innerHTML = '';
            if (persons && persons.length > 0) {
                persons.forEach(person => {
                    const avatarUrl = person.avatar_url || '';
                    const socials = person.social_profiles || {};
                    const hasName = person.display_name && person.display_name.trim() !== '';
                    
                    let socialHtml = '';
                    if (socials.instagram) {
                        socialHtml += `<a href="https://instagram.com/${socials.instagram}" target="_blank" rel="noopener noreferrer" class="social-badge social-badge-sm instagram" title="@${socials.instagram}"><i class="fa-brands fa-instagram"></i></a>`;
                    }
                    if (socials.facebook) {
                        const fbUrl = socials.facebook.startsWith('http') ? socials.facebook : `https://facebook.com/${socials.facebook}`;
                        socialHtml += `<a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="social-badge social-badge-sm facebook" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>`;
                    }
                    if (socials.linkedin) {
                        const liUrl = socials.linkedin.startsWith('http') ? socials.linkedin : `https://linkedin.com/in/${socials.linkedin}`;
                        socialHtml += `<a href="${liUrl}" target="_blank" rel="noopener noreferrer" class="social-badge social-badge-sm linkedin" title="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>`;
                    }
                    
                    const banner = document.createElement('div');
                    banner.className = 'person-info-banner';
                    
                    if (hasName) {
                        // Known person — show personalized greeting
                        banner.innerHTML = `
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${person.display_name}" class="person-info-avatar" onerror="this.style.display='none'">` : ''}
                            <div class="person-info-details">
                                <div class="person-info-name">Hi ${person.display_name}! 👋</div>
                                <div class="person-info-label">We found ${person.photo_count || 0} photo(s) of you from the wedding</div>
                                ${socialHtml ? `<div class="person-info-socials">${socialHtml}</div>` : ''}
                            </div>
                        `;
                    } else {
                        // Unknown person — ask for their name
                        banner.innerHTML = `
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="Guest" class="person-info-avatar" onerror="this.style.display='none'">` : ''}
                            <div class="person-info-details">
                                <div class="person-info-name">We found your photos! 🎉</div>
                                <div class="person-info-label">We matched ${person.photo_count || 0} photo(s) from the wedding. What's your name?</div>
                                <div class="guest-name-prompt" id="namePrompt_${person.id}">
                                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap;">
                                        <input type="text" class="guest-name-input" id="nameInput_${person.id}" placeholder="Enter your name..." maxlength="50">
                                        <button class="btn-save-name" id="nameSaveBtn_${person.id}">
                                            <i class="fa-solid fa-check"></i> Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                    
                    personInfoContainer.appendChild(banner);
                    
                    // Attach name save handler for unnamed persons
                    if (!hasName) {
                        const saveBtn = document.getElementById(`nameSaveBtn_${person.id}`);
                        const nameInput = document.getElementById(`nameInput_${person.id}`);
                        
                        if (saveBtn && nameInput) {
                            const saveName = async () => {
                                const enteredName = nameInput.value.trim();
                                if (!enteredName) {
                                    showToast('Please enter your name.', 'error');
                                    return;
                                }
                                
                                saveBtn.disabled = true;
                                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                                
                                try {
                                    const res = await fetch('/api/recognize/set-name', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            person_id: person.id,
                                            display_name: enteredName
                                        })
                                    });
                                    
                                    if (res.ok) {
                                        // Replace the prompt with a greeting
                                        const prompt = document.getElementById(`namePrompt_${person.id}`);
                                        const bannerEl = prompt.closest('.person-info-banner');
                                        const nameEl = bannerEl.querySelector('.person-info-name');
                                        const labelEl = bannerEl.querySelector('.person-info-label');
                                        
                                        nameEl.textContent = `Hi ${enteredName}! 👋`;
                                        labelEl.textContent = `We found ${person.photo_count || 0} photo(s) of you from the wedding`;
                                        prompt.remove();
                                        
                                        showToast(`Welcome, ${enteredName}!`, 'success');
                                    } else {
                                        const err = await res.json();
                                        showToast(err.detail || 'Failed to save name', 'error');
                                        saveBtn.disabled = false;
                                        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save';
                                    }
                                } catch (e) {
                                    console.error('Failed to save name:', e);
                                    showToast('Failed to save name. Please try again.', 'error');
                                    saveBtn.disabled = false;
                                    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save';
                                }
                            };
                            
                            saveBtn.addEventListener('click', saveName);
                            nameInput.addEventListener('keydown', (e) => {
                                if (e.key === 'Enter') saveName();
                            });
                        }
                    }
                });
            }
        }

        matches.forEach((match, index) => {
            let imgUrl = match.image_url || match;
            if (!imgUrl.startsWith('/')) imgUrl = `/${imgUrl}`;

            const confText = match.confidence !== 'N/A' ? `${Math.round(match.confidence)}% Match` : '';

            const card = document.createElement('div');
            card.className = 'result-card fade-in loading';
            card.style.animationDelay = `${index * 0.1}s`;

            card.innerHTML = `
                ${confText ? `<div class="confidence-badge" style="opacity: 0; transition: opacity 0.3s ease;">${confText}</div>` : ''}
                <img src="${imgUrl}" alt="Wedding Photo" class="result-img" loading="lazy" style="opacity: 0;">
                <div class="result-overlay" style="display: none;">
                    <div style="display: flex; gap: 15px;">
                        <button class="action-btn view-btn" data-img="${imgUrl}" title="View Fullscreen"><i class="fa-solid fa-expand"></i></button>
                        <button class="action-btn download-btn" title="Download"><i class="fa-solid fa-download"></i></button>
                    </div>
                </div>
            `;

            // Attach Events
            const img = card.querySelector('.result-img');
            const viewBtn = card.querySelector('.view-btn');
            const downloadBtn = card.querySelector('.download-btn');
            const confBadge = card.querySelector('.confidence-badge');
            const overlay = card.querySelector('.result-overlay');

            const handleImageLoad = () => {
                card.classList.remove('loading');
                img.style.opacity = '1';
                if (confBadge) confBadge.style.opacity = '1';
                if (overlay) overlay.removeAttribute('style');
            };

            if (img.complete) {
                handleImageLoad();
            } else {
                img.addEventListener('load', handleImageLoad);
                img.addEventListener('error', () => {
                    card.classList.remove('loading');
                    img.src = 'img/placeholder.jpg';
                    img.style.opacity = '0.5';
                });
            }

            viewBtn.addEventListener('click', () => openModal(imgUrl));
            downloadBtn.addEventListener('click', () => downloadImage(imgUrl));

            resultsGrid.appendChild(card);
            
            // Trigger animation
            setTimeout(() => card.classList.add('visible'), 50);
        });
    }

    function showEmptyState() {
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        resultsSection.style.display = 'block';
        resultsGrid.style.display = 'none';
        emptyState.style.display = 'block';
    }

    // Modal
    function openModal(src) {
        modalImg.src = src;
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        modalImg.src = '';
        document.body.classList.remove('modal-open');
    });

    const modalDownloadBtn = document.getElementById('modalDownloadBtn');
    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', () => {
            if (modalImg.src) {
                downloadImage(modalImg.src);
            }
        });
    }

    // Helper Download
    async function downloadImage(url) {
        try {
            showToast('Starting download...', 'info');
            
            // Convert /gallery/... URL to /api/download API call
            const urlObj = new URL(url, window.location.origin);
            let downloadUrl = url;
            if (urlObj.pathname.startsWith('/gallery/')) {
                const path = decodeURIComponent(urlObj.pathname.substring('/gallery/'.length));
                downloadUrl = `/api/download?path=${encodeURIComponent(path)}`;
            }
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = url.split('/').pop() || 'memory.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => showToast('Download triggered!', 'success'), 800);
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to start download', 'error');
        }
    }

    // Reset upload search to go back to "Find My Face" page
    const searchAgainBtn = document.getElementById('searchAgainBtn');
    const emptyStateRetryBtn = document.getElementById('emptyStateRetryBtn');

    function resetUploadSearch(e) {
        if (e) {
            e.preventDefault();
        }
        resultsSection.style.display = 'none';
        
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.style.display = 'flex'; // Restore original flex layout
        }
        
        selectedFile = null;
        currentMatches = [];
        const personInfoContainer = document.getElementById('personInfoContainer');
        if (personInfoContainer) personInfoContainer.innerHTML = '';
        previewSection.style.display = 'none';
        
        const uploadAreaContent = document.querySelector('.upload-area-content');
        if (uploadAreaContent) {
            uploadAreaContent.style.display = 'block';
        }
        fileInput.value = '';
        
        // Scroll back to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (searchAgainBtn) {
        searchAgainBtn.addEventListener('click', resetUploadSearch);
    }
    if (emptyStateRetryBtn) {
        emptyStateRetryBtn.addEventListener('click', resetUploadSearch);
    }

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', async () => {
            if (currentMatches.length === 0) return;
            
            try {
                downloadAllBtn.disabled = true;
                downloadAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing ZIP...';
                showToast('Creating ZIP archive of your photos...', 'info');
                
                const response = await fetch('/api/download/zip', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ paths: currentMatches })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to generate ZIP archive');
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'memories.zip';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showToast('ZIP download started!', 'success');
            } catch (error) {
                console.error('Bulk download failed:', error);
                showToast('Failed to download ZIP archive.', 'error');
            } finally {
                downloadAllBtn.disabled = false;
                downloadAllBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download All (.ZIP)';
            }
        });
    }
});
