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
                    
                    let coverSrc = 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop';
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
                        window.location.href = `gallery.html?album=${encodeURIComponent(cat)}`;
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
});
