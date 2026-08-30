import { initLazyLoading } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Menu Toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.classList.toggle('modal-open');
        });
    }

    // Close mobile menu on link click
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburger) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('modal-open');
            }
        });
    });

    // 2. Sticky Navbar
    const navbar = document.querySelector('.navbar');
    const hasHero = document.querySelector('.hero') !== null;
    
    if (navbar) {
        if (hasHero) {
            window.addEventListener('scroll', () => {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            });
            // Initial check in case page loads scrolled down
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        } else {
            // Subpages without a hero section should always be scrolled (dark background)
            navbar.classList.add('scrolled');
        }
    }

    // 3. Scroll Animations (Fade-in elements)
    const fadeElements = document.querySelectorAll('.fade-in');
    
    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    fadeElements.forEach(el => fadeObserver.observe(el));

    // 4. Dynamic Couples Grid on Homepage
    const homepageAlbumsGrid = document.getElementById('homepageAlbumsGrid');
    if (homepageAlbumsGrid) {
        fetchHomepageAlbums(true);
    }

    let lastHomepageAlbumsStr = '';
    async function fetchHomepageAlbums(force = false) {
        try {
            const [photosRes, catsRes] = await Promise.all([
                fetch('/api/admin/couple-photos'),
                fetch('/api/admin/categories')
            ]);
            const photosData = await photosRes.json();
            const catsData = await catsRes.json();
            
            if (photosData.status === 'success' && catsData.status === 'success') {
                const photos = photosData.photos;
                const categories = catsData.categories;
                
                const dataStr = JSON.stringify({ photos, categories });
                if (!force && dataStr === lastHomepageAlbumsStr) return;
                lastHomepageAlbumsStr = dataStr;
                
                homepageAlbumsGrid.innerHTML = '';
                categories.forEach((cat, index) => {
                    const normalizedCat = cat.toLowerCase();
                    const catPhotos = photos.filter(p => p.category.toLowerCase() === normalizedCat);
                    
                    let coverSrc = 'assets/backgrounds/hero-image.jpg';
                    if (catPhotos.length > 0) {
                        coverSrc = catPhotos[0].url;
                    }
                    
                    const card = document.createElement('div');
                    card.className = 'album-card fade-in';
                    card.style.animationDelay = `${index * 0.1}s`;
                    card.innerHTML = `
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlN2U3ZTciLz48L3N2Zz4=" data-src="${coverSrc}" alt="${cat}" class="album-cover skeleton">
                        <div class="album-overlay">
                            <span class="photo-count-badge">${catPhotos.length} ${catPhotos.length === 1 ? 'Photo' : 'Photos'}</span>
                            <div class="album-info">
                                <i class="fa-solid fa-heart heart-icon"></i>
                                <h3>${cat}</h3>
                                <p>Explore memories</p>
                            </div>
                        </div>
                    `;
                    
                    card.addEventListener('click', () => {
                        window.location.href = `/gallery?album=${encodeURIComponent(cat)}`;
                    });
                    
                    homepageAlbumsGrid.appendChild(card);
                });
                
                // Observe the new album cards for scroll animations
                const newFades = homepageAlbumsGrid.querySelectorAll('.fade-in');
                newFades.forEach(el => fadeObserver.observe(el));
                
                // Trigger lazy loading
                initLazyLoading();
            }
        } catch (error) {
            console.error('Error fetching homepage albums:', error);
        }
    }

    // 5. Initialize Lazy Loading
    initLazyLoading();

    // 6. Dynamic Couple Settings
    let lastCoupleSettingsStr = '';
    async function fetchAndApplyCoupleSettings(force = false) {
        try {
            const response = await fetch('/api/admin/couple-settings');
            const data = await response.json();
            if (data.status === 'success' && data.settings) {
                const dataStr = JSON.stringify(data.settings);
                if (!force && dataStr === lastCoupleSettingsStr) return;
                lastCoupleSettingsStr = dataStr;

                const coupleName = data.settings.couple_name;

                // Update Hero Title
                const heroTitle = document.querySelector('.hero h1');
                if (heroTitle) {
                    const separatorRegex = /\s*(?:&|\+)\s*|\s+and\s+/i;
                    if (separatorRegex.test(coupleName)) {
                        const parts = coupleName.split(separatorRegex);
                        if (parts.length === 2) {
                            const match = coupleName.match(separatorRegex);
                            const separator = match ? match[0].trim() : '&';
                            
                            // Capitalize names for premium look
                            const capitalize = (str) => {
                                return str
                                    .trim()
                                    .split(/\s+/)
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                    .join(' ');
                            };
                            
                            const p1 = capitalize(parts[0]);
                            const p2 = capitalize(parts[1]);
                            
                            heroTitle.innerHTML = `
                                <span class="partner-name">${p1}</span>
                                <span class="ampersand">${separator}</span>
                                <span class="partner-name">${p2}</span>
                            `;
                            heroTitle.classList.add('split-names');
                        } else {
                            heroTitle.textContent = coupleName;
                            heroTitle.classList.remove('split-names');
                            adjustSingleTitleSize(heroTitle, coupleName);
                        }
                    } else {
                        heroTitle.textContent = coupleName;
                        heroTitle.classList.remove('split-names');
                        adjustSingleTitleSize(heroTitle, coupleName);
                    }
                }
                
                // Update document title suffix
                if (document.title.includes('Sophia & James')) {
                    document.title = document.title.replace('Sophia & James', coupleName);
                } else if (document.title.includes('Techora Memories') && !document.title.includes(coupleName)) {
                    document.title = `${coupleName} - Techora Memories`;
                }
            }
        } catch (error) {
            console.error('Error fetching couple settings:', error);
        }
    }

    function adjustSingleTitleSize(element, text) {
        if (text.length > 25) {
            element.style.fontSize = '2.2rem';
        } else if (text.length > 15) {
            element.style.fontSize = '2.8rem';
        } else {
            element.style.fontSize = ''; // Reset to default CSS
        }
    }

    fetchAndApplyCoupleSettings(true);

    // 7. Live Sync Polling (Every 5 seconds)
    setInterval(() => {
        if (homepageAlbumsGrid) {
            fetchHomepageAlbums(false);
        }
        fetchAndApplyCoupleSettings(false);
    }, 5000);

    // ==============================================
    // Lightbox / Image Modal Navigation & Swipes
    // ==============================================
    window.currentModalImages = [];
    window.currentModalIndex = 0;

    const prevBtn = document.getElementById('modalPrevBtn');
    const nextBtn = document.getElementById('modalNextBtn');
    const counterEl = document.getElementById('modalCounter');
    const modalImg = document.getElementById('modalImg');
    const imageModal = document.getElementById('imageModal');

    let isTransitioning = false;

    if (modalImg) {
        modalImg.addEventListener('load', () => {
            modalImg.classList.add('loaded');
            const wrapper = modalImg.closest('.modal-card-wrapper');
            if (wrapper) wrapper.classList.add('loaded');
        });
    }

    function updateModalContent(resetClass = true) {
        if (!window.currentModalImages || window.currentModalImages.length === 0) return;
        
        const index = window.currentModalIndex;
        const total = window.currentModalImages.length;
        const src = window.currentModalImages[index];
        
        if (modalImg) {
            // Remove loaded classes before changing source to hide blank card
            modalImg.classList.remove('loaded');
            const wrapper = modalImg.closest('.modal-card-wrapper');
            if (wrapper) wrapper.classList.remove('loaded');
            
            modalImg.src = src;
            if (resetClass) {
                modalImg.classList.add('reveal-in');
            }
        }
        if (counterEl) counterEl.textContent = `${index + 1} / ${total}`;
        
        // Show/hide navigation arrows based on count
        if (prevBtn && nextBtn) {
            prevBtn.style.display = total > 1 ? 'flex' : 'none';
            nextBtn.style.display = total > 1 ? 'flex' : 'none';
        }
    }

    function navigateModal(direction) {
        if (isTransitioning || !window.currentModalImages || window.currentModalImages.length <= 1) return;
        isTransitioning = true;
        
        // Target next index
        const nextIndex = (window.currentModalIndex + direction + window.currentModalImages.length) % window.currentModalImages.length;
        
        // Apply swipe animation class
        if (modalImg) {
            modalImg.classList.add(direction > 0 ? 'swipe-left' : 'swipe-right');
        }
        
        // Wait for swipe-away animation to complete
        setTimeout(() => {
            window.currentModalIndex = nextIndex;
            if (modalImg) {
                modalImg.classList.remove('swipe-left', 'swipe-right', 'reveal-in');
            }
            updateModalContent(true);
            isTransitioning = false;
        }, 300); // 300ms matches the swipe animation duration
    }

    // Intercept clicks on view buttons to build image queue
    document.body.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-btn');
        if (!viewBtn) return;
        
        // Find parent container to query sibling view buttons
        const container = viewBtn.closest('#resultsGrid') || viewBtn.closest('#galleryGrid') || viewBtn.closest('#galleryGridAlbum');
        if (!container) return;
        
        const allBtns = Array.from(container.querySelectorAll('.view-btn'));
        const images = allBtns.map(btn => btn.dataset.img || btn.getAttribute('data-img')).filter(Boolean);
        const clickedSrc = viewBtn.dataset.img || viewBtn.getAttribute('data-img');
        
        window.currentModalImages = images;
        window.currentModalIndex = images.indexOf(clickedSrc);
        
        updateModalContent(true);
    });

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateModal(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateModal(1);
        });
    }

    // Keyboard controls (Esc, ArrowLeft, ArrowRight)
    document.addEventListener('keydown', (e) => {
        if (imageModal && imageModal.style.display === 'flex') {
            if (e.key === 'ArrowLeft' && prevBtn) {
                navigateModal(-1);
            } else if (e.key === 'ArrowRight' && nextBtn) {
                navigateModal(1);
            } else if (e.key === 'Escape') {
                const closeModalBtn = imageModal.querySelector('.close-modal');
                if (closeModalBtn) closeModalBtn.click();
            }
        }
    });

    // Touch Swipe gestures
    let touchStartX = 0;
    let touchEndX = 0;

    if (imageModal) {
        imageModal.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        imageModal.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                navigateModal(1); // Swipe left -> Next
            } else if (touchEndX > touchStartX + swipeThreshold) {
                navigateModal(-1); // Swipe right -> Prev
            }
        }, { passive: true });
    }

    // Full View Button Toggle Functionality
    const fullViewBtn = document.getElementById('modalFullViewBtn');
    if (fullViewBtn && imageModal) {
        fullViewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Toggle local css class
            imageModal.classList.toggle('fullscreen-mode');
            
            const icon = fullViewBtn.querySelector('i');
            const isFullMode = imageModal.classList.contains('fullscreen-mode');
            
            if (icon) {
                icon.className = isFullMode ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
            }
            
            // Toggle browser fullscreen API if supported
            if (isFullMode) {
                if (imageModal.requestFullscreen) {
                    imageModal.requestFullscreen().catch(() => {});
                } else if (imageModal.webkitRequestFullscreen) {
                    imageModal.webkitRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        });

        // Listen for browser fullscreen exit (e.g. Esc press or back swipe) to keep UI in sync
        const onFullscreenChange = () => {
            const isFullscreen = document.fullscreenElement !== null;
            const icon = fullViewBtn.querySelector('i');
            if (isFullscreen) {
                imageModal.classList.add('fullscreen-mode');
                if (icon) icon.className = 'fa-solid fa-compress';
            } else {
                imageModal.classList.remove('fullscreen-mode');
                if (icon) icon.className = 'fa-solid fa-expand';
            }
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
    }

    // Auto-scroll to primary action section on load
    window.addEventListener('load', () => {
        const heroCard = document.querySelector('.hero-card');
        const uploadCard = document.querySelector('.upload-card');
        const gallerySection = document.querySelector('.gallery-section');
        
        setTimeout(() => {
            if (heroCard) {
                heroCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (uploadCard) {
                uploadCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (gallerySection) {
                gallerySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 600); // Wait 600ms for preloader fade-out to finish
    });
});
