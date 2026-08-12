document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tableBody');
    const refreshBtn = document.getElementById('refreshBtn');

    // Tab Switching Logic
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('pageTitle');

    // Mobile Sidebar Toggle
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        if(sidebarOverlay) sidebarOverlay.classList.toggle('active');
    }

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active to clicked nav item
            item.classList.add('active');

            // Hide all tabs
            tabPanes.forEach(tab => {
                if(tab) {
                    tab.style.display = 'none';
                    tab.classList.add('hidden');
                    tab.classList.remove('active');
                }
            });

            // Show selected tab
            const tabId = item.getAttribute('data-tab');
            const targetTab = document.getElementById(`${tabId}-tab`);
            if (targetTab) {
                targetTab.style.display = 'block';
                targetTab.classList.remove('hidden');
                targetTab.classList.add('active');
            }

            if (tabId === 'couple-photos') {
                if (typeof fetchCouplePhotos === 'function') fetchCouplePhotos();
            }

            // Update title
            if(pageTitle) {
                pageTitle.textContent = item.textContent.trim();
            }

            // Close sidebar on mobile
            if (window.innerWidth <= 768 && sidebar) {
                sidebar.classList.remove('active');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        });
    });

    let lastPhotosDataStr = '';
    async function fetchRealData(force = false) {
        try {
            const response = await fetch(`/api/admin/photos`);
            const data = await response.json();
            if (data.status === 'success') {
                const dataStr = JSON.stringify(data.photos);
                if (!force && dataStr === lastPhotosDataStr) return; // Skip DOM update if no change
                lastPhotosDataStr = dataStr;
                
                renderTable(data.photos);
                renderImagesTab(data.photos);
                renderUsersTab(data.photos);
                updateStats(data.photos);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (force) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff6b6b; padding: 20px;">Failed to load data. Is the backend running?</td></tr>';
            }
        }
    }

    function renderTable(photos) {
        tableBody.innerHTML = '';
        const recentPhotos = photos.slice(0, 10); // Show only recent 10 in dashboard
        
        recentPhotos.forEach((photo, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: monospace; color: var(--text-muted);">#IMG-${index+1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${photo.url}" alt="${photo.filename}" class="thumbnail" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover; background: #2a2d3e;">
                        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${photo.filename}</span>
                    </div>
                </td>
                <td style="color: var(--text-muted);">Recent</td>
                <td>
                    <span class="status-badge status-success">Analyzed</span>
                </td>
                <td><strong>N/A</strong></td>
            `;
            tableBody.appendChild(tr);
        });
        
        if (recentPhotos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No analyses found.</td></tr>';
        }
    }

    function renderImagesTab(photos) {
        const imagesGrid = document.getElementById('imagesGrid');
        if (!imagesGrid) return;
        imagesGrid.innerHTML = '';
        
        photos.forEach(photo => {
            const div = document.createElement('div');
            div.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; transition: transform 0.2s; position: relative;';
            div.onmouseover = () => div.style.transform = 'translateY(-4px)';
            div.onmouseout = () => div.style.transform = 'translateY(0)';
            div.innerHTML = `
                <img src="${photo.url}" style="width: 100%; height: 140px; object-fit: cover;">
                <button class="rename-btn" style="position: absolute; top: 8px; right: 42px; background: rgba(26, 54, 93, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Rename Photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
                <button class="delete-btn" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Delete Photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <div style="padding: 12px;">
                    <p style="font-size: 0.8rem; margin: 0; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${photo.filename}">${photo.filename}</p>
                </div>
            `;
            const renameBtn = div.querySelector('.rename-btn');
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = await showCustomPrompt('Rename Photo', photo.filename);
                if (newName && newName !== photo.filename) {
                    try {
                        const res = await fetch(`/api/admin/photos/rename`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: photo.path, new_name: newName })
                        });
                        if (res.ok) {
                            fetchRealData();
                        } else {
                            const err = await res.json();
                            showCustomAlert(err.detail || 'Failed to rename photo');
                        }
                    } catch (err) {
                        console.error('Failed to rename', err);
                    }
                }
            });
            const deleteBtn = div.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showCustomConfirm('Are you sure you want to delete this image?')) {
                    try {
                        const res = await fetch(`/api/admin/photos/delete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: photo.path })
                        });
                        if (res.ok) fetchRealData();
                    } catch (err) { console.error('Failed to delete', err); }
                }
            });
            imagesGrid.appendChild(div);
        });
        
        if (photos.length === 0) {
            imagesGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No images found.</p>';
        }
    }

    function renderUsersTab(photos) {
        const usersGrid = document.getElementById('usersGrid');
        if (!usersGrid) return;
        usersGrid.innerHTML = '';
        
        const users = {};
        photos.forEach(photo => {
            const parts = photo.path.split('/');
            if (parts.length > 1) {
                const userDir = parts[0];
                if (!users[userDir]) {
                    users[userDir] = photo;
                }
            }
        });
        
        Object.keys(users).forEach(userName => {
            const photo = users[userName];
            const div = document.createElement('div');
            div.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; cursor: pointer;';
            div.addEventListener('click', () => {
                openUserPhotosModal(userName, photos);
            });
            div.innerHTML = `
                <button class="rename-user-btn" style="position: absolute; top: 12px; right: 46px; background: rgba(26, 54, 93, 0.9); color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center;" title="Rename User">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
                <button class="delete-user-btn" style="position: absolute; top: 12px; right: 12px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 4px; padding: 6px; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center;" title="Delete User">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <img src="${photo.url}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 16px; border: 2px solid var(--primary-color);">
                <h3 style="margin: 0; font-size: 1rem; color: var(--text-light); word-break: break-all;">${userName}</h3>
            `;
            const renameUserBtn = div.querySelector('.rename-user-btn');
            renameUserBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = await showCustomPrompt('Rename User', userName);
                if (newName && newName !== userName) {
                    try {
                        const res = await fetch(`/api/admin/users/rename`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ old_user_id: userName, new_user_id: newName })
                        });
                        if (res.ok) {
                            fetchRealData();
                        } else {
                            const err = await res.json();
                            showCustomAlert(err.detail || 'Failed to rename user');
                        }
                    } catch (err) {
                        console.error('Failed to rename user', err);
                    }
                }
            });
            const deleteUserBtn = div.querySelector('.delete-user-btn');
            deleteUserBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showCustomConfirm(`Are you sure you want to delete user "${userName}" and ALL their images?`)) {
                    try {
                        const res = await fetch(`/api/admin/users/delete`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: userName })
                        });
                        if (res.ok) fetchRealData();
                    } catch (err) { console.error('Failed to delete user', err); }
                }
            });
            usersGrid.appendChild(div);
        });
        
        if (Object.keys(users).length === 0) {
            usersGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No recognized users found.</p>';
        }
    }

    function updateStats(photos) {
        const statImages = document.getElementById('statImages');
        if (statImages) statImages.textContent = photos.length;
        
        const uniqueUsers = new Set();
        photos.forEach(photo => {
            const parts = photo.path.split('/');
            if (parts.length > 1 && parts[0] !== 'Group photo' && parts[0] !== 'unrecognized') {
                uniqueUsers.add(parts[0]);
            }
        });
        
        const statUsers = document.getElementById('statUsers');
        if (statUsers) statUsers.textContent = uniqueUsers.size;
    }

    // Initial render
    fetchRealData(true);

    // Refresh button logic
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = 'Refreshing...';
        refreshBtn.disabled = true;
        
        await fetchRealData(true);
        
        refreshBtn.innerHTML = 'Refresh';
        refreshBtn.disabled = false;
    });

    const refreshImagesBtn = document.getElementById('refreshImagesBtn');
    if (refreshImagesBtn) {
        refreshImagesBtn.addEventListener('click', async () => {
            refreshImagesBtn.innerHTML = 'Refreshing...';
            refreshImagesBtn.disabled = true;
            await fetchRealData(true);
            refreshImagesBtn.innerHTML = 'Refresh Images';
            refreshImagesBtn.disabled = false;
        });
    }

    // --- Bulk Upload Modal Logic ---
    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    const uploadModal = document.getElementById('uploadModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const startUploadBtn = document.getElementById('startUploadBtn');
    const adminUploadContainer = document.getElementById('adminUploadContainer');
    const adminFileInput = document.getElementById('adminFileInput');
    const adminBrowseBtn = document.getElementById('adminBrowseBtn');
    const bulkPreviewArea = document.getElementById('bulkPreviewArea');
    const previewGrid = document.getElementById('previewGrid');
    const selectedFilesCount = document.getElementById('selectedFilesCount');
    const clearFilesBtn = document.getElementById('clearFilesBtn');
    
    let selectedFiles = [];

    function openModal() {
        uploadModal.classList.remove('hidden');
    }

    function closeModal() {
        uploadModal.classList.add('hidden');
        clearFiles();
    }

    bulkUploadBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelUploadBtn.addEventListener('click', closeModal);

    // Prevent closing when clicking inside the modal content
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            closeModal();
        }
    });

    adminBrowseBtn.addEventListener('click', () => {
        adminFileInput.click();
    });

    adminFileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop for admin modal
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        adminUploadContainer.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        adminUploadContainer.addEventListener(eventName, () => adminUploadContainer.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        adminUploadContainer.addEventListener(eventName, () => adminUploadContainer.classList.remove('dragover'), false);
    });

    adminUploadContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    }, false);

    function handleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (newFiles.length === 0) return;

        selectedFiles = [...selectedFiles, ...newFiles];
        updatePreview();
    }

    function updatePreview() {
        if (selectedFiles.length > 0) {
            bulkPreviewArea.classList.remove('hidden');
            startUploadBtn.disabled = false;
        } else {
            bulkPreviewArea.classList.add('hidden');
            startUploadBtn.disabled = true;
        }

        selectedFilesCount.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected`;
        previewGrid.innerHTML = '';

        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `
                    <img src="${reader.result}" alt="preview">
                    <button class="remove-item-btn" data-index="${index}">&times;</button>
                `;
                previewGrid.appendChild(div);
            };
        });
    }

    // Handle individual file removal
    previewGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-item-btn')) {
            const index = parseInt(e.target.getAttribute('data-index'));
            selectedFiles.splice(index, 1);
            updatePreview();
        }
    });

    function clearFiles() {
        selectedFiles = [];
        adminFileInput.value = '';
        updatePreview();
    }

    clearFilesBtn.addEventListener('click', clearFiles);

    // Real upload process
    startUploadBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;
        
        startUploadBtn.innerHTML = 'Uploading...';
        startUploadBtn.disabled = true;
        cancelUploadBtn.disabled = true;
        clearFilesBtn.disabled = true;

        let successCount = 0;
        let failCount = 0;

        for (const file of selectedFiles) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch(`/api/admin/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
            }
        }

        showCustomAlert(`Upload complete! Success: ${successCount}, Failed: ${failCount}`);
        closeModal();
        startUploadBtn.innerHTML = 'Start Upload';
        cancelUploadBtn.disabled = false;
        clearFilesBtn.disabled = false;
        fetchRealData(); // Refresh data after upload
    });

    function showCustomAlert(message) {
        const existing = document.getElementById('custom-alert-overlay');
        if (existing) document.body.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'custom-alert-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(10, 10, 15, 0.7)';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

        const content = document.createElement('div');
        content.style.background = 'linear-gradient(160deg, rgba(35, 35, 45, 0.95), rgba(20, 20, 28, 0.95))';
        content.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        content.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(127, 112, 245, 0.15)';
        content.style.borderRadius = '24px';
        content.style.padding = '35px 30px';
        content.style.maxWidth = '400px';
        content.style.width = '90%';
        content.style.textAlign = 'center';
        content.style.transform = 'translateY(30px) scale(0.9)';
        content.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        
        const iconWrapper = document.createElement('div');
        iconWrapper.style.width = '64px';
        iconWrapper.style.height = '64px';
        iconWrapper.style.borderRadius = '50%';
        iconWrapper.style.background = 'var(--primary)';
        iconWrapper.style.display = 'flex';
        iconWrapper.style.justifyContent = 'center';
        iconWrapper.style.alignItems = 'center';
        iconWrapper.style.margin = '0 auto 24px';
        iconWrapper.style.boxShadow = '0 10px 25px rgba(26, 54, 93, 0.4)';
        
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = '✓';
        checkIcon.style.color = '#fff';
        checkIcon.style.fontSize = '32px';
        checkIcon.style.fontWeight = '800';
        iconWrapper.appendChild(checkIcon);

        const text = document.createElement('h3');
        text.textContent = message;
        text.style.margin = '0 0 28px 0';
        text.style.fontSize = '1.15rem';
        text.style.fontWeight = '500';
        text.style.color = '#f1f1f1';
        text.style.lineHeight = '1.6';
        text.style.fontFamily = "'Inter', 'Segoe UI', system-ui, sans-serif";

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Continue';
        okBtn.style.background = 'var(--primary)';
        okBtn.style.color = '#fff';
        okBtn.style.border = 'none';
        okBtn.style.borderRadius = '14px';
        okBtn.style.padding = '14px 0';
        okBtn.style.fontSize = '1.05rem';
        okBtn.style.fontWeight = '600';
        okBtn.style.cursor = 'pointer';
        okBtn.style.width = '100%';
        okBtn.style.transition = 'all 0.3s ease';
        okBtn.style.boxShadow = '0 8px 20px rgba(26, 54, 93, 0.3)';
        
        okBtn.onmouseover = () => {
            okBtn.style.transform = 'translateY(-2px)';
            okBtn.style.boxShadow = '0 12px 25px rgba(127, 112, 245, 0.45)';
            okBtn.style.filter = 'brightness(1.1)';
        };
        okBtn.onmouseout = () => {
            okBtn.style.transform = 'translateY(0)';
            okBtn.style.boxShadow = '0 8px 20px rgba(127, 112, 245, 0.3)';
            okBtn.style.filter = 'brightness(1)';
        };

        const closeAlert = () => {
            overlay.style.opacity = '0';
            content.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 400);
        };

        okBtn.onclick = closeAlert;

        content.appendChild(iconWrapper);
        content.appendChild(text);
        content.appendChild(okBtn);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            content.style.transform = 'translateY(0) scale(1)';
        });
    }

    // --- User Photos Modal Logic ---
    const userPhotosModal = document.getElementById('userPhotosModal');
    const closeUserPhotosBtn = document.getElementById('closeUserPhotosBtn');
    const userPhotosGrid = document.getElementById('userPhotosGrid');
    const userPhotosModalTitle = document.getElementById('userPhotosModalTitle');

    if (closeUserPhotosBtn) {
        closeUserPhotosBtn.addEventListener('click', () => {
            userPhotosModal.classList.add('hidden');
        });
    }

    if (userPhotosModal) {
        userPhotosModal.addEventListener('click', (e) => {
            if (e.target === userPhotosModal) {
                userPhotosModal.classList.add('hidden');
            }
        });
    }

    // --- Fullscreen Image Modal Logic ---
    const fullscreenImageModal = document.getElementById('fullscreenImageModal');
    const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
    const fullscreenImage = document.getElementById('fullscreenImage');

    if (closeFullscreenBtn) {
        closeFullscreenBtn.addEventListener('click', () => {
            fullscreenImageModal.classList.add('hidden');
        });
    }

    if (fullscreenImageModal) {
        fullscreenImageModal.addEventListener('click', (e) => {
            if (e.target === fullscreenImageModal) {
                fullscreenImageModal.classList.add('hidden');
            }
        });
    }

    function openUserPhotosModal(userName, allPhotos) {
        if (!userPhotosModal || !userPhotosGrid) return;
        
        userPhotosModalTitle.textContent = `${userName}'s Photos`;
        userPhotosGrid.innerHTML = '';
        
        // Filter photos for this user
        const userPhotos = allPhotos.filter(photo => {
            const parts = photo.path.split('/');
            return parts.length > 1 && parts[0] === userName;
        });
        
        if (userPhotos.length === 0) {
            userPhotosGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No images found for this user.</p>';
        } else {
            userPhotos.forEach(photo => {
                const imgDiv = document.createElement('div');
                imgDiv.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; transition: transform 0.2s; position: relative;';
                imgDiv.onmouseover = () => imgDiv.style.transform = 'translateY(-4px)';
                imgDiv.onmouseout = () => imgDiv.style.transform = 'translateY(0)';
                
                const imgSrc = `${photo.url}`;
                
                imgDiv.innerHTML = `
                    <img src="${imgSrc}" style="width: 100%; height: 140px; object-fit: cover; cursor: pointer;">
                    <button class="rename-btn" style="position: absolute; top: 8px; right: 42px; background: rgba(26, 54, 93, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Rename Photo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </button>
                    <button class="delete-btn" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Delete Photo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                    <div style="padding: 12px;">
                        <p style="font-size: 0.8rem; margin: 0; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${photo.filename}">${photo.filename}</p>
                    </div>
                `;
                
                const renameBtn = imgDiv.querySelector('.rename-btn');
                renameBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const newName = await showCustomPrompt('Rename Photo', photo.filename);
                    if (newName && newName !== photo.filename) {
                        try {
                            const res = await fetch(`/api/admin/photos/rename`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: photo.path, new_name: newName })
                            });
                            if (res.ok) {
                                await fetchRealData();
                                userPhotosModal.classList.add('hidden');
                            } else {
                                const err = await res.json();
                                showCustomAlert(err.detail || 'Failed to rename photo');
                            }
                        } catch (err) {
                            console.error('Failed to rename photo', err);
                        }
                    }
                });

                const deleteBtn = imgDiv.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (await showCustomConfirm('Are you sure you want to delete this image?')) {
                        try {
                            const res = await fetch(`/api/admin/photos/delete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: photo.path })
                            });
                            if (res.ok) {
                                // Refresh global data which will update everything
                                await fetchRealData();
                                // Close the modal since data changed (or re-render modal, but simpler to close)
                                userPhotosModal.classList.add('hidden');
                            }
                        } catch (err) { console.error('Failed to delete', err); }
                    }
                });

                const img = imgDiv.querySelector('img');
                img.addEventListener('click', () => {
                    fullscreenImage.src = imgSrc;
                    fullscreenImageModal.classList.remove('hidden');
                });
                
                userPhotosGrid.appendChild(imgDiv);
            });
        }
        
        userPhotosModal.classList.remove('hidden');
    }

    // --- Find Duplicates Logic ---
    const findDuplicatesBtn = document.getElementById('findDuplicatesBtn');
    const duplicatesModal = document.getElementById('duplicatesModal');
    const closeDuplicatesBtn = document.getElementById('closeDuplicatesBtn');
    const duplicatesList = document.getElementById('duplicatesList');

    if (closeDuplicatesBtn) {
        closeDuplicatesBtn.addEventListener('click', () => {
            duplicatesModal.classList.add('hidden');
        });
    }

    if (duplicatesModal) {
        duplicatesModal.addEventListener('click', (e) => {
            if (e.target === duplicatesModal) {
                duplicatesModal.classList.add('hidden');
            }
        });
    }

    if (findDuplicatesBtn) {
        findDuplicatesBtn.addEventListener('click', async () => {
            findDuplicatesBtn.innerHTML = 'Searching...';
            findDuplicatesBtn.disabled = true;

            try {
                const res = await fetch(`/api/admin/photos/duplicates`);
                const data = await res.json();

                if (data.status === 'success') {
                    duplicatesList.innerHTML = '';

                    if (data.duplicates.length === 0) {
                        duplicatesList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No exact duplicate photos found.</p>';
                    } else {
                        data.duplicates.forEach((pair, index) => {
                            const pairDiv = document.createElement('div');
                            pairDiv.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 20px; padding: 16px; display: flex; gap: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap;';
                            
                            const renderPhoto = (photo, label) => {
                                return `
                                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px;">
                                        <span style="font-weight: bold; color: var(--text-muted); font-size: 0.9rem;">${label}</span>
                                        <img src="${photo.url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;">
                                        <span style="font-size: 0.8rem; color: var(--text-light); word-break: break-all;">${photo.filename}</span>
                                        <button class="btn-primary delete-dup-btn" data-path="${photo.path}" style="padding: 6px 12px; font-size: 0.8rem; background: #ef4444;">Delete This Copy</button>
                                    </div>
                                `;
                            };

                            pairDiv.innerHTML = renderPhoto(pair.original, 'Original (Kept first)') + 
                                              '<div style="font-size: 1.5rem; color: var(--text-muted);"><svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></div>' + 
                                              renderPhoto(pair.duplicate, 'Exact Duplicate');

                            // Add event listeners
                            const deleteBtns = pairDiv.querySelectorAll('.delete-dup-btn');
                            deleteBtns.forEach(btn => {
                                btn.addEventListener('click', async (e) => {
                                    if (confirm('Delete this duplicate photo permanently?')) {
                                        const path = e.target.getAttribute('data-path');
                                        try {
                                            const delRes = await fetch(`/api/admin/photos/delete`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ path: path })
                                            });
                                            if (delRes.ok) {
                                                // Refresh duplicates list and main data
                                                fetchRealData();
                                                findDuplicatesBtn.click(); // re-trigger search
                                            }
                                        } catch (err) {
                                            console.error('Failed to delete duplicate', err);
                                        }
                                    }
                                });
                            });

                            duplicatesList.appendChild(pairDiv);
                        });
                    }
                    duplicatesModal.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error finding duplicates:', error);
                showCustomAlert('Error finding duplicates. Check console.');
            }

            findDuplicatesBtn.innerHTML = 'Find Duplicates';
            findDuplicatesBtn.disabled = false;
        });
    }

    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(10, 10, 15, 0.7)';
            overlay.style.backdropFilter = 'blur(10px)';
            overlay.style.display = 'flex';
            overlay.style.zIndex = '9999';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

            const content = document.createElement('div');
            content.style.background = 'linear-gradient(160deg, rgba(35, 35, 45, 0.95), rgba(20, 20, 28, 0.95))';
            content.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            content.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(127, 112, 245, 0.15)';
            content.style.borderRadius = '24px';
            content.style.padding = '35px 30px';
            content.style.maxWidth = '400px';
            content.style.width = '90%';
            content.style.textAlign = 'center';
            content.style.transform = 'translateY(30px) scale(0.9)';
            content.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            
            const iconWrapper = document.createElement('div');
            iconWrapper.style.width = '64px';
            iconWrapper.style.height = '64px';
            iconWrapper.style.borderRadius = '50%';
            iconWrapper.style.background = '#EF4444';
            iconWrapper.style.display = 'flex';
            iconWrapper.style.justifyContent = 'center';
            iconWrapper.style.alignItems = 'center';
            iconWrapper.style.margin = '0 auto 24px';
            iconWrapper.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.4)';
            
            const warningIcon = document.createElement('span');
            warningIcon.innerHTML = '!';
            warningIcon.style.color = '#fff';
            warningIcon.style.fontSize = '32px';
            warningIcon.style.fontWeight = '800';
            iconWrapper.appendChild(warningIcon);

            const text = document.createElement('h3');
            text.textContent = message;
            text.style.margin = '0 0 28px 0';
            text.style.fontSize = '1.15rem';
            text.style.fontWeight = '500';
            text.style.color = '#f1f1f1';
            text.style.lineHeight = '1.6';
            text.style.fontFamily = "'Inter', 'Segoe UI', system-ui, sans-serif";

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '15px';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            cancelBtn.style.color = '#fff';
            cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            cancelBtn.style.borderRadius = '14px';
            cancelBtn.style.padding = '12px 0';
            cancelBtn.style.fontSize = '1.05rem';
            cancelBtn.style.fontWeight = '600';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.style.flex = '1';
            cancelBtn.style.transition = 'all 0.3s ease';

            cancelBtn.onmouseover = () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            };
            cancelBtn.onmouseout = () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            };

            const okBtn = document.createElement('button');
            okBtn.textContent = 'Delete';
            okBtn.style.background = '#EF4444';
            okBtn.style.color = '#fff';
            okBtn.style.border = 'none';
            okBtn.style.borderRadius = '14px';
            okBtn.style.padding = '12px 0';
            okBtn.style.fontSize = '1.05rem';
            okBtn.style.fontWeight = '600';
            okBtn.style.cursor = 'pointer';
            okBtn.style.flex = '1';
            okBtn.style.transition = 'all 0.3s ease';
            okBtn.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)';
            
            okBtn.onmouseover = () => {
                okBtn.style.transform = 'translateY(-2px)';
                okBtn.style.boxShadow = '0 12px 25px rgba(239, 68, 68, 0.45)';
                okBtn.style.filter = 'brightness(1.1)';
            };
            okBtn.onmouseout = () => {
                okBtn.style.transform = 'translateY(0)';
                okBtn.style.boxShadow = '0 8px 20px rgba(255, 107, 107, 0.3)';
                okBtn.style.filter = 'brightness(1)';
            };

            const closeAlert = (result) => {
                overlay.style.opacity = '0';
                content.style.transform = 'translateY(20px) scale(0.95)';
                setTimeout(() => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    resolve(result);
                }, 400);
            };

            cancelBtn.onclick = () => closeAlert(false);
            okBtn.onclick = () => closeAlert(true);

            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(okBtn);

            content.appendChild(iconWrapper);
            content.appendChild(text);
            content.appendChild(btnContainer);
            overlay.appendChild(content);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                content.style.transform = 'translateY(0) scale(1)';
            });
        });
    }

    function showCustomPrompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'rgba(10, 10, 15, 0.7)';
            overlay.style.backdropFilter = 'blur(10px)';
            overlay.style.display = 'flex';
            overlay.style.zIndex = '9999';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

            const content = document.createElement('div');
            content.style.background = 'linear-gradient(160deg, rgba(35, 35, 45, 0.95), rgba(20, 20, 28, 0.95))';
            content.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            content.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(127, 112, 245, 0.15)';
            content.style.borderRadius = '24px';
            content.style.padding = '35px 30px';
            content.style.maxWidth = '400px';
            content.style.width = '90%';
            content.style.textAlign = 'center';
            content.style.transform = 'translateY(30px) scale(0.9)';
            content.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            
            const iconWrapper = document.createElement('div');
            iconWrapper.style.width = '64px';
            iconWrapper.style.height = '64px';
            iconWrapper.style.borderRadius = '50%';
            iconWrapper.style.background = 'var(--primary)';
            iconWrapper.style.display = 'flex';
            iconWrapper.style.justifyContent = 'center';
            iconWrapper.style.alignItems = 'center';
            iconWrapper.style.margin = '0 auto 24px';
            iconWrapper.style.boxShadow = '0 10px 25px rgba(26, 54, 93, 0.4)';
            
            const editIcon = document.createElement('span');
            editIcon.innerHTML = '✏️';
            editIcon.style.color = '#fff';
            editIcon.style.fontSize = '24px';
            iconWrapper.appendChild(editIcon);

            const text = document.createElement('h3');
            text.textContent = message;
            text.style.margin = '0 0 20px 0';
            text.style.fontSize = '1.15rem';
            text.style.fontWeight = '500';
            text.style.color = '#f1f1f1';
            text.style.lineHeight = '1.6';
            text.style.fontFamily = "'Inter', 'Segoe UI', system-ui, sans-serif";

            const input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.style.width = '100%';
            input.style.padding = '12px 16px';
            input.style.borderRadius = '12px';
            input.style.border = '1px solid rgba(255, 255, 255, 0.15)';
            input.style.background = 'rgba(6, 9, 19, 0.5)';
            input.style.color = '#fff';
            input.style.fontSize = '0.95rem';
            input.style.marginBottom = '24px';
            input.style.boxSizing = 'border-box';
            input.style.outline = 'none';
            input.style.transition = 'border-color 0.3s';
            input.onfocus = () => input.style.borderColor = 'var(--primary)';
            input.onblur = () => input.style.borderColor = 'rgba(255, 255, 255, 0.15)';

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '15px';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            cancelBtn.style.color = '#fff';
            cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            cancelBtn.style.borderRadius = '14px';
            cancelBtn.style.padding = '12px 0';
            cancelBtn.style.fontSize = '1.05rem';
            cancelBtn.style.fontWeight = '600';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.style.flex = '1';
            cancelBtn.style.transition = 'all 0.3s ease';

            cancelBtn.onmouseover = () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            };
            cancelBtn.onmouseout = () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            };

            const okBtn = document.createElement('button');
            okBtn.textContent = 'Save';
            okBtn.style.background = 'var(--primary)';
            okBtn.style.color = '#fff';
            okBtn.style.border = 'none';
            okBtn.style.borderRadius = '14px';
            okBtn.style.padding = '12px 0';
            okBtn.style.fontSize = '1.05rem';
            okBtn.style.fontWeight = '600';
            okBtn.style.cursor = 'pointer';
            okBtn.style.flex = '1';
            okBtn.style.transition = 'all 0.3s ease';
            okBtn.style.boxShadow = '0 8px 20px rgba(26, 54, 93, 0.3)';
            
            okBtn.onmouseover = () => {
                okBtn.style.transform = 'translateY(-2px)';
                okBtn.style.boxShadow = '0 12px 25px rgba(26, 54, 93, 0.45)';
                okBtn.style.filter = 'brightness(1.1)';
            };
            okBtn.onmouseout = () => {
                okBtn.style.transform = 'translateY(0)';
                okBtn.style.boxShadow = '0 8px 20px rgba(127, 112, 245, 0.3)';
                okBtn.style.filter = 'brightness(1)';
            };

            const closeAlert = (result) => {
                overlay.style.opacity = '0';
                content.style.transform = 'translateY(20px) scale(0.95)';
                setTimeout(() => {
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                    resolve(result);
                }, 400);
            };

            cancelBtn.onclick = () => closeAlert(null);
            okBtn.onclick = () => {
                const val = input.value.trim();
                if (val) {
                    closeAlert(val);
                } else {
                    input.style.borderColor = '#FF6B6B';
                }
            };

            input.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            });

            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(okBtn);

            content.appendChild(iconWrapper);
            content.appendChild(text);
            content.appendChild(input);
            content.appendChild(btnContainer);
            overlay.appendChild(content);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                content.style.transform = 'translateY(0) scale(1)';
                input.focus();
            });
        });
    }

    // --- Couple Photos Feature Implementation ---
    let couplePhotosData = [];
    let selectedCoupleFiles = [];
    let currentCoupleFilter = 'all';

    const couplePhotosGrid = document.getElementById('couplePhotosGrid');
    const refreshCouplePhotosBtn = document.getElementById('refreshCouplePhotosBtn');
    const uploadCouplePhotoBtn = document.getElementById('uploadCouplePhotoBtn');
    const coupleUploadModal = document.getElementById('coupleUploadModal');
    const closeCoupleModalBtn = document.getElementById('closeCoupleModalBtn');
    const cancelCoupleUploadBtn = document.getElementById('cancelCoupleUploadBtn');
    const startCoupleUploadBtn = document.getElementById('startCoupleUploadBtn');
    const coupleUploadContainer = document.getElementById('coupleUploadContainer');
    const coupleFileInput = document.getElementById('coupleFileInput');
    const coupleBrowseBtn = document.getElementById('coupleBrowseBtn');
    const couplePreviewArea = document.getElementById('couplePreviewArea');
    const couplePreviewGrid = document.getElementById('couplePreviewGrid');
    const coupleSelectedCount = document.getElementById('coupleSelectedCount');
    const clearCoupleFilesBtn = document.getElementById('clearCoupleFilesBtn');
    const coupleCategorySelect = document.getElementById('coupleCategorySelect');
    const coupleCategoryFilters = document.getElementById('coupleCategoryFilters');

    let lastCouplePhotosDataStr = '';
    async function fetchCouplePhotos(force = false) {
        try {
            const response = await fetch(`/api/admin/couple-photos`);
            const data = await response.json();
            if (data.status === 'success') {
                const dataStr = JSON.stringify(data.photos);
                if (!force && dataStr === lastCouplePhotosDataStr) return; // Skip DOM update if no change
                lastCouplePhotosDataStr = dataStr;
                
                couplePhotosData = data.photos;
                renderCouplePhotos();
            }
        } catch (error) {
            console.error('Error fetching couple photos:', error);
            if (force && couplePhotosGrid) {
                couplePhotosGrid.innerHTML = '<p style="color: #ff6b6b; grid-column: 1/-1;">Failed to load couple photos.</p>';
            }
        }
    }

    // Make fetchCouplePhotos globally available within the parent scope if needed
    window.fetchCouplePhotos = fetchCouplePhotos;

    function renderCouplePhotos() {
        if (!couplePhotosGrid) return;
        couplePhotosGrid.innerHTML = '';
        
        const filteredPhotos = currentCoupleFilter === 'all'
            ? couplePhotosData
            : couplePhotosData.filter(p => p.category === currentCoupleFilter);

        filteredPhotos.forEach(photo => {
            const div = document.createElement('div');
            div.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; transition: transform 0.2s; position: relative;';
            div.onmouseover = () => div.style.transform = 'translateY(-4px)';
            div.onmouseout = () => div.style.transform = 'translateY(0)';
            div.innerHTML = `
                <img src="${photo.url}" style="width: 100%; height: 140px; object-fit: cover; cursor: pointer;">
                <span class="status-badge" style="position: absolute; top: 8px; left: 8px; font-size: 0.75rem; background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 4px; z-index: 5;">${photo.category.toUpperCase()}</span>
                <button class="rename-btn" style="position: absolute; top: 8px; right: 42px; background: rgba(26, 54, 93, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Rename Photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
                <button class="delete-btn" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem; z-index: 10; backdrop-filter: blur(4px);" title="Delete Photo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; vertical-align: middle;">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <div style="padding: 12px;">
                    <p style="font-size: 0.8rem; margin: 0; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${photo.filename}">${photo.filename}</p>
                </div>
            `;

            const img = div.querySelector('img');
            img.addEventListener('click', () => {
                const fullscreenImage = document.getElementById('fullscreenImage');
                const fullscreenImageModal = document.getElementById('fullscreenImageModal');
                if (fullscreenImage && fullscreenImageModal) {
                    fullscreenImage.src = photo.url;
                    fullscreenImageModal.classList.remove('hidden');
                }
            });

            const renameBtn = div.querySelector('.rename-btn');
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = await showCustomPrompt('Rename Photo', photo.filename);
                if (newName && newName !== photo.filename) {
                    try {
                        const res = await fetch(`/api/admin/photos/rename`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: photo.path, new_name: newName })
                        });
                        if (res.ok) {
                            fetchCouplePhotos();
                        } else {
                            const err = await res.json();
                            showCustomAlert(err.detail || 'Failed to rename photo');
                        }
                    } catch (err) {
                        console.error('Failed to rename couple photo', err);
                    }
                }
            });

            const deleteBtn = div.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await showCustomConfirm('Are you sure you want to delete this couple photo?')) {
                    try {
                       const res = await fetch(`/api/admin/couple-photos/delete`, {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({ path: photo.path })
                       });
                       if (res.ok) fetchCouplePhotos();
                    } catch (err) { console.error('Failed to delete couple photo', err); }
                }
            });
            couplePhotosGrid.appendChild(div);
        });

        if (filteredPhotos.length === 0) {
            couplePhotosGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No couple photos found in this category.</p>';
        }
    }

    if (uploadCouplePhotoBtn) {
        uploadCouplePhotoBtn.addEventListener('click', () => {
            if (coupleUploadModal) coupleUploadModal.classList.remove('hidden');
        });
    }

    if (closeCoupleModalBtn) {
        closeCoupleModalBtn.addEventListener('click', closeCoupleModal);
    }

    if (cancelCoupleUploadBtn) {
        cancelCoupleUploadBtn.addEventListener('click', closeCoupleModal);
    }

    function closeCoupleModal() {
        if (coupleUploadModal) coupleUploadModal.classList.add('hidden');
        clearCoupleFiles();
    }

    if (coupleUploadModal) {
        coupleUploadModal.addEventListener('click', (e) => {
            if (e.target === coupleUploadModal) closeCoupleModal();
        });
    }

    if (coupleBrowseBtn) {
        coupleBrowseBtn.addEventListener('click', () => {
            if (coupleFileInput) coupleFileInput.click();
        });
    }

    if (coupleFileInput) {
        coupleFileInput.addEventListener('change', (e) => {
            handleCoupleFiles(e.target.files);
        });
    }

    if (coupleUploadContainer) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            coupleUploadContainer.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            coupleUploadContainer.addEventListener(eventName, () => coupleUploadContainer.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            coupleUploadContainer.addEventListener(eventName, () => coupleUploadContainer.classList.remove('dragover'), false);
        });

        coupleUploadContainer.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            handleCoupleFiles(dt.files);
        }, false);
    }

    function handleCoupleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (newFiles.length === 0) return;

        selectedCoupleFiles = [...selectedCoupleFiles, ...newFiles];
        updateCouplePreview();
    }

    function updateCouplePreview() {
        if (!couplePreviewArea || !startCoupleUploadBtn) return;
        if (selectedCoupleFiles.length > 0) {
            couplePreviewArea.classList.remove('hidden');
            startCoupleUploadBtn.disabled = false;
        } else {
            couplePreviewArea.classList.add('hidden');
            startCoupleUploadBtn.disabled = true;
        }

        if (coupleSelectedCount) {
            coupleSelectedCount.textContent = `${selectedCoupleFiles.length} file${selectedCoupleFiles.length !== 1 ? 's' : ''} selected`;
        }
        if (couplePreviewGrid) {
            couplePreviewGrid.innerHTML = '';
            selectedCoupleFiles.forEach((file, index) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => {
                    const div = document.createElement('div');
                    div.className = 'preview-item';
                    div.innerHTML = `
                        <img src="${reader.result}" alt="preview">
                        <button class="remove-item-btn" data-index="${index}">&times;</button>
                    `;
                    couplePreviewGrid.appendChild(div);
                };
            });
        }
    }

    if (couplePreviewGrid) {
        couplePreviewGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const index = parseInt(e.target.getAttribute('data-index'));
                selectedCoupleFiles.splice(index, 1);
                updateCouplePreview();
            }
        });
    }

    function clearCoupleFiles() {
        selectedCoupleFiles = [];
        if (coupleFileInput) coupleFileInput.value = '';
        updateCouplePreview();
    }

    if (clearCoupleFilesBtn) {
        clearCoupleFilesBtn.addEventListener('click', clearCoupleFiles);
    }

    if (startCoupleUploadBtn) {
        startCoupleUploadBtn.addEventListener('click', async () => {
            if (selectedCoupleFiles.length === 0) return;
            
            startCoupleUploadBtn.innerHTML = 'Uploading...';
            startCoupleUploadBtn.disabled = true;
            if (cancelCoupleUploadBtn) cancelCoupleUploadBtn.disabled = true;
            if (clearCoupleFilesBtn) clearCoupleFilesBtn.disabled = true;

            let successCount = 0;
            let failCount = 0;
            const category = coupleCategorySelect ? coupleCategorySelect.value : 'ceremony';

            for (const file of selectedCoupleFiles) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('category', category);
                    
                    const response = await fetch(`/api/admin/couple-photos/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                       failCount++;
                    }
                } catch (error) {
                    failCount++;
                }
            }

            showCustomAlert(`Upload complete! Success: ${successCount}, Failed: ${failCount}`);
            closeCoupleModal();
            startCoupleUploadBtn.innerHTML = 'Start Upload';
            if (cancelCoupleUploadBtn) cancelCoupleUploadBtn.disabled = false;
            if (clearCoupleFilesBtn) clearCoupleFilesBtn.disabled = false;
            fetchCouplePhotos(true); // Refresh couple photos grid
        });
    }

    if (refreshCouplePhotosBtn) {
        refreshCouplePhotosBtn.addEventListener('click', async () => {
            refreshCouplePhotosBtn.innerHTML = 'Refreshing...';
            refreshCouplePhotosBtn.disabled = true;
            await fetchCouplePhotos(true);
            refreshCouplePhotosBtn.innerHTML = 'Refresh';
            refreshCouplePhotosBtn.disabled = false;
        });
    }

    // Category filtering logic for couple photos
    if (coupleCategoryFilters) {
        const chips = coupleCategoryFilters.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                chips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                currentCoupleFilter = e.currentTarget.getAttribute('data-filter');
                renderCouplePhotos();
            });
        });
    }

    // ==========================================
    // --- WiFi Sharing Logic ---
    // ==========================================
    const toggleWifiBtn = document.getElementById('toggleWifiBtn');
    const wifiStatusBadge = document.getElementById('wifiStatusBadge');
    const ftpServerIP = document.getElementById('ftpServerIP');
    const ftpServerPort = document.getElementById('ftpServerPort');
    const ftpUsername = document.getElementById('ftpUsername');
    const ftpPassword = document.getElementById('ftpPassword');
    const watchFolderInput = document.getElementById('watchFolderInput');
    const watchFolderEnabled = document.getElementById('watchFolderEnabled');
    const saveWifiSettingsBtn = document.getElementById('saveWifiSettingsBtn');
    const wifiHistoryTableBody = document.getElementById('wifiHistoryTableBody');
    const clearWifiHistoryBtn = document.getElementById('clearWifiHistoryBtn');
    const liveIndicator = document.getElementById('liveIndicator');

    let wifiPollingInterval = null;
    let isFtpRunning = false;

    async function fetchWifiStatus() {
        if (!wifiStatusBadge) return;
        try {
            const response = await fetch('/api/admin/wifi/status');
            const data = await response.json();
            
            // Update connection info
            if (ftpServerIP) ftpServerIP.textContent = data.local_ip;
            if (ftpServerPort) ftpServerPort.textContent = data.settings.ftp_port || '2121';
            if (ftpUsername) ftpUsername.textContent = data.settings.ftp_username || 'camera';
            if (ftpPassword) ftpPassword.textContent = data.settings.ftp_password || 'camera';
            
            // Update settings inputs if they are not active
            if (watchFolderInput && document.activeElement !== watchFolderInput) {
                watchFolderInput.value = data.settings.watch_folder || '';
            }
            if (watchFolderEnabled) {
                watchFolderEnabled.checked = data.settings.watcher_enabled || false;
            }
            
            isFtpRunning = data.ftp_running;
            
            // Update status badge & toggle button
            if (data.ftp_running || data.watcher_running) {
                wifiStatusBadge.textContent = 'Receiver Active';
                wifiStatusBadge.className = 'status-badge status-success';
                toggleWifiBtn.textContent = 'Stop Sharing';
                toggleWifiBtn.style.background = '#ef4444'; // Red for stop
                if (liveIndicator) liveIndicator.className = 'live-pulse';
            } else {
                wifiStatusBadge.textContent = 'Receiver Stopped';
                wifiStatusBadge.className = 'status-badge status-inactive';
                toggleWifiBtn.textContent = 'Start Sharing';
                toggleWifiBtn.style.background = 'var(--success)'; // Green for start
                if (liveIndicator) liveIndicator.className = '';
            }
        } catch (error) {
            console.error('Error fetching WiFi status:', error);
        }
    }

    async function fetchWifiHistory() {
        if (!wifiHistoryTableBody) return;
        try {
            const response = await fetch('/api/admin/wifi/history');
            const data = await response.json();
            
            if (data.status === 'success') {
                renderWifiHistory(data.history);
            }
        } catch (error) {
            console.error('Error fetching WiFi history:', error);
        }
    }

    function renderWifiHistory(history) {
        if (!wifiHistoryTableBody) return;
        wifiHistoryTableBody.innerHTML = '';
        
        if (history.length === 0) {
            wifiHistoryTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No camera uploads yet. Configure your camera and take a shot!</td></tr>';
            return;
        }
        
        history.forEach(item => {
            const tr = document.createElement('tr');
            
            let statusClass = 'status-warning';
            if (item.status === 'success') statusClass = 'status-success';
            if (item.status.startsWith('failed')) statusClass = 'status-inactive';
            
            const timeFormatted = new Date(item.timestamp).toLocaleTimeString();
            
            tr.innerHTML = `
                <td style="color: var(--text-light); font-weight: 500;">${item.filename}</td>
                <td style="color: var(--text-muted);">${item.method}</td>
                <td style="color: var(--text-muted);">${timeFormatted}</td>
                <td>
                    <span class="status-badge ${statusClass}">${item.status}</span>
                </td>
            `;
            wifiHistoryTableBody.appendChild(tr);
        });
    }

    if (toggleWifiBtn) {
        toggleWifiBtn.addEventListener('click', async () => {
            toggleWifiBtn.disabled = true;
            const action = isFtpRunning ? 'stop' : 'start';
            toggleWifiBtn.textContent = action === 'start' ? 'Starting...' : 'Stopping...';
            
            try {
                const res = await fetch('/api/admin/wifi/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });
                if (res.ok) {
                    await fetchWifiStatus();
                }
            } catch (err) {
                console.error('Failed to control wifi receiver', err);
            } finally {
                toggleWifiBtn.disabled = false;
            }
        });
    }

    if (saveWifiSettingsBtn) {
        saveWifiSettingsBtn.addEventListener('click', async () => {
            saveWifiSettingsBtn.disabled = true;
            saveWifiSettingsBtn.textContent = 'Saving...';
            
            const payload = {
                watcher_enabled: watchFolderEnabled ? watchFolderEnabled.checked : false,
                watch_folder: watchFolderInput ? watchFolderInput.value : ''
            };
            
            try {
                const res = await fetch('/api/admin/wifi/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    showCustomAlert('Settings saved successfully!');
                    await fetchWifiStatus();
                }
            } catch (err) {
                console.error('Failed to save settings', err);
                showCustomAlert('Failed to save settings');
            } finally {
                saveWifiSettingsBtn.disabled = false;
                saveWifiSettingsBtn.textContent = 'Save Settings';
            }
        });
    }

    if (clearWifiHistoryBtn) {
        clearWifiHistoryBtn.addEventListener('click', async () => {
            if (await showCustomConfirm('Are you sure you want to clear the camera transfer history?')) {
                try {
                    const res = await fetch('/api/admin/wifi/history/clear', { method: 'POST' });
                    if (res.ok) {
                        fetchWifiHistory();
                    }
                } catch (err) {
                    console.error('Failed to clear wifi history', err);
                }
            }
        });
    }

    // Start WiFi polling loop
    if (wifiStatusBadge) {
        fetchWifiStatus();
        fetchWifiHistory();
        wifiPollingInterval = setInterval(() => {
            fetchWifiStatus();
            fetchWifiHistory();
        }, 3000);
    }

    // Custom Category Dropdown UI Logic
    const categoryDropdown = document.getElementById('coupleCategoryDropdown');
    if (categoryDropdown) {
        const trigger = categoryDropdown.querySelector('.custom-dropdown-trigger');
        const selectedText = categoryDropdown.querySelector('.custom-dropdown-selected');
        const optionsList = categoryDropdown.querySelectorAll('.custom-dropdown-option');
        const hiddenSelect = document.getElementById('coupleCategorySelect');

        // Toggle open/close on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryDropdown.classList.toggle('active');
        });

        // Handle option click
        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.getAttribute('data-value');
                const label = opt.textContent.replace('✓', '').trim();
                
                // Update selected trigger label and active option class
                selectedText.textContent = label;
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');

                // Set value of native hidden select element & fire change event
                if (hiddenSelect) {
                    hiddenSelect.value = val;
                    hiddenSelect.dispatchEvent(new Event('change'));
                }

                // Close menu
                categoryDropdown.classList.remove('active');
            });
        });

        // Close dropdown when clicking outside anywhere on document
        document.addEventListener('click', () => {
            categoryDropdown.classList.remove('active');
        });
    }

    // ==========================================
    // --- Category Manager Logic ---
    // ==========================================
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    const categoryManagerModal = document.getElementById('categoryManagerModal');
    const closeCategoriesBtn = document.getElementById('closeCategoriesBtn');
    const categoriesList = document.getElementById('categoriesList');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const addCategoryBtn = document.getElementById('addCategoryBtn');

    let currentCoupleCategories = [];

    // Fetch categories and rebuild UI
    let lastCategoriesDataStr = '';
    async function fetchCategoriesAndRefresh(force = false) {
        try {
            const response = await fetch('/api/admin/categories');
            const data = await response.json();
            if (data.status === 'success') {
                const dataStr = JSON.stringify(data.categories);
                if (!force && dataStr === lastCategoriesDataStr) return; // Skip DOM update if no change
                lastCategoriesDataStr = dataStr;
                
                currentCoupleCategories = data.categories;
                
                // Re-render UI elements
                renderCategoriesModalList();
                renderCategoryFilters(data.categories);
                renderCategorySelector(data.categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    // Render category list inside the manager modal
    function renderCategoriesModalList() {
        if (!categoriesList) return;
        categoriesList.innerHTML = '';
        
        currentCoupleCategories.forEach(cat => {
            const li = document.createElement('li');
            li.className = 'category-item';
            li.innerHTML = `
                <span class="category-name">${cat}</span>
                <div class="category-actions">
                    <button class="btn-cat-action edit" data-category="${cat}">Edit</button>
                    <button class="btn-cat-action delete" data-category="${cat}">Delete</button>
                </div>
            `;
            
            // Edit/Rename category
            li.querySelector('.edit').addEventListener('click', async () => {
                const oldName = cat;
                const newName = prompt(`Rename category "${oldName}" to:`, oldName);
                if (newName && newName.trim() !== '' && newName !== oldName) {
                    try {
                        const res = await fetch('/api/admin/categories/edit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ old_name: oldName, new_name: newName.trim() })
                        });
                        if (res.ok) {
                            fetchCategoriesAndRefresh();
                            if (typeof fetchCouplePhotos === 'function') fetchCouplePhotos();
                        } else {
                            const errData = await res.json();
                            alert(errData.detail || 'Failed to rename category');
                        }
                    } catch (err) {
                        console.error('Error renaming category:', err);
                    }
                }
            });

            // Delete category
            li.querySelector('.delete').addEventListener('click', async () => {
                const targetCat = cat;
                if (await showCustomConfirm(`Are you sure you want to delete category "${targetCat}"? ALL photos inside it will also be deleted!`)) {
                    try {
                        const res = await fetch('/api/admin/categories/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ category: targetCat })
                        });
                        if (res.ok) {
                            fetchCategoriesAndRefresh();
                            if (typeof fetchCouplePhotos === 'function') fetchCouplePhotos();
                        } else {
                            alert('Failed to delete category');
                        }
                    } catch (err) {
                        console.error('Error deleting category:', err);
                    }
                }
            });
            
            categoriesList.appendChild(li);
        });
    }

    // Render filter chips in the tab layout
    function renderCategoryFilters(categories) {
        const container = document.getElementById('coupleCategoryFilters');
        if (!container) return;
        
        container.innerHTML = '';
        
        // "All" chip
        const allChip = document.createElement('button');
        allChip.className = `filter-chip ${currentCoupleFilter === 'all' ? 'active' : ''}`;
        allChip.setAttribute('data-filter', 'all');
        allChip.textContent = 'All';
        container.appendChild(allChip);
        
        // Dynamic chips
        categories.forEach(cat => {
            const chip = document.createElement('button');
            const normalized = cat.toLowerCase();
            chip.className = `filter-chip ${currentCoupleFilter === normalized ? 'active' : ''}`;
            chip.setAttribute('data-filter', normalized);
            chip.textContent = cat;
            container.appendChild(chip);
        });
        
        // Attach click listeners to all new chips
        const chips = container.querySelectorAll('.filter-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                chips.forEach(c => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
                currentCoupleFilter = e.currentTarget.getAttribute('data-filter');
                if (typeof fetchCouplePhotos === 'function') fetchCouplePhotos();
            });
        });
    }

    // Render options inside custom category selector dropdown
    function renderCategorySelector(categories) {
        const dropdownMenu = document.querySelector('#coupleCategoryDropdown .custom-dropdown-menu');
        const selectedText = document.querySelector('#coupleCategoryDropdown .custom-dropdown-selected');
        const hiddenSelect = document.getElementById('coupleCategorySelect');
        
        if (!dropdownMenu || !hiddenSelect) return;
        
        dropdownMenu.innerHTML = '';
        hiddenSelect.innerHTML = '';
        
        if (categories.length === 0) {
            if (selectedText) selectedText.textContent = 'No categories';
            return;
        }
        
        const defaultVal = categories[0].toLowerCase();
        const defaultLabel = categories[0];
        if (selectedText) selectedText.textContent = defaultLabel;
        
        categories.forEach((cat, index) => {
            const val = cat.toLowerCase();
            
            // Dropdown element
            const optDiv = document.createElement('div');
            optDiv.className = `custom-dropdown-option ${index === 0 ? 'active' : ''}`;
            optDiv.setAttribute('data-value', val);
            optDiv.textContent = cat;
            dropdownMenu.appendChild(optDiv);
            
            // Native option element
            const optTag = document.createElement('option');
            optTag.value = val;
            if (index === 0) optTag.selected = true;
            optTag.textContent = cat;
            hiddenSelect.appendChild(optTag);
        });
        
        // Re-attach dropdown click events
        const optionsList = dropdownMenu.querySelectorAll('.custom-dropdown-option');
        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = opt.getAttribute('data-value');
                const label = opt.textContent.replace('✓', '').trim();
                
                selectedText.textContent = label;
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                
                hiddenSelect.value = val;
                hiddenSelect.dispatchEvent(new Event('change'));
                
                const categoryDropdown = document.getElementById('coupleCategoryDropdown');
                if (categoryDropdown) categoryDropdown.classList.remove('active');
            });
        });
    }

    // Modal bindings
    if (manageCategoriesBtn && categoryManagerModal) {
        manageCategoriesBtn.addEventListener('click', () => {
            categoryManagerModal.classList.remove('hidden');
            fetchCategoriesAndRefresh(true);
        });
    }

    if (closeCategoriesBtn) {
        closeCategoriesBtn.addEventListener('click', () => {
            categoryManagerModal.classList.add('hidden');
        });
    }

    if (categoryManagerModal) {
        categoryManagerModal.addEventListener('click', (e) => {
            if (e.target === categoryManagerModal) {
                categoryManagerModal.classList.add('hidden');
            }
        });
    }

    // Add category handler
    if (addCategoryBtn && newCategoryInput) {
        addCategoryBtn.addEventListener('click', async () => {
            const name = newCategoryInput.value.trim();
            if (!name) return;
            
            try {
                const res = await fetch('/api/admin/categories/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category: name })
                });
                
                if (res.ok) {
                    newCategoryInput.value = '';
                    fetchCategoriesAndRefresh(true);
                } else {
                    const errData = await res.json();
                    alert(errData.detail || 'Failed to add category');
                }
            } catch (err) {
                console.error('Error adding category:', err);
            }
        });
    }

    // Load dynamic categories on start
    fetchCategoriesAndRefresh(true);

    // ==========================================
    // --- General Settings Logic ---
    // ==========================================
    const settingsForm = document.getElementById('settingsForm');
    const partner1Input = document.getElementById('partner1Input');
    const partner2Input = document.getElementById('partner2Input');

    async function fetchSettings() {
        try {
            const res = await fetch('/api/admin/couple-settings');
            const data = await res.json();
            if (data.status === 'success' && data.settings) {
                const coupleName = data.settings.couple_name || '';
                const separatorRegex = /\s*(?:&|\+)\s*|\s+and\s+/i;
                
                if (partner1Input && partner2Input) {
                    if (separatorRegex.test(coupleName)) {
                        const parts = coupleName.split(separatorRegex);
                        if (parts.length === 2) {
                            partner1Input.value = parts[0].trim();
                            partner2Input.value = parts[1].trim();
                        } else {
                            partner1Input.value = coupleName;
                            partner2Input.value = '';
                        }
                    } else {
                        partner1Input.value = coupleName;
                        partner2Input.value = '';
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!partner1Input || !partner2Input) return;
            
            const p1 = partner1Input.value.trim();
            const p2 = partner2Input.value.trim();
            if (!p1) return;

            const name = p2 ? `${p1} & ${p2}` : p1;

            try {
                const res = await fetch('/api/admin/couple-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ couple_name: name })
                });

                if (res.ok) {
                    showCustomAlert('Settings saved successfully!');
                    fetchSettings();
                } else {
                    const errData = await res.json();
                    showCustomAlert(errData.detail || 'Failed to save settings');
                }
            } catch (err) {
                console.error('Error saving settings:', err);
                showCustomAlert('Error saving settings');
            }
        });
    }

    // Load dynamic settings on start
    fetchSettings();

    // Start background live sync polling
    setInterval(() => {
        fetchRealData(false);
        fetchCouplePhotos(false);
        fetchCategoriesAndRefresh(false);
    }, 5000);

});


