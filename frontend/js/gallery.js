import { initLazyLoading, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Containers
    const albumsView = document.getElementById('albumsView');
    const allPhotosView = document.getElementById('allPhotosView');
    const albumDetailView = document.getElementById('albumDetailView');
    
    const albumsGrid = document.getElementById('albumsGrid');
    const galleryGridAll = document.getElementById('galleryGrid'); // allPhotosView has grid with id="galleryGrid"
    const galleryGridAlbum = document.getElementById('galleryGridAlbum');
    
    // View Buttons
    const btnShowAlbums = document.getElementById('btnShowAlbums');
    const btnShowAll = document.getElementById('btnShowAll');
    const btnBackToAlbums = document.getElementById('btnBackToAlbums');
    
    // Header for Detail Album
    const albumTitle = document.getElementById('albumTitle');
    const albumPhotoCount = document.getElementById('albumPhotoCount');

    let galleryData = [];
    let categoriesList = [];

    // Helper to clear the album query parameter from URL
    function clearAlbumQueryParam() {
        const url = new URL(window.location);
        if (url.searchParams.has('album')) {
            url.searchParams.delete('album');
            window.history.pushState({}, '', url);
        }
    }

    // Switch view logic
    if (btnShowAlbums) {
        btnShowAlbums.addEventListener('click', () => {
            btnShowAlbums.classList.add('active');
            btnShowAll.classList.remove('active');
            
            albumsView.classList.remove('hidden');
            allPhotosView.classList.add('hidden');
            albumDetailView.classList.add('hidden');
            clearAlbumQueryParam();
        });
    }

    if (btnShowAll) {
        btnShowAll.addEventListener('click', () => {
            btnShowAll.classList.add('active');
            btnShowAlbums.classList.remove('active');
            
            allPhotosView.classList.remove('hidden');
            albumsView.classList.add('hidden');
            albumDetailView.classList.add('hidden');
            
            renderAllPhotos('all');
            clearAlbumQueryParam();
        });
    }

    if (btnBackToAlbums) {
        btnBackToAlbums.addEventListener('click', () => {
            albumDetailView.classList.add('hidden');
            albumsView.classList.remove('hidden');
            allPhotosView.classList.add('hidden');
            
            btnShowAlbums.classList.add('active');
            btnShowAll.classList.remove('active');
            clearAlbumQueryParam();
        });
    }

    // Fetch data
    let lastGalleryDataStr = '';
    let lastCategoriesListStr = '';

    async function fetchGalleryData(force = false) {
        try {
            const [photosRes, catsRes] = await Promise.all([
                fetch('/api/admin/couple-photos'),
                fetch('/api/admin/categories')
            ]);
            const photosData = await photosRes.json();
            const catsData = await catsRes.json();
            
            if (photosData.status === 'success' && catsData.status === 'success') {
                const photosStr = JSON.stringify(photosData.photos);
                const catsStr = JSON.stringify(catsData.categories);
                
                if (!force && photosStr === lastGalleryDataStr && catsStr === lastCategoriesListStr) {
                    return; // Skip rendering if data hasn't changed
                }
                
                lastGalleryDataStr = photosStr;
                lastCategoriesListStr = catsStr;
                
                galleryData = photosData.photos.map((p, idx) => ({
                    id: p.id || idx,
                    src: p.url || ('/gallery/' + p.path),
                    category: p.category.toLowerCase(),
                    title: p.filename.split('.').slice(0, -1).join('.')
                }));
                
                categoriesList = catsData.categories;
                updateActiveView();
            }
        } catch (error) {
            console.error('Error fetching gallery photos:', error);
            if (force && albumsGrid) {
                albumsGrid.innerHTML = '<p style="color: #ff6b6b; grid-column: 1/-1; text-align: center;">Failed to load wedding gallery.</p>';
            }
        }
    }

    function updateActiveView() {
        // Rebuild category filters
        renderCategoryFilters(categoriesList);
        
        // Re-render visible view
        if (albumsView && !albumsView.classList.contains('hidden')) {
            renderCoupleAlbums();
        } else if (allPhotosView && !allPhotosView.classList.contains('hidden')) {
            const activeFilterBtn = document.querySelector('#galleryFilters .filter-btn.active');
            const activeFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
            renderAllPhotos(activeFilter);
        } else if (albumDetailView && !albumDetailView.classList.contains('hidden')) {
            if (albumTitle) {
                const currentAlbum = albumTitle.textContent.trim();
                const categoryMatch = categoriesList.find(c => c.toLowerCase() === currentAlbum.toLowerCase());
                if (categoryMatch) {
                    const normalizedCat = categoryMatch.toLowerCase();
                    const catPhotos = galleryData.filter(item => item.category === normalizedCat);
                    if (albumPhotoCount) {
                        albumPhotoCount.textContent = `${catPhotos.length} ${catPhotos.length === 1 ? 'memory' : 'memories'}`;
                    }
                    renderAlbumDetailGrid(catPhotos);
                } else {
                    albumDetailView.classList.add('hidden');
                    albumsView.classList.remove('hidden');
                    renderCoupleAlbums();
                }
            }
        }
    }

    // Render Couples Album View (Default)
    function renderCoupleAlbums() {
        if (!albumsGrid) return;
        albumsGrid.innerHTML = '';

        categoriesList.forEach((cat, index) => {
            const normalizedCat = cat.toLowerCase();
            const catPhotos = galleryData.filter(item => item.category === normalizedCat);
            
            // Cover Photo: first photo in the category, or default fallback
            let coverSrc = 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop';
            if (catPhotos.length > 0 && catPhotos[0].src) {
                coverSrc = catPhotos[0].src;
            }

            const card = document.createElement('div');
            card.className = 'album-card';
            card.style.animationDelay = `${index * 0.1}s`;
            
            card.innerHTML = `
                <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=" data-src="${coverSrc}" alt="${cat}" class="album-cover skeleton">
                <div class="album-overlay">
                    <span class="photo-count-badge">${catPhotos.length} ${catPhotos.length === 1 ? 'Photo' : 'Photos'}</span>
                    <div class="album-info">
                        <i class="fa-solid fa-heart heart-icon"></i>
                        <h3>${cat}</h3>
                        <p>Explore wedding memories</p>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                openAlbumDetail(cat);
            });

            albumsGrid.appendChild(card);
        });

        if (categoriesList.length === 0) {
            albumsGrid.innerHTML = '<p style="color: var(--color-text-light); grid-column: 1/-1; text-align: center;">No couple albums configured yet.</p>';
        }

        initLazyLoading();
    }

    // Render Dynamic Category Filters in "All Photos" View
    function renderCategoryFilters(categories) {
        const filtersContainer = document.getElementById('galleryFilters');
        if (!filtersContainer) return;
        filtersContainer.innerHTML = '';

        // "All" filter
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.setAttribute('data-filter', 'all');
        allBtn.textContent = 'All';
        filtersContainer.appendChild(allBtn);

        // Individual category filters
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.setAttribute('data-filter', cat.toLowerCase());
            btn.textContent = cat;
            filtersContainer.appendChild(btn);
        });

        // Click handler
        const filterBtns = filtersContainer.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                renderAllPhotos(target.dataset.filter);
            });
        });
    }

    // Render "All Photos" Grid
    function renderAllPhotos(filter = 'all') {
        if (!galleryGridAll) return;
        galleryGridAll.innerHTML = '';

        const filteredData = filter === 'all'
            ? galleryData
            : galleryData.filter(item => item.category === filter);

        filteredData.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'gallery-item';
            el.style.animationDelay = `${index * 0.05}s`;

            el.innerHTML = `
                <img data-src="${item.src}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=" alt="${item.title}" class="skeleton">
                <div class="gallery-overlay">
                    <div class="overlay-actions">
                        <button class="icon-btn view-btn" data-img="${item.src}" title="View"><i class="fa-solid fa-expand"></i></button>
                        <button class="icon-btn dl-btn" data-img="${item.src}" title="Download"><i class="fa-solid fa-download"></i></button>
                    </div>
                    <div class="overlay-content">
                        <h4>${item.title}</h4>
                        <p>${getCategoryDisplayName(item.category)}</p>
                    </div>
                </div>
            `;
            galleryGridAll.appendChild(el);
        });

        if (filteredData.length === 0) {
            galleryGridAll.innerHTML = '<p style="color: var(--color-text-light); grid-column: 1/-1; text-align: center;">No photos found in this category.</p>';
        }

        initLazyLoading();
        attachGalleryEvents(galleryGridAll);
    }

    // Open Individual Couple Album Detail View
    function openAlbumDetail(category) {
        albumsView.classList.add('hidden');
        allPhotosView.classList.add('hidden');
        albumDetailView.classList.remove('hidden');

        if (albumTitle) albumTitle.textContent = category;

        const normalizedCat = category.toLowerCase();
        const catPhotos = galleryData.filter(item => item.category === normalizedCat);
        
        if (albumPhotoCount) {
            albumPhotoCount.textContent = `${catPhotos.length} ${catPhotos.length === 1 ? 'memory' : 'memories'}`;
        }

        renderAlbumDetailGrid(catPhotos);
    }

    // Render "Album Detail" Grid
    function renderAlbumDetailGrid(photos) {
        if (!galleryGridAlbum) return;
        galleryGridAlbum.innerHTML = '';

        photos.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'gallery-item';
            el.style.animationDelay = `${index * 0.05}s`;

            el.innerHTML = `
                <img data-src="${item.src}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=" alt="${item.title}" class="skeleton">
                <div class="gallery-overlay">
                    <div class="overlay-actions">
                        <button class="icon-btn view-btn" data-img="${item.src}" title="View"><i class="fa-solid fa-expand"></i></button>
                        <button class="icon-btn dl-btn" data-img="${item.src}" title="Download"><i class="fa-solid fa-download"></i></button>
                    </div>
                    <div class="overlay-content">
                        <h4>${item.title}</h4>
                    </div>
                </div>
            `;
            galleryGridAlbum.appendChild(el);
        });

        if (photos.length === 0) {
            galleryGridAlbum.innerHTML = '<p style="color: var(--color-text-light); grid-column: 1/-1; text-align: center;">No photos in this album yet.</p>';
        }

        initLazyLoading();
        attachGalleryEvents(galleryGridAlbum);
    }

    // Helper to get printable name for category
    function getCategoryDisplayName(categoryKey) {
        const found = categoriesList.find(c => c.toLowerCase() === categoryKey.toLowerCase());
        return found ? found : (categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1));
    }

    // Image View/Download Events
    function attachGalleryEvents(container) {
        const viewBtns = container.querySelectorAll('.view-btn');
        const dlBtns = container.querySelectorAll('.dl-btn');
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImg');

        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const src = e.currentTarget.dataset.img;
                modalImg.src = src;
                modal.style.display = 'flex';
                document.body.classList.add('modal-open');
            });
        });

        dlBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const src = e.currentTarget.dataset.img;
                triggerDownload(src);
            });
        });
    }

    // Trigger Download API helper
    async function triggerDownload(src) {
        try {
            showToast('Starting download...', 'info');
            const urlObj = new URL(src, window.location.origin);
            let downloadUrl = src;
            if (urlObj.pathname.startsWith('/gallery/')) {
                const path = urlObj.pathname.substring('/gallery/'.length);
                downloadUrl = `/api/download?path=${encodeURIComponent(path)}`;
            }
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = src.split('/').pop() || 'memory_photo.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => showToast('Download triggered!', 'success'), 800);
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to start download', 'error');
        }
    }

    // Fullscreen Modal logic
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            document.getElementById('imageModal').style.display = 'none';
            document.body.classList.remove('modal-open');
        });
    }

    const modalDownloadBtn = document.getElementById('modalDownloadBtn');
    if (modalDownloadBtn) {
        modalDownloadBtn.addEventListener('click', () => {
            const src = document.getElementById('modalImg').src;
            if (src) triggerDownload(src);
        });
    }

    // Initial load
    async function init() {
        await fetchGalleryData(true);
        
        // Deep-link check
        const urlParams = new URLSearchParams(window.location.search);
        const albumParam = urlParams.get('album');
        if (albumParam) {
            // Find the category case-insensitively
            const matchedCategory = categoriesList.find(cat => cat.toLowerCase() === albumParam.toLowerCase());
            if (matchedCategory) {
                openAlbumDetail(matchedCategory);
            }
        }
    }
    
    init();

    // Start background live sync polling (Every 5 seconds)
    setInterval(() => {
        fetchGalleryData(false);
    }, 5000);
});
