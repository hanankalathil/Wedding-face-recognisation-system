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

    // Camera Handlers
    cameraBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering file input click
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            cameraFeed.srcObject = stream;
            cameraModal.classList.add('active');
            document.body.classList.add('modal-open');
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
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraModal.classList.remove('active');
        document.body.classList.remove('modal-open');
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
            
            if (data.matches && data.matches.length > 0) {
                // Compatibility with potential different backend responses
                // Assuming data.matches is array of strings (URLs) or objects {image_url, confidence}
                const formattedMatches = data.matches.map(m => {
                    if (typeof m === 'string') return { image_url: m, confidence: 'N/A' };
                    return m;
                });
                renderResults(formattedMatches);
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
    function renderResults(matches) {
        const uploadSection = document.querySelector('.upload-section');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
        resultsSection.style.display = 'block';
        resultsGrid.style.display = 'grid'; // Ensure grid is visible (fixes empty state hidden grid bug)
        resultsGrid.innerHTML = '';
        emptyState.style.display = 'none';

        matches.forEach((match, index) => {
            let imgUrl = match.image_url || match;
            if (!imgUrl.startsWith('/')) imgUrl = `/${imgUrl}`;

            const confText = match.confidence !== 'N/A' ? `${Math.round(match.confidence)}% Match` : '';

            const card = document.createElement('div');
            card.className = 'result-card fade-in';
            card.style.animationDelay = `${index * 0.1}s`;

            card.innerHTML = `
                ${confText ? `<div class="confidence-badge">${confText}</div>` : ''}
                <img src="${imgUrl}" alt="Wedding Photo" class="result-img" loading="lazy">
                <div class="result-overlay">
                    <div style="display: flex; gap: 15px;">
                        <button class="action-btn view-btn" title="View Fullscreen"><i class="fa-solid fa-expand"></i></button>
                        <button class="action-btn download-btn" title="Download"><i class="fa-solid fa-download"></i></button>
                    </div>
                </div>
            `;

            // Attach Events
            const viewBtn = card.querySelector('.view-btn');
            const downloadBtn = card.querySelector('.download-btn');

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
                const path = urlObj.pathname.substring('/gallery/'.length);
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
});
