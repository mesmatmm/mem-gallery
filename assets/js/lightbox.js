/**
 * Lightbox Viewer
 * Manages fullscreen image viewing with keyboard and touch navigation
 */

class Lightbox {
    constructor() {
        this.lightbox = document.getElementById('lightbox');
        this.lightboxImage = document.getElementById('lightboxImage');
        this.lightboxCaption = document.getElementById('lightboxCaption');
        this.lightboxClose = document.getElementById('lightboxClose');
        this.lightboxPrev = document.getElementById('lightboxPrev');
        this.lightboxNext = document.getElementById('lightboxNext');
        this.lightboxBackdrop = document.querySelector('.lightbox-backdrop');

        this.currentImageId = null;
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Close button
        if (this.lightboxClose) {
            this.lightboxClose.addEventListener('click', () => this.close());
        }

        // Navigation buttons
        if (this.lightboxPrev) {
            this.lightboxPrev.addEventListener('click', () => this.previousImage());
        }

        if (this.lightboxNext) {
            this.lightboxNext.addEventListener('click', () => this.nextImage());
        }

        // Backdrop click
        if (this.lightboxBackdrop) {
            this.lightboxBackdrop.addEventListener('click', () => this.close());
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Touch navigation
        if (this.lightbox) {
            this.lightbox.addEventListener('touchstart', (e) => this.handleTouchStart(e), false);
            this.lightbox.addEventListener('touchend', (e) => this.handleTouchEnd(e), false);
        }

        // Prevent closing when clicking on image
        if (this.lightboxImage) {
            this.lightboxImage.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    handleKeydown(e) {
        // Check if lightbox is visible (either by .active class or display style)
        if (!this.lightbox || (this.lightbox.style.display !== 'flex' && !this.lightbox.classList.contains('active'))) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousImage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextImage();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
    }

    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swiped left - show next
                this.nextImage();
            } else {
                // Swiped right - show previous
                this.previousImage();
            }
        }
    }

    previousImage() {
        // This will be enhanced by the Gallery class
        this.navigateImage(-1);
    }

    nextImage() {
        // This will be enhanced by the Gallery class
        this.navigateImage(1);
    }

    navigateImage(direction) {
        // Get the gallery data from window if available
        if (!window.galleryData) return;

        const currentId = parseInt(this.lightbox.dataset.currentId || this.currentImageId);
        const currentIndex = window.galleryData.findIndex(item => item.id === currentId);

        if (currentIndex === -1) return;

        let nextIndex = currentIndex + direction;

        // Loop around
        if (nextIndex >= window.galleryData.length) {
            nextIndex = 0;
        } else if (nextIndex < 0) {
            nextIndex = window.galleryData.length - 1;
        }

        const nextItem = window.galleryData[nextIndex];
        this.updateImage(nextItem);
    }

    updateImage(item) {
        if (!this.lightboxImage || !this.lightboxCaption) return;

        const displaySrc = item.fullImage || item.image;

        // Use GSAP if available, otherwise fallback to CSS transitions
        if (typeof gsap !== 'undefined') {
            gsap.to(this.lightboxImage, {
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    this.lightboxImage.src = displaySrc;
                    this.lightboxImage.alt = item.folder;

                    const lightboxTitle = document.getElementById('lightboxTitle');
                    const lightboxCaptionText = document.getElementById('lightboxCaptionText');
                    const lightboxExif = document.getElementById('lightboxExif');

                    if (lightboxTitle) lightboxTitle.textContent = item.folder;
                    const imageLabel = document.getElementById('lightboxImageLabel');
                    if (imageLabel) imageLabel.textContent = item.folder;
                    if (lightboxCaptionText) lightboxCaptionText.style.display = 'none';

                    if (lightboxExif && item.exif) {
                        const exifParts = [item.exif.camera, item.exif.lens, item.exif.settings]
                            .filter(Boolean);
                        lightboxExif.innerHTML = exifParts.map(part => `<span>${part}</span>`).join('');
                    }

                    this.lightbox.dataset.currentId = item.id;

                    // Fade back in
                    gsap.to(this.lightboxImage, {
                        opacity: 1,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
            });
        } else {
            // Fallback for browsers without GSAP
            this.lightboxImage.style.opacity = '0.5';

            setTimeout(() => {
                this.lightboxImage.src = displaySrc;
                this.lightboxImage.alt = item.folder;

                const lightboxTitle = document.getElementById('lightboxTitle');
                const lightboxCaptionText = document.getElementById('lightboxCaptionText');
                const lightboxExif = document.getElementById('lightboxExif');

                if (lightboxTitle) lightboxTitle.textContent = item.folder;
                const imageLabelFallback = document.getElementById('lightboxImageLabel');
                if (imageLabelFallback) imageLabelFallback.textContent = item.folder;
                if (lightboxCaptionText) lightboxCaptionText.style.display = 'none';

                if (lightboxExif && item.exif) {
                    const exifParts = [item.exif.camera, item.exif.lens, item.exif.settings]
                        .filter(Boolean);
                    lightboxExif.innerHTML = exifParts.map(part => `<span>${part}</span>`).join('');
                }

                this.lightbox.dataset.currentId = item.id;

                // Fade in
                setTimeout(() => {
                    this.lightboxImage.style.opacity = '1';
                }, 10);
            }, 150);

            // Reset opacity transition
            this.lightboxImage.style.transition = 'opacity 0.3s ease-out';
        }
    }

    open(item) {
        if (!this.lightbox) return;

        // Set display and active class for consistency
        this.lightbox.style.display = 'flex';
        this.lightbox.classList.add('active');
        this.lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Animate in with GSAP if available
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(this.lightboxImage,
                { scale: 0.85, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }
            );
        }

        this.updateImage(item);
    }

    close() {
        if (!this.lightbox) return;

        if (typeof gsap !== 'undefined') {
            gsap.to(this.lightbox, {
                opacity: 0,
                duration: 0.25,
                onComplete: () => {
                    this.lightbox.classList.remove('active');
                    this.lightbox.style.display = 'none';
                    this.lightbox.style.opacity = '';
                    this.lightbox.setAttribute('aria-hidden', 'true');
                    document.body.style.overflow = '';
                    this.currentImageId = null;
                }
            });
        } else {
            this.lightbox.classList.remove('active');
            this.lightbox.style.display = 'none';
            this.lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            this.currentImageId = null;
        }
    }
}

// Initialize lightbox when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Make gallery data available globally for lightbox navigation
        window.galleryData = window.galleryData || [];

        // Get gallery data if available
        const galleryScript = document.querySelector('script[data-gallery-data]');
        if (galleryScript) {
            try {
                window.galleryData = JSON.parse(galleryScript.textContent);
            } catch (e) {
                console.warn('Could not parse gallery data:', e);
            }
        }

        window.lightbox = new Lightbox();
    });
} else {
    window.galleryData = window.galleryData || [];
    window.lightbox = new Lightbox();
}

// Make gallery data available globally (when Gallery class is loaded)
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Gallery to initialize and expose data
    setTimeout(() => {
        if (!window.galleryData && typeof Gallery !== 'undefined') {
            // Gallery class should have already set this
        }
    }, 100);
});
