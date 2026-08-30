// --- Admin Authentication & Session Guard ---
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        let [resource, config] = args;
        const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
        
        if (typeof resource === 'string' && resource.includes('/api/admin/') && !resource.includes('/api/admin/login')) {
            config = config || {};
            config.headers = config.headers || {};
            if (config.headers instanceof Headers) {
                if (token) config.headers.set('Authorization', `Bearer ${token}`);
            } else {
                if (token) config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        
        const response = await originalFetch(resource, config);
        
        if (typeof resource === 'string' && resource.includes('/api/admin/') && !resource.includes('/api/admin/login')) {
            if (response.status === 401 || response.status === 403) {
                sessionStorage.removeItem('admin_token');
                sessionStorage.removeItem('admin_user');
                localStorage.removeItem('admin_token');
                window.location.href = '/admin-login';
            }
        }
        
        return response;
    };

    // Intercept XMLHttpRequest for progress-based bulk uploads
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._url = url;
        return originalXHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._url && typeof this._url === 'string' && this._url.includes('/api/admin/') && !this._url.includes('/api/admin/login')) {
            const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
            if (token) {
                this.setRequestHeader('Authorization', `Bearer ${token}`);
            }
        }
        return originalXHRSend.apply(this, args);
    };
})();

async function verifyAdminSessionOnLoad() {
    const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/admin-login';
        return;
    }
    try {
        const res = await fetch('/api/admin/verify');
        if (!res.ok) {
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_user');
            localStorage.removeItem('admin_token');
            window.location.href = '/admin-login';
        }
    } catch (e) {
        console.error('Admin session verification error:', e);
    }
}
verifyAdminSessionOnLoad();

document.addEventListener('DOMContentLoaded', () => {
    // --- Brand Logo Button Navigation ---
    const brandLogoBtn = document.getElementById('brandLogoBtn');
    if (brandLogoBtn) {
        brandLogoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const dashTab = document.querySelector('.nav-item[data-tab="dashboard"]');
            if (dashTab) dashTab.click();
        });
    }

    // --- Logout Confirmation Modal Handlers ---
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (logoutBtn && logoutModal) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutModal.style.display = 'flex';
            logoutModal.classList.remove('hidden');
        });
    }

    if (cancelLogoutBtn && logoutModal) {
        cancelLogoutBtn.addEventListener('click', () => {
            logoutModal.style.display = 'none';
            logoutModal.classList.add('hidden');
        });
    }

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_user');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_refresh_token');
            localStorage.removeItem('admin_user');
            document.cookie = "admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.href = '/admin-login';
        });
    }

    const tableBody = document.getElementById('tableBody');
    const refreshBtn = document.getElementById('refreshBtn');

    // Tab Switching Logic
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
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

    // QR Code Modal Handler
    const qrGenBtn = document.getElementById('qrGenBtn');
    const qrModal = document.getElementById('qrModal');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');

    if (qrGenBtn) {
        qrGenBtn.addEventListener('click', () => {
            if (qrModal) qrModal.classList.remove('hidden');
        });
    }

    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => {
            if (qrModal) qrModal.classList.add('hidden');
        });
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Clear search fields on tab switch
            const globalSearchInput = document.getElementById('globalSearchInput');
            if (globalSearchInput) globalSearchInput.value = '';
            const tableSearchInput = document.getElementById('tableSearchInput');
            if (tableSearchInput) tableSearchInput.value = '';

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

    function showTableSkeleton(count = 5) {
        if (!tableBody) return;
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <tr class="table-skeleton-row">
                    <td><div class="skeleton-text-line" style="width: 60px;"></div></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div class="skeleton-avatar" style="width: 32px; height: 32px; border-radius: 4px;"></div>
                            <div class="skeleton-text-line" style="width: 120px;"></div>
                        </div>
                    </td>
                    <td><div class="skeleton-text-line" style="width: 70px;"></div></td>
                    <td><div class="skeleton-text-line" style="width: 65px; height: 20px; border-radius: 10px;"></div></td>
                    <td><div class="skeleton-text-line" style="width: 40px;"></div></td>
                </tr>
            `;
        }
        tableBody.innerHTML = html;
    }

    function showSkeletonGrid(containerId, count = 4, type = 'card') {
        const container = document.getElementById(containerId);
        if (!container) return;
        let html = '';
        for (let i = 0; i < count; i++) {
            if (type === 'user') {
                html += `<div class="skeleton-grid-card"><div class="skeleton-avatar"></div><div class="skeleton-text-line"></div><div class="skeleton-text-line" style="width:40%;"></div></div>`;
            } else {
                html += `<div class="skeleton-photo-card"></div>`;
            }
        }
        container.innerHTML = html;
    }

    let lastPhotosDataStr = '';
    let latestPhotosList = [];

    const tableSearchInput = document.getElementById('tableSearchInput');
    if (tableSearchInput) {
        tableSearchInput.addEventListener('input', () => {
            renderTable(latestPhotosList);
        });
    }

    const globalSearchInput = document.getElementById('globalSearchInput');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', () => {
            const activeTabEl = document.querySelector('.nav-item.active');
            if (!activeTabEl) return;
            const activeTabId = activeTabEl.getAttribute('data-tab');

            if (activeTabId === 'dashboard') {
                if (tableSearchInput) {
                    tableSearchInput.value = globalSearchInput.value;
                }
                renderTable(latestPhotosList);
            } else if (activeTabId === 'users') {
                renderUsersTab(currentUsersList);
            } else if (activeTabId === 'analysis-images') {
                renderImagesTab(currentPhotosList);
            } else if (activeTabId === 'couple-photos') {
                renderCouplePhotos();
            }
        });
    }

    async function fetchRealData(force = false) {
        // Display animated loading indicators while fetching
        const statImages = document.getElementById('statImages');
        const statUsers = document.getElementById('statUsers');
        const isInitialLoad = !lastPhotosDataStr;

        if (force || isInitialLoad) {
            if (statImages) statImages.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:16px; color:var(--secondary);"></i>';
            if (statUsers) statUsers.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:16px; color:var(--secondary);"></i>';
            showTableSkeleton(5);
            showSkeletonGrid('usersGrid', 4, 'user');
            showSkeletonGrid('imagesGrid', 6, 'photo');
        }

        try {
            const [photosRes, usersRes, sessionsRes] = await Promise.all([
                fetch(`/api/admin/photos`),
                fetch(`/api/admin/all-users`),
                fetch(`/api/admin/sessions/count`).catch(err => {
                    console.warn('Failed to fetch sessions count, fallback to 1', err);
                    return { json: () => Promise.resolve({ count: 1 }) };
                })
            ]);

            const photosData = await photosRes.json();
            const usersData = await usersRes.json();
            let sessionsCount = 1;
            try {
                const sessionsData = await sessionsRes.json();
                sessionsCount = sessionsData.count || 1;
            } catch (e) {}
            
            if (photosData.status === 'success') {
                const galleryPhotos = photosData.photos.filter(p => p.filename !== 'avatar.jpg' && !p.path.endsWith('/avatar.jpg'));
                const usersList = (usersData.status === 'success') ? usersData.users : [];
                
                const dataStr = JSON.stringify(galleryPhotos) + JSON.stringify(usersList) + sessionsCount;
                if (!force && dataStr === lastPhotosDataStr) return; // Skip DOM update if no change
                lastPhotosDataStr = dataStr;
                
                latestPhotosList = galleryPhotos;
                renderTable(galleryPhotos);
                renderImagesTab(galleryPhotos);
                renderUsersTab(usersList);
                updateStats(galleryPhotos, usersList, sessionsCount);
                updateActivityGraph(galleryPhotos);
                updateSystemHealth(galleryPhotos, usersList);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (force || isInitialLoad) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff6b6b; padding: 20px;">Failed to load data. Is the backend running?</td></tr>';
            }
        }

    }

    function renderTable(photos) {
        latestPhotosList = photos || [];
        tableBody.innerHTML = '';
        
        let filteredPhotos = latestPhotosList;
        if (tableSearchInput) {
            const searchVal = tableSearchInput.value.toLowerCase().trim();
            if (searchVal) {
                filteredPhotos = latestPhotosList.filter(p => p.filename.toLowerCase().includes(searchVal));
            }
        }
        
        const recentPhotos = filteredPhotos.slice(0, 10); // Show only recent 10 in dashboard
        
        recentPhotos.forEach((photo, index) => {
            const tr = document.createElement('tr');
            const timeStr = photo.created_at ? formatTimeAgo(photo.created_at) : 'Recent';
            
            tr.innerHTML = `
                <td style="font-family: monospace; color: var(--text-muted);">#IMG-${index+1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${photo.url}" alt="${photo.filename}" class="table-thumbnail" onclick="openLightbox('${photo.url}', '${photo.filename}')">
                        <span style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" onclick="openLightbox('${photo.url}', '${photo.filename}')">${photo.filename}</span>
                    </div>
                </td>
                <td style="color: var(--text-muted);">${timeStr}</td>
                <td>
                    <span class="status-pill status-pill-online" style="font-size: 0.75rem; padding: 4px 10px;">Analyzed</span>
                </td>
                <td>
                    <button class="row-action-btn" onclick="deletePhotoFromDashboard('${photo.path}', this)">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        
        if (recentPhotos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">No matching analyses found.</td></tr>';
        }
    }

    let visibleUsersCount = 16;
    let visibleImagesCount = 16;
    let currentUsersList = [];
    let currentPhotosList = [];

    const loadMoreUsersBtn = document.getElementById('loadMoreUsersBtn');
    if (loadMoreUsersBtn) {
        loadMoreUsersBtn.addEventListener('click', () => {
            visibleUsersCount += 16;
            renderUsersTab(currentUsersList);
        });
    }

    const loadMoreImagesBtn = document.getElementById('loadMoreImagesBtn');
    if (loadMoreImagesBtn) {
        loadMoreImagesBtn.addEventListener('click', () => {
            visibleImagesCount += 16;
            renderImagesTab(currentPhotosList);
        });
    }

    function renderImagesTab(photos) {
        const imagesGrid = document.getElementById('imagesGrid');
        if (!imagesGrid) return;
        currentPhotosList = photos || currentPhotosList || [];
        imagesGrid.innerHTML = '';
        
        let filteredPhotos = currentPhotosList;
        const globalSearchVal = document.getElementById('globalSearchInput')?.value.toLowerCase().trim() || '';
        if (globalSearchVal) {
            filteredPhotos = currentPhotosList.filter(photo => 
                (photo.filename && photo.filename.toLowerCase().includes(globalSearchVal))
            );
        }
        
        const visiblePhotos = filteredPhotos.slice(0, visibleImagesCount);
        
        visiblePhotos.forEach(photo => {
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

        if (loadMoreImagesBtn) {
            if (visibleImagesCount < currentPhotosList.length) {
                loadMoreImagesBtn.style.display = 'inline-block';
            } else {
                loadMoreImagesBtn.style.display = 'none';
            }
        }
    }

    function renderUsersTab(usersList) {
        const usersGrid = document.getElementById('usersGrid');
        if (!usersGrid) return;
        currentUsersList = usersList || currentUsersList || [];
        usersGrid.innerHTML = '';
        
        let filteredUsers = currentUsersList;
        const globalSearchVal = document.getElementById('globalSearchInput')?.value.toLowerCase().trim() || '';
        if (globalSearchVal) {
            filteredUsers = currentUsersList.filter(user => {
                const displayName = (user.display_name || 'Unnamed Guest').toLowerCase();
                const userId = (user.id || '').toLowerCase();
                return displayName.includes(globalSearchVal) || userId.includes(globalSearchVal);
            });
        }
        
        const visibleUsers = filteredUsers.slice(0, visibleUsersCount);
        
        visibleUsers.forEach(user => {
            const userName = user.id;
            const avatarSrc = user.avatar_url || `/gallery/${userName}/avatar.jpg`;
            const fallbackSrc = (user.photos && user.photos.length > 0) ? user.photos[0] : '';
            const displayName = user.display_name || '';
            const socials = user.social_profiles || {};
            
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
            
            const consentStatus = user.consent !== false;
            const consentBadge = consentStatus
                ? `<span style="font-size: 0.7rem; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 4px;"><i class="fa-solid fa-circle-check"></i> Consented</span>`
                : `<span style="font-size: 0.7rem; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-block; margin-top: 4px;"><i class="fa-solid fa-circle-xmark"></i> No Consent</span>`;

            const div = document.createElement('div');
            div.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; cursor: pointer;';
            div.addEventListener('click', () => {
                openUserPhotosModal(user);
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
                <img src="${avatarSrc}" class="img-animated" onload="this.classList.add('loaded')" onerror="this.onerror=null; this.src='${fallbackSrc}';" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 12px; border: 2px solid var(--primary-color);">
                <h3 style="margin: 0; font-size: 1.1rem; color: var(--text-light); word-break: break-all;">${displayName || 'Unnamed Guest'}</h3>
                ${displayName ? `<span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; display: block; margin-top: 2px;">(${userName})</span>` : `<span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; display: block; margin-top: 2px;">${userName}</span>`}
                <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 6px;">${user.photo_count} photo${user.photo_count === 1 ? '' : 's'}</span>
                <div style="margin-top: 2px;">${consentBadge}</div>
                ${socialHtml ? `<div class="user-card-social" style="margin-top: 8px; display: flex; gap: 6px; justify-content: center;">${socialHtml}</div>` : ''}
                <button class="btn-edit-profile" style="margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; font-size: 0.75rem; background: rgba(197, 168, 128, 0.12); border: 1px solid rgba(197, 168, 128, 0.25); border-radius: 6px; color: var(--color-primary, #C5A880); cursor: pointer; transition: all 0.2s ease;" title="Edit Profile">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; vertical-align: middle;">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Edit Profile
                </button>
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
            const editProfileBtn = div.querySelector('.btn-edit-profile');
            editProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openProfileModal(userName);
            });
            usersGrid.appendChild(div);
        });
        
        if (usersList.length === 0) {
            usersGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No recognized users found.</p>';
        }

        if (loadMoreUsersBtn) {
            if (visibleUsersCount < currentUsersList.length) {
                loadMoreUsersBtn.style.display = 'inline-block';
            } else {
                loadMoreUsersBtn.style.display = 'none';
            }
        }
    }

    // --- Profile Modal Logic ---
    const profileOverlay = document.getElementById('profileModalOverlay');
    const profileUserId = document.getElementById('profileUserId');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileInstagram = document.getElementById('profileInstagram');
    const profileFacebook = document.getElementById('profileFacebook');
    const profileLinkedin = document.getElementById('profileLinkedin');
    const profileConsent = document.getElementById('profileConsent');
    const profileCancelBtn = document.getElementById('profileCancelBtn');
    const profileSaveBtn = document.getElementById('profileSaveBtn');

    // Open profile modal
    window.openProfileModal = async function(userId) {
        if (!profileOverlay) return;
        profileUserId.value = userId;
        profileDisplayName.value = '';
        profileInstagram.value = '';
        profileFacebook.value = '';
        profileLinkedin.value = '';
        if (profileConsent) profileConsent.checked = true;

        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/users/profile/${encodeURIComponent(userId)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const profile = data.profile || {};
                profileDisplayName.value = profile.display_name || '';
                const socials = profile.social_profiles || {};
                profileInstagram.value = socials.instagram || '';
                profileFacebook.value = socials.facebook || '';
                profileLinkedin.value = socials.linkedin || '';
                if (profileConsent) {
                    profileConsent.checked = profile.consent !== false;
                }
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
        }

        profileOverlay.classList.add('active');
    };

    // Close profile modal
    function closeProfileModal() {
        if (profileOverlay) profileOverlay.classList.remove('active');
    }

    if (profileCancelBtn) profileCancelBtn.addEventListener('click', closeProfileModal);
    if (profileOverlay) {
        profileOverlay.addEventListener('click', function(e) {
            if (e.target === profileOverlay) closeProfileModal();
        });
    }

    // Save profile
    if (profileSaveBtn) {
        profileSaveBtn.addEventListener('click', async function() {
            const userId = profileUserId.value;
            if (!userId) return;

            profileSaveBtn.disabled = true;
            profileSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
                const res = await fetch('/api/admin/users/update-profile', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        display_name: profileDisplayName.value.trim(),
                        instagram: profileInstagram.value.trim(),
                        facebook: profileFacebook.value.trim(),
                        linkedin: profileLinkedin.value.trim(),
                        consent: profileConsent ? profileConsent.checked : true
                    })
                });

                if (res.ok) {
                    closeProfileModal();
                    // Reload users data
                    fetchRealData(true);
                } else {
                    const err = await res.json();
                    alert('Failed to save profile: ' + (err.detail || 'Unknown error'));
                }
            } catch (e) {
                console.error('Failed to save profile:', e);
                alert('Failed to save profile. Please try again.');
            } finally {
                profileSaveBtn.disabled = false;
                profileSaveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Profile';
            }
        });
    }


    function updateStats(photos, usersList, sessionsCount = 1) {
        const statImages = document.getElementById('statImages');
        if (statImages) statImages.textContent = photos.length;
        
        const statUsers = document.getElementById('statUsers');
        if (statUsers) statUsers.textContent = usersList ? usersList.length : 0;

        const statSessions = document.getElementById('statSessions');
        if (statSessions) statSessions.textContent = sessionsCount;
    }


    // Initial render
    fetchRealData(true);

    // Refresh button logic
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = '<i class="fa-solid fa-rotate fa-spin" style="margin-right: 6px;"></i> Refreshing...';
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

    function scoreImageFile(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const megapixels = (img.width * img.height) / 1000000;
                const sizeMB = file.size / (1024 * 1024);
                
                let score = 70;
                if (megapixels >= 2.0) score += 15;
                else if (megapixels >= 1.0) score += 10;
                else score += 5;

                if (sizeMB >= 0.5 && sizeMB <= 15.0) score += 14;
                else if (sizeMB > 0.1) score += 8;

                score = Math.min(99, Math.max(65, Math.round(score + (file.name.length % 5))));
                
                let label = 'High Res';
                let color = '#34d399'; // green
                if (score < 78) {
                    label = 'Low Res';
                    color = '#f87171'; // red
                } else if (score < 88) {
                    label = 'Good';
                    color = '#fbbf24'; // yellow
                }

                resolve({
                    width: img.width,
                    height: img.height,
                    score: score,
                    label: label,
                    color: color
                });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 0, height: 0, score: 75, label: 'Good', color: '#fbbf24' });
            };
            img.src = url;
        });
    }

    function handleFiles(files) {
        const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (newFiles.length === 0) return;

        selectedFiles = [...selectedFiles, ...newFiles];
        updatePreview();
    }

    async function updatePreview() {
        if (selectedFiles.length > 0) {
            bulkPreviewArea.classList.remove('hidden');
            startUploadBtn.disabled = false;
        } else {
            bulkPreviewArea.classList.add('hidden');
            startUploadBtn.disabled = true;
            return;
        }

        selectedFilesCount.textContent = `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''} selected • Auto-Scored ⚡`;
        previewGrid.innerHTML = '';

        for (let index = 0; index < selectedFiles.length; index++) {
            const file = selectedFiles[index];
            const scoreData = await scoreImageFile(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.id = `admin-preview-item-${index}`;
                div.innerHTML = `
                    <img src="${reader.result}" alt="preview">
                    <span class="preview-score-badge" style="background: ${scoreData.color}">${scoreData.score}% Score</span>
                    <button class="remove-item-btn" data-index="${index}">&times;</button>
                `;
                previewGrid.appendChild(div);
            };
        }

        // Auto-scroll down smoothly to preview grid and Start Upload button
        setTimeout(() => {
            if (bulkPreviewArea && !bulkPreviewArea.classList.contains('hidden')) {
                bulkPreviewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
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

    // Global upload state for background / cancel capabilities & concurrency pool
    let activeUploadXHRs = [];
    let isUploadCancelled = false;
    let isUploadRunningInBackground = false;

    function abortAllActiveUploads() {
        isUploadCancelled = true;
        activeUploadXHRs.forEach(xhr => {
            try { xhr.abort(); } catch (e) {}
        });
        activeUploadXHRs = [];
    }

    // Client-side image compression for ultra-fast uploads with safety timeout
    function compressImageForUpload(file, maxWidth = 1920, quality = 0.80) {
        if (!file || !file.type || !file.type.startsWith('image/') || file.size < 1024 * 1024) {
            return Promise.resolve(file);
        }
        return new Promise((resolve) => {
            let isResolved = false;
            const timer = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(file);
                }
            }, 1200);

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    if (isResolved) return;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (!isResolved) {
                            isResolved = true;
                            clearTimeout(timer);
                            if (blob && blob.size < file.size) {
                                resolve(new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                }));
                            } else {
                                resolve(file);
                            }
                        }
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => {
                    if (!isResolved) { isResolved = true; clearTimeout(timer); resolve(file); }
                };
            };
            reader.onerror = () => {
                if (!isResolved) { isResolved = true; clearTimeout(timer); resolve(file); }
            };
        });
    }

    function getOrCreateFloatingBadge() {
        let badge = document.getElementById('floating-upload-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'floating-upload-badge';
            badge.className = 'floating-upload-badge';
            badge.innerHTML = `
                <div class="floating-badge-spinner-container">
                    <svg class="floating-badge-svg" viewBox="0 0 36 36">
                        <defs>
                            <linearGradient id="floating-badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#C5A880" />
                                <stop offset="100%" stop-color="#fbbf24" />
                            </linearGradient>
                        </defs>
                        <circle class="floating-badge-circle-bg" cx="18" cy="18" r="14"></circle>
                        <circle class="floating-badge-circle-bar" id="floating-badge-progress-ring" cx="18" cy="18" r="14"></circle>
                    </svg>
                </div>
                <span class="floating-badge-text" id="floating-badge-text">Uploading...</span>
                <span class="floating-badge-expand">View Progress</span>
            `;
            document.body.appendChild(badge);
            badge.addEventListener('click', () => {
                isUploadRunningInBackground = false;
                badge.classList.remove('active');
                const overlay = document.getElementById('upload-loader-overlay');
                if (overlay) overlay.classList.add('active');
            });
        }
        return badge;
    }

    // Helper functions for dynamic Upload Progress Loading Screen
    function showUploadLoader(totalFiles) {
        isUploadCancelled = false;
        isUploadRunningInBackground = false;

        let overlay = document.getElementById('upload-loader-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'upload-loader-overlay';
            overlay.className = 'upload-loader-overlay';
            overlay.innerHTML = `
                <svg style="width:0;height:0;position:absolute;">
                    <defs>
                        <linearGradient id="loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#6366f1" />
                            <stop offset="50%" stop-color="#a855f7" />
                            <stop offset="100%" stop-color="#ec4899" />
                        </linearGradient>
                    </defs>
                </svg>
                <div class="upload-loader-card">
                    <div class="loader-spinner-container">
                        <svg class="loader-progress-circle" viewBox="0 0 100 100">
                            <circle class="loader-progress-circle-bg" cx="50" cy="50" r="42"></circle>
                            <circle class="loader-progress-circle-bar" id="loader-progress-ring" cx="50" cy="50" r="42"></circle>
                        </svg>
                        <div class="loader-spinner-percent" id="loader-spinner-percent">0%</div>
                    </div>
                    <div class="loader-info-group">
                        <div class="loader-text-title" id="loader-text-title">Uploading…</div>
                        <div class="loader-text-status" id="loader-text-status">Preparing photos…</div>
                        <div class="loader-speed-metrics" id="loader-speed-metrics">⚡ 0.0 MB/s  •  0/${totalFiles}</div>
                    </div>
                    <div class="loader-progress-container">
                        <div class="loader-progress-bar" id="loader-progress-bar"></div>
                    </div>
                    <div class="loader-actions-container">
                        <button class="loader-btn loader-btn-cancel" id="loader-btn-cancel">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            Cancel
                        </button>
                        <button class="loader-btn loader-btn-bg" id="loader-btn-bg">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            Run in Background
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('loader-btn-cancel').addEventListener('click', () => {
                abortAllActiveUploads();
                hideUploadLoader();
            });

            document.getElementById('loader-btn-bg').addEventListener('click', () => {
                isUploadRunningInBackground = true;
                overlay.classList.remove('active');
                const badge = getOrCreateFloatingBadge();
                badge.classList.add('active');
            });
        }
        
        document.getElementById('loader-text-title').innerText = 'Uploading…';
        document.getElementById('loader-text-status').innerText = `Preparing ${totalFiles} photos…`;
        document.getElementById('loader-progress-bar').style.width = '0%';
        document.getElementById('loader-spinner-percent').innerText = '0%';

        const ring = document.getElementById('loader-progress-ring');
        if (ring) ring.style.strokeDashoffset = '263.89';

        const floatingRing = document.getElementById('floating-badge-progress-ring');
        if (floatingRing) floatingRing.style.strokeDashoffset = '87.96';

        const metrics = document.getElementById('loader-speed-metrics');
        if (metrics) metrics.innerText = `⚡ 0.0 MB/s  •  0/${totalFiles}`;

        const badge = document.getElementById('floating-upload-badge');
        if (badge) badge.classList.remove('active');
        
        // Force reflow
        overlay.offsetHeight;
        overlay.classList.add('active');

        // Hide the bulk upload modals behind the progress popup
        const uploadModal = document.getElementById('uploadModal');
        if (uploadModal) uploadModal.classList.add('hidden');
        const coupleModal = document.getElementById('coupleUploadModal');
        if (coupleModal) coupleModal.classList.add('hidden');
    }

    function updateUploadLoader(completedCount, totalFiles, overallPercent = 0, speedMBs = 0) {
        const roundedPercent = Math.min(100, Math.max(0, Math.round(overallPercent)));
        const titleElement = document.getElementById('loader-text-title');
        const statusElement = document.getElementById('loader-text-status');
        const progressElement = document.getElementById('loader-progress-bar');
        const ringElement = document.getElementById('loader-progress-ring');
        const percentTextElement = document.getElementById('loader-spinner-percent');
        const metricsElement = document.getElementById('loader-speed-metrics');

        if (titleElement) titleElement.innerText = `Uploading…`;
        if (statusElement) {
            statusElement.innerText = roundedPercent === 100 
                ? `Finalizing ${totalFiles} photos…` 
                : `${completedCount} of ${totalFiles} photos uploaded`;
        }
        if (progressElement) progressElement.style.width = `${roundedPercent}%`;
        if (percentTextElement) percentTextElement.innerText = `${roundedPercent}%`;

        if (ringElement) {
            const circumference = 263.89;
            const offset = circumference - (roundedPercent / 100) * circumference;
            ringElement.style.strokeDashoffset = `${offset}`;
        }

        if (metricsElement) {
            metricsElement.innerText = `⚡ ${speedMBs.toFixed(1)} MB/s  •  ${completedCount}/${totalFiles}`;
        }

        // Update floating background badge ring & text
        const badgeText = document.getElementById('floating-badge-text');
        if (badgeText) {
            badgeText.innerText = `Uploading (${roundedPercent}%) • ${completedCount}/${totalFiles}`;
        }
        const floatingRing = document.getElementById('floating-badge-progress-ring');
        if (floatingRing) {
            const circumference = 87.96;
            const offset = circumference - (roundedPercent / 100) * circumference;
            floatingRing.style.strokeDashoffset = `${offset}`;
        }
    }

    function hideUploadLoader() {
        const overlay = document.getElementById('upload-loader-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        const badge = document.getElementById('floating-upload-badge');
        if (badge) {
            badge.classList.remove('active');
        }
    }

    function uploadFileWithProgress(file, category, onProgress) {
        return new Promise((resolve, reject) => {
            if (isUploadCancelled) {
                return reject(new Error('Cancelled'));
            }
            const xhr = new XMLHttpRequest();
            activeUploadXHRs.push(xhr);
            const url = category ? `/api/admin/couple-photos/upload` : `/api/admin/upload`;
            
            xhr.open('POST', url, true);
            xhr.timeout = 45000; // 45s safety timeout per photo upload request
            
            xhr.upload.onprogress = function(event) {
                if (isUploadCancelled) {
                    try { xhr.abort(); } catch (e) {}
                    return;
                }
                if (event.lengthComputable && onProgress) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress(percentComplete);
                }
            };

            const cleanupXHR = () => {
                const index = activeUploadXHRs.indexOf(xhr);
                if (index !== -1) activeUploadXHRs.splice(index, 1);
            };
            
            xhr.onload = function() {
                cleanupXHR();
                if (isUploadCancelled) {
                    reject(new Error('Cancelled'));
                } else if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(true);
                } else {
                    reject(new Error(`Server returned status ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                cleanupXHR();
                reject(new Error(isUploadCancelled ? 'Cancelled' : 'Network error'));
            };

            xhr.ontimeout = function() {
                cleanupXHR();
                reject(new Error('Upload request timed out after 45 seconds'));
            };

            xhr.onabort = function() {
                cleanupXHR();
                reject(new Error('Cancelled'));
            };
            
            const formData = new FormData();
            formData.append('file', file);
            if (category) {
                formData.append('category', category);
            }
            
            xhr.send(formData);
        });
    }

    // High-speed parallel concurrent upload worker queue
    async function processBatchUploadConcurrent(files, category, previewPrefix) {
        const CONCURRENCY_LIMIT = 4;
        const totalFiles = files.length;
        let completedCount = 0;
        let successCount = 0;
        const failedFiles = [];
        const cancelledFiles = [];

        const fileLoadedBytes = new Array(totalFiles).fill(0);
        const fileTotalBytes = files.map(f => f.size);
        const totalBatchBytes = fileTotalBytes.reduce((a, b) => a + b, 0) || 1;
        const startTime = Date.now();

        function calcAndSendProgress() {
            const currentLoaded = fileLoadedBytes.reduce((a, b) => a + b, 0);
            const overallPercent = Math.min(100, (currentLoaded / totalBatchBytes) * 100);
            const elapsedSec = (Date.now() - startTime) / 1000;
            const speedMBs = elapsedSec > 0 ? (currentLoaded / (1024 * 1024)) / elapsedSec : 0;
            updateUploadLoader(completedCount, totalFiles, overallPercent, speedMBs);
        }

        let nextFileIndex = 0;

        async function worker() {
            while (nextFileIndex < totalFiles) {
                if (isUploadCancelled) break;
                const i = nextFileIndex++;
                const rawFile = files[i];
                const itemEl = document.getElementById(`${previewPrefix}-item-${i}`);

                if (itemEl) {
                    itemEl.className = 'preview-item uploading';
                    let b = itemEl.querySelector('.preview-status-badge');
                    if (!b) { b = document.createElement('span'); itemEl.appendChild(b); }
                    b.className = 'preview-status-badge uploading';
                    b.innerText = '⚡ Uploading';
                }

                try {
                    // Pre-compress file for 10x-15x faster network transmission
                    const fileToUpload = await compressImageForUpload(rawFile);
                    fileTotalBytes[i] = fileToUpload.size;

                    if (isUploadCancelled) {
                        cancelledFiles.push(rawFile);
                        if (itemEl) {
                            itemEl.className = 'preview-item upload-failed';
                            let b = itemEl.querySelector('.preview-status-badge');
                            if (!b) { b = document.createElement('span'); itemEl.appendChild(b); }
                            b.className = 'preview-status-badge failed';
                            b.innerText = '🚫 Cancelled';
                        }
                        break;
                    }

                    await uploadFileWithProgress(fileToUpload, category, (percent) => {
                        fileLoadedBytes[i] = (percent / 100) * fileToUpload.size;
                        calcAndSendProgress();
                    });

                    if (!isUploadCancelled) {
                        successCount++;
                        completedCount++;
                        fileLoadedBytes[i] = fileToUpload.size;
                        calcAndSendProgress();
                        if (itemEl) {
                            itemEl.className = 'preview-item upload-success';
                            let b = itemEl.querySelector('.preview-status-badge');
                            if (b) { b.className = 'preview-status-badge success'; b.innerText = '✓ Success'; }
                        }
                    } else {
                        cancelledFiles.push(rawFile);
                        if (itemEl) {
                            itemEl.className = 'preview-item upload-failed';
                            let b = itemEl.querySelector('.preview-status-badge');
                            if (!b) { b = document.createElement('span'); itemEl.appendChild(b); }
                            b.className = 'preview-status-badge failed';
                            b.innerText = '🚫 Cancelled';
                        }
                    }
                } catch (error) {
                    completedCount++;
                    if (isUploadCancelled || error.message === 'Cancelled') {
                        cancelledFiles.push(rawFile);
                        if (itemEl) {
                            itemEl.className = 'preview-item upload-failed';
                            let b = itemEl.querySelector('.preview-status-badge');
                            if (!b) { b = document.createElement('span'); itemEl.appendChild(b); }
                            b.className = 'preview-status-badge failed';
                            b.innerText = '🚫 Cancelled';
                        }
                    } else {
                        const reason = error.message || 'Server Error';
                        failedFiles.push({ file: rawFile, index: i, errorReason: reason });
                        fileLoadedBytes[i] = fileTotalBytes[i];
                        calcAndSendProgress();
                        if (itemEl) {
                            itemEl.className = 'preview-item upload-failed';
                            let b = itemEl.querySelector('.preview-status-badge');
                            if (!b) { b = document.createElement('span'); itemEl.appendChild(b); }
                            b.className = 'preview-status-badge failed';
                            b.innerText = '✗ Failed';
                        }
                    }
                }
            }
        }

        const workers = [];
        const numWorkers = Math.min(CONCURRENCY_LIMIT, totalFiles);
        for (let w = 0; w < numWorkers; w++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        return { successCount, failedFiles, cancelledFiles };
    }

    function showUploadSummaryModal(successCount, failedFiles, onRetry) {
        const existing = document.getElementById('upload-summary-overlay');
        if (existing) document.body.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'upload-summary-overlay';
        overlay.className = 'upload-loader-overlay active';
        overlay.style.zIndex = '9999';

        let failedCardsHTML = '';
        failedFiles.forEach((item) => {
            const sizeMB = (item.file.size / (1024 * 1024)).toFixed(2);
            const objectUrl = URL.createObjectURL(item.file);
            failedCardsHTML += `
                <div style="display: flex; align-items: center; gap: 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 10px; text-align: left;">
                    <img src="${objectUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(239, 68, 68, 0.4);">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.88rem; font-weight: 600; color: #f87171; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.file.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${sizeMB} MB • <span style="color: #ef4444; font-weight: 600;">Reason: ${item.errorReason}</span></div>
                    </div>
                </div>
            `;
        });

        overlay.innerHTML = `
            <div class="upload-loader-card" style="max-width: 520px; text-align: left; align-items: stretch; gap: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-main); margin: 0;">Upload Results Summary</h3>
                    <span style="font-size: 0.8rem; font-weight: 700; background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 10px; border-radius: 20px;">${failedFiles.length} Failed</span>
                </div>

                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 1.3rem; font-weight: 800; color: #22c55e;">${successCount}</div>
                        <div style="font-size: 0.75rem; color: #86efac; font-weight: 600;">✓ Succeeded</div>
                    </div>
                    <div style="flex: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 1.3rem; font-weight: 800; color: #ef4444;">${failedFiles.length}</div>
                        <div style="font-size: 0.75rem; color: #fca5a5; font-weight: 600;">✗ Failed</div>
                    </div>
                </div>

                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-top: 4px;">Failed Photos Breakdown:</div>
                <div style="max-height: 220px; overflow-y: auto; padding-right: 4px;">
                    ${failedCardsHTML}
                </div>

                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button id="summary-retry-btn" class="loader-btn loader-btn-bg" style="flex: 1; padding: 12px;">🔄 Retry Failed (${failedFiles.length})</button>
                    <button id="summary-done-btn" class="loader-btn loader-btn-cancel" style="background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.15); flex: 1; padding: 12px;">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('summary-done-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            closeModal();
            closeCoupleModal();
            fetchRealData();
            fetchCouplePhotos(true);
        });

        document.getElementById('summary-retry-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            const retryList = failedFiles.map(item => item.file);
            if (onRetry) onRetry(retryList);
        });
    }

    function showUploadCancelledModal(successCount, cancelledFiles, onResume) {
        const existing = document.getElementById('upload-cancelled-overlay');
        if (existing) document.body.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'upload-cancelled-overlay';
        overlay.className = 'upload-loader-overlay active';
        overlay.style.zIndex = '9999';

        let cancelledCardsHTML = '';
        cancelledFiles.forEach((file) => {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const objectUrl = URL.createObjectURL(file);
            cancelledCardsHTML += `
                <div style="display: flex; align-items: center; gap: 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 14px; padding: 12px 16px; margin-bottom: 10px; text-align: left;">
                    <img src="${objectUrl}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(239, 68, 68, 0.4);">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.88rem; font-weight: 600; color: #f87171; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${sizeMB} MB • <span style="color: #ef4444; font-weight: 600;">Status: Cancelled</span></div>
                    </div>
                </div>
            `;
        });

        overlay.innerHTML = `
            <div class="upload-loader-card" style="max-width: 520px; text-align: left; align-items: stretch; gap: 18px; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.25);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ef4444; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem;">✕</div>
                        <h3 style="font-size: 1.2rem; font-weight: 700; color: #f87171; margin: 0;">Upload Cancelled</h3>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 700; background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 4px 10px; border-radius: 20px;">${cancelledFiles.length} Cancelled</span>
                </div>

                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 1.3rem; font-weight: 800; color: #22c55e;">${successCount}</div>
                        <div style="font-size: 0.75rem; color: #86efac; font-weight: 600;">✓ Uploaded</div>
                    </div>
                    <div style="flex: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 1.3rem; font-weight: 800; color: #ef4444;">${cancelledFiles.length}</div>
                        <div style="font-size: 0.75rem; color: #fca5a5; font-weight: 600;">🚫 Cancelled</div>
                    </div>
                </div>

                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-top: 4px;">Preview of Cancelled Photos (${cancelledFiles.length}):</div>
                <div style="max-height: 220px; overflow-y: auto; padding-right: 4px;">
                    ${cancelledCardsHTML}
                </div>

                <div style="display: flex; gap: 12px; margin-top: 10px;">
                    <button id="cancelled-resume-btn" class="loader-btn loader-btn-bg" style="flex: 1; padding: 12px; background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">⚡ Upload Cancelled (${cancelledFiles.length})</button>
                    <button id="cancelled-done-btn" class="loader-btn loader-btn-cancel" style="background: rgba(255,255,255,0.08); color: var(--text-main); border: 1px solid rgba(255,255,255,0.15); flex: 1; padding: 12px;">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('cancelled-done-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            closeModal();
            closeCoupleModal();
            fetchRealData();
            fetchCouplePhotos(true);
        });

        document.getElementById('cancelled-resume-btn').addEventListener('click', () => {
            document.body.removeChild(overlay);
            if (onResume) onResume(cancelledFiles);
        });
    }

    // Real upload process (High-speed concurrent parallel queue + compression)
    startUploadBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;
        
        startUploadBtn.innerHTML = 'Uploading...';
        startUploadBtn.disabled = true;
        cancelUploadBtn.disabled = true;
        clearFilesBtn.disabled = true;

        showUploadLoader(selectedFiles.length);

        const { successCount, failedFiles, cancelledFiles } = await processBatchUploadConcurrent(
            selectedFiles,
            null,
            'admin-preview'
        );

        hideUploadLoader();

        if (isUploadCancelled || cancelledFiles.length > 0) {
            showUploadCancelledModal(successCount, cancelledFiles, async (filesToResume) => {
                selectedFiles = filesToResume;
                updatePreview();
                startUploadBtn.click();
            });
        } else if (failedFiles.length > 0) {
            showUploadSummaryModal(successCount, failedFiles, async (filesToRetry) => {
                selectedFiles = filesToRetry;
                updatePreview();
                startUploadBtn.click();
            });
        } else {
            showCustomAlert(`🎉 Upload complete! All ${successCount} photos uploaded & face-indexed successfully.`);
            closeModal();
            fetchRealData();
        }

        startUploadBtn.innerHTML = 'Start Upload';
        startUploadBtn.disabled = false;
        cancelUploadBtn.disabled = false;
        clearFilesBtn.disabled = false;
    });

    function showCustomAlert(message, isError = false) {
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
        content.style.background = isError ? 'linear-gradient(160deg, rgba(45, 20, 25, 0.95), rgba(28, 15, 20, 0.95))' : 'linear-gradient(160deg, rgba(35, 35, 45, 0.95), rgba(20, 20, 28, 0.95))';
        content.style.border = isError ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)';
        content.style.boxShadow = isError ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.3)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(127, 112, 245, 0.15)';
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
        iconWrapper.style.background = isError ? '#ef4444' : 'var(--primary)';
        iconWrapper.style.display = 'flex';
        iconWrapper.style.justifyContent = 'center';
        iconWrapper.style.alignItems = 'center';
        iconWrapper.style.margin = '0 auto 24px';
        iconWrapper.style.boxShadow = isError ? '0 10px 25px rgba(239, 68, 68, 0.5)' : '0 10px 25px rgba(26, 54, 93, 0.4)';
        
        const checkIcon = document.createElement('span');
        checkIcon.innerHTML = isError ? '✕' : '✓';
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

    function openUserPhotosModal(userObjOrName, allPhotos = []) {
        if (!userPhotosModal || !userPhotosGrid) return;
        
        const userName = (typeof userObjOrName === 'object' && userObjOrName !== null) ? userObjOrName.id : userObjOrName;
        userPhotosModalTitle.textContent = `${userName}'s Photos`;
        userPhotosGrid.innerHTML = '';
        
        let userPhotos = [];
        if (typeof userObjOrName === 'object' && userObjOrName !== null && Array.isArray(userObjOrName.photos)) {
            userPhotos = userObjOrName.photos.map(u => {
                const fname = u.split('/').pop();
                return {
                    url: u,
                    filename: fname,
                    path: u.replace('/gallery/', '')
                };
            }).filter(p => p.filename !== 'avatar.jpg');
        } else if (Array.isArray(allPhotos)) {
            userPhotos = allPhotos.filter(photo => {
                const parts = photo.path.split('/');
                return parts.length > 1 && parts[0] === userName && photo.filename !== 'avatar.jpg' && !photo.path.endsWith('/avatar.jpg');
            });
        }


        
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
    const deleteAllDuplicatesBtn = document.getElementById('deleteAllDuplicatesBtn');
    const duplicatesSummaryText = document.getElementById('duplicatesSummaryText');

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

    if (deleteAllDuplicatesBtn) {
        deleteAllDuplicatesBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete ALL duplicate photos? The 1 original copy of each photo will be safely kept.')) {
                deleteAllDuplicatesBtn.disabled = true;
                const originalText = deleteAllDuplicatesBtn.innerHTML;
                deleteAllDuplicatesBtn.innerHTML = 'Deleting...';

                try {
                    const res = await fetch('/api/admin/photos/delete-duplicates-bulk', {
                        method: 'POST'
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        showCustomAlert(data.message || `Successfully deleted ${data.deleted_count} duplicates.`);
                        if (typeof fetchRealData === 'function') fetchRealData();
                        if (findDuplicatesBtn) findDuplicatesBtn.click();
                    } else {
                        showCustomAlert('Failed to delete duplicates: ' + (data.detail || 'Unknown error'));
                    }
                } catch (err) {
                    console.error('Error executing bulk delete:', err);
                    showCustomAlert('Error deleting duplicate photos.');
                } finally {
                    deleteAllDuplicatesBtn.disabled = false;
                    deleteAllDuplicatesBtn.innerHTML = originalText;
                }
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
                    const totalDups = data.total_duplicates_count !== undefined ? data.total_duplicates_count : data.duplicates.length;

                    if (duplicatesSummaryText) {
                        if (totalDups === 0) {
                            duplicatesSummaryText.textContent = 'No duplicate photos found in gallery.';
                        } else {
                            const groupCount = data.groups ? data.groups.length : 1;
                            duplicatesSummaryText.textContent = `Found ${totalDups} duplicate copy/copies across ${groupCount} unique photo set(s).`;
                        }
                    }

                    if (deleteAllDuplicatesBtn) {
                        deleteAllDuplicatesBtn.style.display = totalDups > 0 ? 'inline-flex' : 'none';
                    }

                    if (totalDups === 0) {
                        duplicatesList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 30px; font-size: 1rem;">No exact duplicate photos found in gallery.</p>';
                    } else {
                        const groups = data.groups || [];
                        if (groups.length > 0) {
                            groups.forEach((group, index) => {
                                const groupDiv = document.createElement('div');
                                groupDiv.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
                                
                                const headerHtml = `
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
                                        <span style="font-weight: 700; color: var(--color-accent, #6366f1); font-size: 1rem;">Photo Set #${index + 1} (${group.total_copies} total copies found)</span>
                                        <span style="font-size: 0.8rem; background: rgba(239,68,68,0.15); color: #ef4444; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(239,68,68,0.3); font-weight: 600;">${group.duplicates.length} duplicate copy/copies to delete</span>
                                    </div>
                                `;

                                let cardsHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;">`;

                                // Original photo card
                                cardsHtml += `
                                    <div style="background: rgba(16, 185, 129, 0.08); border: 2px solid #10b981; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; position: relative;">
                                        <span style="font-weight: 700; color: #10b981; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Original (Kept Safe)</span>
                                        <img src="${group.original.url}" style="width: 100%; height: 130px; object-fit: cover; border-radius: 6px;">
                                        <span style="font-size: 0.75rem; color: var(--text-light); word-break: break-all;" title="${group.original.filename}">${group.original.filename}</span>
                                    </div>
                                `;

                                // Duplicate photos cards
                                group.duplicates.forEach((dup, dupIdx) => {
                                    cardsHtml += `
                                        <div style="background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px dashed var(--border-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                                            <span style="font-weight: 600; color: #ef4444; font-size: 0.8rem;">Duplicate Copy #${dupIdx + 1}</span>
                                            <img src="${dup.url}" style="width: 100%; height: 130px; object-fit: cover; border-radius: 6px;">
                                            <span style="font-size: 0.75rem; color: var(--text-light); word-break: break-all;" title="${dup.filename}">${dup.filename}</span>
                                            <button class="btn-primary delete-dup-btn" data-path="${dup.path}" style="padding: 6px 10px; font-size: 0.75rem; background: #ef4444; border-color: #dc2626; border-radius: 6px; cursor: pointer; margin-top: auto;">Delete This Copy</button>
                                        </div>
                                    `;
                                });

                                cardsHtml += `</div>`;
                                groupDiv.innerHTML = headerHtml + cardsHtml;

                                // Add event listeners for individual delete buttons
                                const deleteBtns = groupDiv.querySelectorAll('.delete-dup-btn');
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
                                                    if (typeof fetchRealData === 'function') fetchRealData();
                                                    findDuplicatesBtn.click();
                                                }
                                            } catch (err) {
                                                console.error('Failed to delete duplicate', err);
                                            }
                                        }
                                    });
                                });

                                duplicatesList.appendChild(groupDiv);
                            });
                        } else {
                            // Fallback for legacy pair format
                            data.duplicates.forEach((pair) => {
                                const pairDiv = document.createElement('div');
                                pairDiv.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 20px; padding: 16px; display: flex; gap: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap;';
                                
                                const renderPhoto = (photo, label, isDup = false) => {
                                    return `
                                        <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 8px;">
                                            <span style="font-weight: bold; color: ${isDup ? '#ef4444' : '#10b981'}; font-size: 0.9rem;">${label}</span>
                                            <img src="${photo.url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;">
                                            <span style="font-size: 0.8rem; color: var(--text-light); word-break: break-all;">${photo.filename}</span>
                                            ${isDup ? `<button class="btn-primary delete-dup-btn" data-path="${photo.path}" style="padding: 6px 12px; font-size: 0.8rem; background: #ef4444;">Delete This Copy</button>` : ''}
                                        </div>
                                    `;
                                };

                                pairDiv.innerHTML = renderPhoto(pair.original, 'Original (Kept first)', false) + 
                                                  '<div style="font-size: 1.5rem; color: var(--text-muted);">&rarr;</div>' + 
                                                  renderPhoto(pair.duplicate, 'Exact Duplicate', true);

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
                                                    if (typeof fetchRealData === 'function') fetchRealData();
                                                    findDuplicatesBtn.click();
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
                    }
                    duplicatesModal.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error finding duplicates:', error);
                if (typeof showCustomAlert === 'function') showCustomAlert('Error finding duplicates. Check console.');
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
        if (force && typeof showSkeletonGrid === 'function') {
            showSkeletonGrid('couplePhotosGrid', 6, 'photo');
        }
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
        
        let filteredPhotos = currentCoupleFilter === 'all'
            ? couplePhotosData
            : couplePhotosData.filter(p => p.category === currentCoupleFilter);

        const globalSearchVal = document.getElementById('globalSearchInput')?.value.toLowerCase().trim() || '';
        if (globalSearchVal) {
            filteredPhotos = filteredPhotos.filter(photo => 
                (photo.filename && photo.filename.toLowerCase().includes(globalSearchVal))
            );
        }

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

    async function updateCouplePreview() {
        if (!couplePreviewArea || !startCoupleUploadBtn) return;
        if (selectedCoupleFiles.length > 0) {
            couplePreviewArea.classList.remove('hidden');
            startCoupleUploadBtn.disabled = false;
        } else {
            couplePreviewArea.classList.add('hidden');
            startCoupleUploadBtn.disabled = true;
            return;
        }

        if (coupleSelectedCount) {
            coupleSelectedCount.textContent = `${selectedCoupleFiles.length} file${selectedCoupleFiles.length !== 1 ? 's' : ''} selected • Auto-Scored ⚡`;
        }
        if (couplePreviewGrid) {
            couplePreviewGrid.innerHTML = '';
            for (let index = 0; index < selectedCoupleFiles.length; index++) {
                const file = selectedCoupleFiles[index];
                const scoreData = await scoreImageFile(file);
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => {
                    const div = document.createElement('div');
                    div.className = 'preview-item';
                    div.id = `couple-preview-item-${index}`;
                    div.innerHTML = `
                        <img src="${reader.result}" alt="preview">
                        <span class="preview-score-badge" style="background: ${scoreData.color}">${scoreData.score}% Score</span>
                        <button class="remove-item-btn" data-index="${index}">&times;</button>
                    `;
                    couplePreviewGrid.appendChild(div);
                };
            }

            // Auto-scroll down smoothly to couple preview grid and Start Upload button
            setTimeout(() => {
                if (couplePreviewArea && !couplePreviewArea.classList.contains('hidden')) {
                    couplePreviewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 150);
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

            showUploadLoader(selectedCoupleFiles.length);

            const category = coupleCategorySelect ? coupleCategorySelect.value : 'ceremony';

            const { successCount, failedFiles, cancelledFiles } = await processBatchUploadConcurrent(
                selectedCoupleFiles,
                category,
                'couple-preview'
            );

            hideUploadLoader();

            if (isUploadCancelled || cancelledFiles.length > 0) {
                showUploadCancelledModal(successCount, cancelledFiles, async (filesToResume) => {
                    selectedCoupleFiles = filesToResume;
                    updateCouplePreview();
                    startCoupleUploadBtn.click();
                });
            } else if (failedFiles.length > 0) {
                showUploadSummaryModal(successCount, failedFiles, async (filesToRetry) => {
                    selectedCoupleFiles = filesToRetry;
                    updateCouplePreview();
                    startCoupleUploadBtn.click();
                });
            } else {
                showCustomAlert(`🎉 Upload complete! All ${successCount} couple photos uploaded successfully.`);
                closeCoupleModal();
                fetchCouplePhotos(true);
            }

            startCoupleUploadBtn.innerHTML = 'Start Upload';
            startCoupleUploadBtn.disabled = false;
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
                if (typeof renderCouplePhotos === 'function') renderCouplePhotos();
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
    const siteTitlePreview = document.getElementById('siteTitlePreview');

    function updateSiteTitlePreview() {
        if (!siteTitlePreview) return;
        const p1 = partner1Input ? partner1Input.value.trim() : '';
        const p2 = partner2Input ? partner2Input.value.trim() : '';
        if (p1 && p2) {
            siteTitlePreview.textContent = `${p1} & ${p2}`;
        } else if (p1) {
            siteTitlePreview.textContent = p1;
        } else if (p2) {
            siteTitlePreview.textContent = p2;
        } else {
            siteTitlePreview.textContent = "Bride & Groom";
        }
    }

    if (partner1Input) partner1Input.addEventListener('input', updateSiteTitlePreview);
    if (partner2Input) partner2Input.addEventListener('input', updateSiteTitlePreview);

    async function fetchSettings() {
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch('/api/admin/couple-settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
                    updateSiteTitlePreview();
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

            const saveBtn = document.getElementById('saveSettingsBtn') || settingsForm.querySelector('button[type="submit"]');
            let originalText = '';
            if (saveBtn) {
                originalText = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="spinner-ring"></span><span>Saving...</span>`;
            }

            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
                const res = await fetch('/api/admin/couple-settings', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            }
        });
    }

    // ==========================================
    // --- Storage settings & Migration Logic ---
    // ==========================================
    const activeStorageMode = document.getElementById('activeStorageMode');
    const startMigrationBtn = document.getElementById('startMigrationBtn');

    async function fetchStorageStatus() {
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch('/api/admin/storage/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (activeStorageMode) {
                activeStorageMode.textContent = data.storage_mode.toUpperCase();
                if (data.storage_mode === 'supabase') {
                    activeStorageMode.className = 'status-pill status-pill-supabase';
                } else {
                    activeStorageMode.className = 'status-pill status-pill-local';
                }
                activeStorageMode.style.color = ''; // Clear inline styles
            }
            if (startMigrationBtn) {
                if (!data.supabase_configured) {
                    startMigrationBtn.disabled = true;
                    startMigrationBtn.title = "Configure Supabase in your environment first.";
                    startMigrationBtn.style.opacity = '0.5';
                    startMigrationBtn.style.cursor = 'not-allowed';
                } else {
                    startMigrationBtn.disabled = false;
                    startMigrationBtn.style.opacity = '1';
                    startMigrationBtn.style.cursor = 'pointer';
                }
            }
            // Update Cloudflare Tunnel Link card
            const cloudflareUrlCard = document.getElementById('cloudflareUrlCard');
            const statCloudflareUrl = document.getElementById('statCloudflareUrl');
            if (cloudflareUrlCard && statCloudflareUrl) {
                if (data.cloudflare_url) {
                    cloudflareUrlCard.style.display = 'flex';
                    const fullUrl = data.cloudflare_url.endsWith('/') 
                        ? `${data.cloudflare_url}find-my-photos` 
                        : `${data.cloudflare_url}/find-my-photos`;
                    statCloudflareUrl.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                            <a href="${fullUrl}" target="_blank" style="color: var(--secondary); text-decoration: none; font-weight: 700; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 6px; width: fit-content;" title="Visit Public Site">
                                Visit Live Site 
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="7" y1="17" x2="17" y2="7"></line>
                                    <polyline points="7 7 17 7 17 17"></polyline>
                                </svg>
                            </a>
                            <button onclick="copyTunnelUrl('${fullUrl}', this)" style="background: rgba(20, 184, 166, 0.08); border: 1px solid rgba(20, 184, 166, 0.18); color: var(--secondary); padding: 5px 10px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; width: fit-content; transition: all 0.2s; font-weight: 600;">
                                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                <span>Copy Link</span>
                            </button>
                        </div>
                    `;
                } else {
                    cloudflareUrlCard.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Error fetching storage status:', err);
        }
    }

    if (startMigrationBtn) {
        startMigrationBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to copy all local gallery photos and database metadata to Supabase? This run is non-destructive (local files remain on disk).")) {
                return;
            }
            
            const originalHTML = startMigrationBtn.innerHTML;
            startMigrationBtn.disabled = true;
            startMigrationBtn.innerHTML = `<span class="spinner-ring"></span><span>Migrating...</span>`;
            
            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
                const res = await fetch('/api/admin/storage/migrate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    showCustomAlert('Migration started in backend successfully! Check backend console/logs for progress.');
                } else {
                    showCustomAlert(data.detail || 'Migration failed to start.');
                }
            } catch (err) {
                console.error('Migration error:', err);
                showCustomAlert('Error starting migration.');
            } finally {
                startMigrationBtn.disabled = false;
                startMigrationBtn.innerHTML = originalHTML;
                fetchStorageStatus();
            }
        });
    }

    // ==========================================
    // --- Cloudflare Tunnel Management Logic ---
    // ==========================================
    const tunnelStatusText = document.getElementById('tunnelStatusText');
    const tunnelStatusBadge = document.getElementById('tunnelStatusBadge');
    const tunnelUrlContainer = document.getElementById('tunnelUrlContainer');
    const tunnelUrlVal = document.getElementById('tunnelUrlVal');
    const toggleTunnelBtn = document.getElementById('toggleTunnelBtn');

    async function fetchTunnelStatus() {
        try {
            const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
            const res = await fetch('/api/admin/tunnel/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const cloudflareUrlCard = document.getElementById('cloudflareUrlCard');
            const statCloudflareUrl = document.getElementById('statCloudflareUrl');
            
            if (tunnelStatusText && toggleTunnelBtn) {
                if (data.status === 'online') {
                    tunnelStatusText.textContent = 'ONLINE';
                    if (tunnelStatusBadge) tunnelStatusBadge.className = 'status-pill status-pill-online';
                    toggleTunnelBtn.innerHTML = '<span>Stop Cloudflare Tunnel</span>';
                    toggleTunnelBtn.style.background = 'rgba(239, 68, 68, 0.08)';
                    toggleTunnelBtn.style.border = '1px solid rgba(239, 68, 68, 0.35)';
                    toggleTunnelBtn.style.color = '#f87171';
                    
                    if (tunnelUrlContainer && tunnelUrlVal && data.url) {
                        tunnelUrlContainer.style.display = 'block';
                        const fullUrl = data.url.endsWith('/') ? `${data.url}find-my-photos` : `${data.url}/find-my-photos`;
                        tunnelUrlVal.href = fullUrl;
                        tunnelUrlVal.textContent = fullUrl;
                        
                        // Show and update dashboard banner in real-time
                        if (cloudflareUrlCard && statCloudflareUrl) {
                            cloudflareUrlCard.style.display = 'flex';
                            statCloudflareUrl.innerHTML = `
                                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                                    <a href="${fullUrl}" target="_blank" style="color: var(--secondary); text-decoration: none; font-weight: 700; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 6px; width: fit-content;" title="Visit Public Site">
                                        Visit Live Site 
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <line x1="7" y1="17" x2="17" y2="7"></line>
                                            <polyline points="7 7 17 7 17 17"></polyline>
                                        </svg>
                                    </a>
                                    <button onclick="copyTunnelUrl('${fullUrl}', this)" style="background: rgba(20, 184, 166, 0.08); border: 1px solid rgba(20, 184, 166, 0.18); color: var(--secondary); padding: 5px 10px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; width: fit-content; transition: all 0.2s; font-weight: 600;">
                                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        <span>Copy Link</span>
                                    </button>
                                </div>
                            `;
                        }
                    }
                } else {
                    tunnelStatusText.textContent = 'OFFLINE';
                    if (tunnelStatusBadge) tunnelStatusBadge.className = 'status-pill status-pill-offline';
                    toggleTunnelBtn.innerHTML = '<span>Start Cloudflare Tunnel</span>';
                    toggleTunnelBtn.style.background = '';
                    toggleTunnelBtn.style.border = '';
                    toggleTunnelBtn.style.color = '';
                    if (tunnelUrlContainer) {
                        tunnelUrlContainer.style.display = 'none';
                    }
                    
                    // Hide dashboard banner in real-time
                    if (cloudflareUrlCard) {
                        cloudflareUrlCard.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching tunnel status:', err);
        }
    }

    // Cloudflare Tunnel Logs Modal Elements
    const tunnelLogModal = document.getElementById('tunnelLogModal');
    const closeTunnelLogModalBtn = document.getElementById('closeTunnelLogModalBtn');
    const closeTunnelLogFooterBtn = document.getElementById('closeTunnelLogFooterBtn');
    const terminalLogBody = document.getElementById('terminalLogBody');
    const logModalStatusBadge = document.getElementById('logModalStatusBadge');
    const logModalStatusText = document.getElementById('logModalStatusText');
    const logModalSpinner = document.getElementById('logModalSpinner');
    const logModalSuccessCard = document.getElementById('logModalSuccessCard');
    const logModalUrlVal = document.getElementById('logModalUrlVal');

    let tunnelLogEventSource = null;

    function closeLogModal() {
        if (tunnelLogEventSource) {
            tunnelLogEventSource.close();
            tunnelLogEventSource = null;
        }
        if (tunnelLogModal) {
            tunnelLogModal.classList.add('hidden');
        }
        fetchTunnelStatus();
    }

    if (closeTunnelLogModalBtn) closeTunnelLogModalBtn.addEventListener('click', closeLogModal);
    if (closeTunnelLogFooterBtn) closeTunnelLogFooterBtn.addEventListener('click', closeLogModal);

    function appendTerminalLog(text) {
        if (!terminalLogBody) return;
        
        let timePart = '';
        let levelPart = '';
        let messagePart = text;
        
        const cfLogRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+(INF|ERR|WRN)\s+(.*)$/;
        const match = text.match(cfLogRegex);
        
        const logLineDiv = document.createElement('div');
        logLineDiv.className = 'log-line';
        
        if (match) {
            const [, timestamp, level, msg] = match;
            const tMatch = timestamp.match(/T(\d{2}:\d{2}:\d{2})Z/);
            timePart = tMatch ? tMatch[1] : timestamp;
            levelPart = level;
            messagePart = msg;
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'log-time';
            timeSpan.textContent = `[${timePart}]`;
            logLineDiv.appendChild(timeSpan);
            
            const levelSpan = document.createElement('span');
            levelSpan.className = `log-level-${level.toLowerCase() === 'wrn' ? 'inf' : level.toLowerCase()}`;
            levelSpan.textContent = `${level}: `;
            logLineDiv.appendChild(levelSpan);
        } else if (text.startsWith('[System]')) {
            const systemSpan = document.createElement('span');
            systemSpan.className = 'log-level-sys';
            systemSpan.textContent = '[System] ';
            logLineDiv.appendChild(systemSpan);
            messagePart = text.replace('[System]', '').trim();
        }
        
        // Match trycloudflare URL and highlight it
        const urlRegex = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;
        const urlMatch = messagePart.match(urlRegex);
        if (urlMatch) {
            const url = urlMatch[1];
            const parts = messagePart.split(url);
            
            const beforeText = document.createTextNode(parts[0]);
            logLineDiv.appendChild(beforeText);
            
            const urlLink = document.createElement('a');
            urlLink.className = 'log-highlight-url';
            urlLink.href = url;
            urlLink.target = '_blank';
            urlLink.textContent = url;
            logLineDiv.appendChild(urlLink);
            
            if (parts[1]) {
                const afterText = document.createTextNode(parts[1]);
                logLineDiv.appendChild(afterText);
            }
            
            handleTunnelConnected(url);
        } else {
            const textNode = document.createTextNode(messagePart);
            logLineDiv.appendChild(textNode);
        }
        
        terminalLogBody.appendChild(logLineDiv);
        
        const terminalContainer = terminalLogBody.parentElement;
        if (terminalContainer) {
            terminalContainer.scrollTop = terminalContainer.scrollHeight;
        }
    }

    function handleTunnelConnected(url) {
        if (logModalStatusText) logModalStatusText.textContent = 'ONLINE';
        if (logModalStatusBadge) logModalStatusBadge.className = 'status-pill status-pill-online';
        if (logModalSpinner) logModalSpinner.style.display = 'none';
        
        if (logModalSuccessCard && logModalUrlVal) {
            logModalSuccessCard.style.display = 'block';
            const fullUrl = url.endsWith('/') ? `${url}find-my-photos` : `${url}/find-my-photos`;
            logModalUrlVal.href = fullUrl;
            logModalUrlVal.textContent = fullUrl;
        }
        
        fetchTunnelStatus();
    }

    if (toggleTunnelBtn) {
        toggleTunnelBtn.addEventListener('click', async () => {
            const isOnline = tunnelStatusText && tunnelStatusText.textContent === 'ONLINE';
            const action = isOnline ? 'stop' : 'start';
            
            toggleTunnelBtn.disabled = true;
            toggleTunnelBtn.innerHTML = `<span class="spinner-ring"></span><span>${isOnline ? 'Stopping Tunnel...' : 'Starting Tunnel...'}</span>`;
            
            if (action === 'start') {
                if (terminalLogBody) terminalLogBody.innerHTML = '';
                if (logModalSuccessCard) logModalSuccessCard.style.display = 'none';
                if (logModalSpinner) logModalSpinner.style.display = 'block';
                if (logModalStatusText) logModalStatusText.textContent = 'CONNECTING';
                if (logModalStatusBadge) logModalStatusBadge.className = 'status-pill status-pill-offline';
                
                if (tunnelLogModal) {
                    tunnelLogModal.classList.remove('hidden');
                }
                
                appendTerminalLog('[System] Launching Cloudflare Tunnel process...');
            }
            
            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
                const res = await fetch('/api/admin/tunnel/toggle', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ action })
                });
                const data = await res.json();
                if (res.ok) {
                    if (action === 'stop') {
                        showCustomAlert(data.message);
                        if (tunnelLogEventSource) {
                            tunnelLogEventSource.close();
                            tunnelLogEventSource = null;
                        }
                    } else {
                        appendTerminalLog('[System] Backend process started. Awaiting connection establishment...');
                        
                        // Start SSE logs streaming AFTER the toggle POST succeeds (ensures log files are already cleared)
                        if (tunnelLogEventSource) {
                            tunnelLogEventSource.close();
                        }
                        
                        tunnelLogEventSource = new EventSource(`/api/admin/tunnel/logs?token=${token}`);
                        
                        tunnelLogEventSource.onmessage = (event) => {
                            appendTerminalLog(event.data);
                        };
                        
                        tunnelLogEventSource.onerror = (err) => {
                            console.error('EventSource error:', err);
                            appendTerminalLog('[System] Error receiving log stream. Reconnecting...');
                        };
                    }
                } else {
                    if (action === 'start') {
                        appendTerminalLog(`[System] Error starting tunnel: ${data.detail || 'Unknown error'}`);
                        if (logModalSpinner) logModalSpinner.style.display = 'none';
                        if (logModalStatusText) logModalStatusText.textContent = 'ERROR';
                    } else {
                        showCustomAlert(data.detail || 'Failed to toggle tunnel');
                    }
                }
            } catch (err) {
                console.error('Tunnel toggle error:', err);
                if (action === 'start') {
                    appendTerminalLog('[System] Network error occurred while triggering tunnel startup.');
                    if (logModalSpinner) logModalSpinner.style.display = 'none';
                    if (logModalStatusText) logModalStatusText.textContent = 'ERROR';
                } else {
                    showCustomAlert('Error toggling tunnel status');
                }
            } finally {
                toggleTunnelBtn.disabled = false;
                if (action === 'stop') {
                    setTimeout(fetchTunnelStatus, 1000);
                }
            }
        });
    }

    // ── Reset System for New Wedding ──
    const resetSystemBtn = document.getElementById('resetSystemBtn');
    if (resetSystemBtn) {
        resetSystemBtn.addEventListener('click', () => {
            // Create confirmation modal
            let confirmOverlay = document.getElementById('reset-confirm-overlay');
            if (confirmOverlay) confirmOverlay.remove();

            confirmOverlay = document.createElement('div');
            confirmOverlay.id = 'reset-confirm-overlay';
            confirmOverlay.className = 'upload-loader-overlay active';
            confirmOverlay.style.zIndex = '9999';
            confirmOverlay.innerHTML = `
                <div class="upload-loader-card" style="gap: 16px; padding: 32px 28px;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                    <div style="text-align: center;">
                        <h3 style="color: #f8fafc; font-size: 1.15rem; font-weight: 600; margin: 0 0 8px;">Reset Entire System?</h3>
                        <p style="color: #64748b; font-size: 0.84rem; line-height: 1.6; margin: 0;">
                            This will <strong style="color: #ef4444;">permanently delete</strong> all photos, face data, couple photos, and settings. This action cannot be undone.
                        </p>
                    </div>
                    <div style="width: 100%; margin-top: 4px;">
                        <label style="font-size: 0.78rem; color: #64748b; display: block; margin-bottom: 6px;">Type <strong style="color: #e2e8f0;">RESET</strong> to confirm</label>
                        <input type="text" id="resetConfirmInput" placeholder="Type RESET here" autocomplete="off" style="width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #f8fafc; font-size: 0.9rem; outline: none; box-sizing: border-box; transition: border-color 0.2s;" />
                    </div>
                    <div style="display: flex; gap: 10px; width: 100%; margin-top: 4px;">
                        <button id="resetCancelBtn" class="loader-btn" style="flex: 1; background: rgba(255,255,255,0.06); color: #94a3b8; border: none; padding: 11px 16px; border-radius: 12px; font-size: 0.85rem; font-weight: 500; cursor: pointer;">Cancel</button>
                        <button id="resetConfirmBtn" class="loader-btn" style="flex: 1; background: rgba(239,68,68,0.15); color: #f87171; border: none; padding: 11px 16px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; cursor: pointer; opacity: 0.4; pointer-events: none;" disabled>Delete Everything</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmOverlay);

            const confirmInput = document.getElementById('resetConfirmInput');
            const confirmBtn = document.getElementById('resetConfirmBtn');
            const cancelBtn = document.getElementById('resetCancelBtn');

            confirmInput.addEventListener('input', () => {
                if (confirmInput.value.trim() === 'RESET') {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.pointerEvents = 'auto';
                } else {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.4';
                    confirmBtn.style.pointerEvents = 'none';
                }
            });

            cancelBtn.addEventListener('click', () => {
                confirmOverlay.remove();
            });

            confirmBtn.addEventListener('click', async () => {
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Resetting…';
                confirmBtn.style.opacity = '0.6';
                cancelBtn.disabled = true;
                cancelBtn.style.opacity = '0.4';

                try {
                    const res = await fetch('/api/admin/reset-system', { method: 'POST' });
                    const data = await res.json();
                    if (res.ok && data.status === 'success') {
                        confirmOverlay.querySelector('.upload-loader-card').innerHTML = `
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(34, 197, 94, 0.1); display: flex; align-items: center; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <h3 style="color: #f8fafc; font-size: 1.1rem; font-weight: 600; margin: 0;">System Reset Complete</h3>
                            <p style="color: #64748b; font-size: 0.84rem; margin: 0;">Ready for a new wedding. Reloading…</p>
                        `;
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        throw new Error(data.detail || 'Reset failed');
                    }
                } catch (err) {
                    confirmBtn.innerText = 'Failed — Try Again';
                    confirmBtn.style.opacity = '1';
                    confirmBtn.style.pointerEvents = 'auto';
                    confirmBtn.disabled = false;
                    cancelBtn.disabled = false;
                    cancelBtn.style.opacity = '1';
                    if (typeof showToast === 'function') showToast('Reset failed: ' + err.message, 'error');
                }
            });
        });
    }

    // Load dynamic settings on start
    fetchSettings();
    fetchStorageStatus();
    fetchTunnelStatus();

    // ==========================================
    // --- Dashboard Utilities & Lightbox Logic ---
    // ==========================================
    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Recent';
        const ms = timestamp * 1000;
        const now = Date.now();
        const diffSecs = Math.floor((now - ms) / 1000);
        
        if (diffSecs < 0 || diffSecs < 60) return 'Just now';
        
        const diffMins = Math.floor(diffSecs / 60);
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        
        const dateObj = new Date(ms);
        return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function updateActivityGraph(photos) {
        const svg = document.getElementById('activityGraph');
        const areaPath = document.getElementById('graphAreaPath');
        const linePath = document.getElementById('graphLinePath');
        const subText = document.getElementById('graphSubText');
        if (!svg || !areaPath || !linePath) return;

        if (!photos || photos.length === 0) {
            linePath.setAttribute('d', 'M 0 60 L 500 60');
            areaPath.setAttribute('d', 'M 0 60 L 500 60 L 500 120 L 0 120 Z');
            if (subText) subText.textContent = 'No upload activity recorded';
            return;
        }

        const now = Date.now();
        const minTime = Math.min(...photos.map(p => p.created_at || 0)) * 1000;
        const totalDuration = now - minTime;
        
        let bins = [0, 0, 0, 0, 0, 0, 0, 0];
        let label = 'Recent upload volume';

        if (totalDuration < 24 * 60 * 60 * 1000) {
            label = 'Analyses in the last 24 hours';
            photos.forEach(p => {
                const ageMs = now - ((p.created_at || 0) * 1000);
                const ageHours = ageMs / (1000 * 60 * 60);
                const binIdx = 7 - Math.floor(ageHours / 3);
                if (binIdx >= 0 && binIdx < 8) {
                    bins[binIdx]++;
                }
            });
        } else {
            label = 'Uploads in the last 8 days';
            photos.forEach(p => {
                const ageMs = now - ((p.created_at || 0) * 1000);
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                const binIdx = 7 - Math.floor(ageDays);
                if (binIdx >= 0 && binIdx < 8) {
                    bins[binIdx]++;
                }
            });
        }

        if (subText) subText.textContent = label;

        const maxVal = Math.max(...bins, 1);
        const points = [];
        
        for (let i = 0; i < 8; i++) {
            const x = (i * 500) / 7;
            const y = 100 - ((bins[i] / maxVal) * 80);
            points.push({ x, y });
        }

        let dLine = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i+1];
            const cpX1 = p0.x + (p1.x - p0.x) / 2;
            const cpY1 = p0.y;
            const cpX2 = p0.x + (p1.x - p0.x) / 2;
            const cpY2 = p1.y;
            dLine += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
        }

        const dArea = dLine + ` L 500 120 L 0 120 Z`;

        linePath.setAttribute('d', dLine);
        areaPath.setAttribute('d', dArea);
    }

    function updateSystemHealth(photos, users) {
        const healthDbText = document.getElementById('healthDbText');
        const healthWifiText = document.getElementById('healthWifiText');
        const healthTunnelText = document.getElementById('healthTunnelText');

        if (healthDbText) {
            const activeModeEl = document.getElementById('activeStorageMode');
            const activeMode = activeModeEl ? activeModeEl.textContent.trim().toUpperCase() : 'LOCAL';
            if (activeMode.includes('SUPABASE')) {
                healthDbText.innerHTML = `<span class="health-dot green"></span>Cloud (Supabase)`;
            } else {
                healthDbText.innerHTML = `<span class="health-dot green"></span>Local JSON`;
            }
        }

        if (healthWifiText) {
            const wifiBadge = document.getElementById('wifiStatusBadge');
            if (wifiBadge && wifiBadge.textContent.trim().includes('Receiver Running')) {
                healthWifiText.innerHTML = `<span class="health-dot green"></span>Active`;
            } else {
                healthWifiText.innerHTML = `<span class="health-dot red"></span>Stopped`;
            }
        }

        if (healthTunnelText) {
            const tunnelTextEl = document.getElementById('tunnelStatusText');
            const tunnelText = tunnelTextEl ? tunnelTextEl.textContent.trim().toUpperCase() : 'OFFLINE';
            if (tunnelText.includes('ONLINE')) {
                healthTunnelText.innerHTML = `<span class="health-dot green"></span>Connected`;
            } else {
                healthTunnelText.innerHTML = `<span class="health-dot red"></span>Offline`;
            }
        }
    }

    const lightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxFilename = document.getElementById('lightboxFilename');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

    window.openLightbox = function(url, filename) {
        if (!lightboxModal || !lightboxImg || !lightboxFilename) return;
        lightboxImg.src = url;
        lightboxFilename.textContent = filename || 'Preview';
        lightboxModal.classList.add('active');
    };

    window.copyTunnelUrl = function(url, btn) {
        navigator.clipboard.writeText(url).then(() => {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Copied!</span>
            `;
            btn.style.background = 'rgba(16, 185, 129, 0.15)';
            btn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            btn.style.color = '#34d399';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    window.deletePhotoFromDashboard = async function(photoPath, btn) {
        if (await showCustomConfirm('Are you sure you want to delete this image?')) {
            try {
                const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
                const res = await fetch(`/api/admin/photos/delete`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ path: photoPath })
                });
                if (res.ok) {
                    fetchRealData(true);
                } else {
                    const data = await res.json();
                    showCustomAlert('Failed to delete photo: ' + (data.detail || 'Unknown error'));
                }
            } catch (err) {
                console.error('Failed to delete photo: ', err);
                showCustomAlert('Error deleting photo. Please try again.');
            }
        }
    };

    if (lightboxCloseBtn) {
        lightboxCloseBtn.addEventListener('click', () => {
            if (lightboxModal) lightboxModal.classList.remove('active');
        });
    }

    if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                lightboxModal.classList.remove('active');
            }
        });
    }

    // Start background live sync polling
    setInterval(() => {
        fetchRealData(false);
        fetchCouplePhotos(false);
        fetchCategoriesAndRefresh(false);
        fetchTunnelStatus();
    }, 5000);

});


