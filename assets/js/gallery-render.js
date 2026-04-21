(function () {
    'use strict';

    const MAX_INLINE = 5; // folders shown inline before "More ▾" dropdown

    let currentFilter = 'all';
    let currentSearch = '';
    let allItems      = [];   // all rendered article elements
    let filteredData  = [];   // galleryData subset matching current filter+search

    // ── Init ─────────────────────────────────────────────────────────────────

    function init() {
        if (typeof galleryData === 'undefined' || !galleryData.length) return;

        // Expose filtered data for lightbox navigation (lightbox.js reads window.galleryData)
        window.galleryData = galleryData;

        buildFilters();
        renderGrid();
        hookSearch();
        hookScroll();
    }

    // ── Filter buttons ───────────────────────────────────────────────────────

    function buildFilters() {
        const container = document.querySelector('.filter-buttons');
        if (!container) return;

        const folders = [...new Set(galleryData.map(d => d.folder))].sort();

        container.innerHTML = '';

        container.appendChild(makeBtn('all', 'All', true));

        const inline   = folders.slice(0, MAX_INLINE);
        const overflow = folders.slice(MAX_INLINE);

        inline.forEach(f => container.appendChild(makeBtn(f, f)));

        if (overflow.length) {
            const wrapper  = document.createElement('div');
            wrapper.className = 'filter-more-wrapper';

            const moreBtn  = document.createElement('button');
            moreBtn.className = 'filter-more-btn';
            moreBtn.innerHTML = 'More <span class="chevron">▾</span>';
            moreBtn.addEventListener('click', e => {
                e.stopPropagation();
                wrapper.classList.toggle('open');
            });

            const dropdown = document.createElement('div');
            dropdown.className = 'filter-more-dropdown';
            overflow.forEach(f => dropdown.appendChild(makeBtn(f, f)));

            wrapper.appendChild(moreBtn);
            wrapper.appendChild(dropdown);
            container.appendChild(wrapper);

            document.addEventListener('click', () => wrapper.classList.remove('open'));
        }
    }

    function makeBtn(value, label, active = false) {
        const btn = document.createElement('button');
        btn.className    = 'filter-btn' + (active ? ' active' : '');
        btn.dataset.filter = value;
        btn.textContent  = label;
        btn.addEventListener('click', () => applyFilter(value));
        return btn;
    }

    // ── Gallery grid ─────────────────────────────────────────────────────────

    function renderGrid() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;

        grid.innerHTML = '';

        galleryData.forEach((item, index) => {
            const el = document.createElement('article');
            el.className = 'gallery-item scroll-animate';
            el.dataset.folder   = item.folder;
            el.dataset.category = item.category || '';
            el.dataset.id       = item.id;
            el.style.setProperty('--index', index % 4);

            el.innerHTML = `
                <img
                    src="${item.thumbnail}"
                    alt="${item.folder}"
                    loading="lazy"
                />
                <div class="gallery-item-overlay">
                    <div class="overlay-inner">
                        <span class="overlay-folder">${item.folder}</span>
                        <span class="overlay-cta">View Photo</span>
                    </div>
                </div>`;

            el.addEventListener('click', () => openLightbox(item));
            grid.appendChild(el);
        });

        allItems     = Array.from(grid.querySelectorAll('.gallery-item'));
        filteredData = [...galleryData];
        window.galleryData = filteredData;
    }

    function openLightbox(item) {
        if (window.lightbox) window.lightbox.open(item);
    }

    // ── Filtering & search ───────────────────────────────────────────────────

    function applyFilter(folder) {
        currentFilter = folder;

        document.querySelectorAll('.filter-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.filter === folder)
        );

        // Highlight "More" button if the active filter is in the overflow dropdown
        const moreBtn = document.querySelector('.filter-more-btn');
        if (moreBtn) {
            const overflowActive = !!document.querySelector(
                '.filter-more-dropdown .filter-btn.active'
            );
            moreBtn.classList.toggle('active', overflowActive);
        }

        filterAndSearch();
    }

    function hookSearch() {
        const input = document.getElementById('searchInput');
        if (!input) return;
        input.addEventListener('input', () => {
            currentSearch = input.value.trim().toLowerCase();
            filterAndSearch();
        });
    }

    function filterAndSearch() {
        const noResults = document.getElementById('noResults');
        let count = 0;

        filteredData = [];

        allItems.forEach(el => {
            const folder   = el.dataset.folder;
            const folderLo = folder.toLowerCase();
            const catLo    = el.dataset.category.toLowerCase();

            const folderMatch  = currentFilter === 'all' || folder === currentFilter;
            const searchMatch  = !currentSearch ||
                folderLo.includes(currentSearch) ||
                catLo.includes(currentSearch);

            if (folderMatch && searchMatch) {
                // Cancel any pending hide timer
                if (el._hideTimer) {
                    clearTimeout(el._hideTimer);
                    el._hideTimer = null;
                }
                // Restore display, then fade in on next frame
                el.classList.remove('hidden');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => el.classList.remove('filtered-out'));
                });
                filteredData.push(galleryData.find(d => d.id === +el.dataset.id));
                count++;
            } else {
                el.classList.add('filtered-out');
                // After fade-out completes, collapse the space so masonry reflows
                if (el._hideTimer) clearTimeout(el._hideTimer);
                el._hideTimer = setTimeout(() => {
                    el.classList.add('hidden');
                    el._hideTimer = null;
                }, 320);
            }
        });

        // Keep lightbox navigating within visible items only
        window.galleryData = filteredData.filter(Boolean);

        if (noResults) noResults.style.display = count === 0 ? 'block' : 'none';
    }

    // ── Scroll-reveal ────────────────────────────────────────────────────────

    function hookScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

        allItems.forEach(el => observer.observe(el));
    }

    // ── Boot ─────────────────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
