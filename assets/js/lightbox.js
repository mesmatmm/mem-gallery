/**
 * Lightbox Viewer
 * Manages fullscreen image viewing with keyboard and touch navigation.
 * - Auto-advances every 10 seconds; pauses while mouse is over the image.
 * - Navigation respects window.galleryData (kept in sync with active filter).
 */

const SLIDESHOW_DELAY = 10_000;

class Lightbox {
    constructor() {
        this.lightbox        = document.getElementById('lightbox');
        this.lightboxImage   = document.getElementById('lightboxImage');
        this.lightboxCaption = document.getElementById('lightboxCaption');
        this.lightboxClose   = document.getElementById('lightboxClose');
        this.lightboxPrev    = document.getElementById('lightboxPrev');
        this.lightboxNext    = document.getElementById('lightboxNext');
        this.lightboxBackdrop = document.querySelector('.lightbox-backdrop');

        this.currentImageId = null;
        this.touchStartX    = 0;
        this.touchEndX      = 0;

        this._slideshowTimer  = null;
        this._mouseOverImage  = false;

        this.attachEventListeners();
    }

    // ── Slideshow ─────────────────────────────────────────────────────────────

    _startSlideshow() {
        this._clearSlideshow();
        this._slideshowTimer = setTimeout(() => {
            if (!this._mouseOverImage) {
                this.nextImage();
                this._startSlideshow();
            } else {
                // Mouse is still over — keep checking every second
                this._waitForMouseLeave();
            }
        }, SLIDESHOW_DELAY);
    }

    _waitForMouseLeave() {
        this._clearSlideshow();
        this._slideshowTimer = setTimeout(() => {
            if (this._mouseOverImage) {
                this._waitForMouseLeave();
            } else {
                this.nextImage();
                this._startSlideshow();
            }
        }, 1000);
    }

    _clearSlideshow() {
        if (this._slideshowTimer) {
            clearTimeout(this._slideshowTimer);
            this._slideshowTimer = null;
        }
    }

    // ── Events ────────────────────────────────────────────────────────────────

    attachEventListeners() {
        if (this.lightboxClose)   this.lightboxClose.addEventListener('click',   () => this.close());
        if (this.lightboxPrev)    this.lightboxPrev.addEventListener('click',    () => { this.previousImage(); this._startSlideshow(); });
        if (this.lightboxNext)    this.lightboxNext.addEventListener('click',    () => { this.nextImage();     this._startSlideshow(); });
        if (this.lightboxBackdrop) this.lightboxBackdrop.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        if (this.lightbox) {
            this.lightbox.addEventListener('touchstart', (e) => this.handleTouchStart(e), false);
            this.lightbox.addEventListener('touchend',   (e) => this.handleTouchEnd(e),   false);
        }

        // Pause slideshow while hovering over the image
        const imageContainer = document.querySelector('.lightbox-image-container');
        const hoverTarget = imageContainer || this.lightboxImage;
        if (hoverTarget) {
            hoverTarget.addEventListener('mouseenter', () => { this._mouseOverImage = true; });
            hoverTarget.addEventListener('mouseleave', () => { this._mouseOverImage = false; });
        }

        if (this.lightboxImage) {
            this.lightboxImage.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    handleKeydown(e) {
        if (!this.lightbox || (this.lightbox.style.display !== 'flex' && !this.lightbox.classList.contains('active'))) return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousImage();
                this._startSlideshow();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextImage();
                this._startSlideshow();
                break;
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
        }
    }

    handleTouchStart(e) { this.touchStartX = e.changedTouches[0].screenX; }
    handleTouchEnd(e)   { this.touchEndX   = e.changedTouches[0].screenX; this.handleSwipe(); }

    handleSwipe() {
        const diff = this.touchStartX - this.touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) { this.nextImage(); } else { this.previousImage(); }
            this._startSlideshow();
        }
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    previousImage() { this.navigateImage(-1); }
    nextImage()     { this.navigateImage(1);  }

    navigateImage(direction) {
        const data = window.galleryData;
        if (!data || !data.length) return;

        const currentId    = parseInt(this.lightbox.dataset.currentId || this.currentImageId);
        const currentIndex = data.findIndex(item => item.id === currentId);

        // If current item not in the filtered set, start from the beginning
        const startIndex = currentIndex === -1 ? 0 : currentIndex;

        let nextIndex = startIndex + direction;
        if (nextIndex >= data.length) nextIndex = 0;
        else if (nextIndex < 0)       nextIndex = data.length - 1;

        this.updateImage(data[nextIndex]);
    }

    // ── Display ───────────────────────────────────────────────────────────────

    updateImage(item) {
        if (!this.lightboxImage || !this.lightboxCaption) return;

        // fullImage points to the gitignored originals folder — not available on GitHub Pages.
        // Fall back to the optimized WebP (1920px) which is always committed.
        const displaySrc = item.image;
        this.lightboxImage.onerror = null;

        const applyContent = () => {
            this.lightboxImage.src = displaySrc;
            this.lightboxImage.alt = item.folder;

            const title      = document.getElementById('lightboxTitle');
            const captionTxt = document.getElementById('lightboxCaptionText');
            const exif       = document.getElementById('lightboxExif');
            const label      = document.getElementById('lightboxImageLabel');

            if (title)      title.textContent = item.folder;
            if (label)      label.textContent = item.folder;
            if (captionTxt) captionTxt.style.display = 'none';

            if (exif && item.exif) {
                const parts = [item.exif.camera, item.exif.lens, item.exif.settings].filter(Boolean);
                exif.innerHTML = parts.map(p => `<span>${p}</span>`).join('');
            }

            this.lightbox.dataset.currentId = item.id;
        };

        if (typeof gsap !== 'undefined') {
            gsap.to(this.lightboxImage, {
                opacity: 0, duration: 0.2,
                onComplete: () => {
                    applyContent();
                    gsap.to(this.lightboxImage, { opacity: 1, duration: 0.3, ease: 'power2.out' });
                }
            });
        } else {
            this.lightboxImage.style.transition = 'opacity 0.3s ease-out';
            this.lightboxImage.style.opacity = '0.5';
            setTimeout(() => {
                applyContent();
                setTimeout(() => { this.lightboxImage.style.opacity = '1'; }, 10);
            }, 150);
        }
    }

    open(item) {
        if (!this.lightbox) return;

        this.lightbox.style.display = 'flex';
        this.lightbox.classList.add('active');
        this.lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (typeof gsap !== 'undefined') {
            gsap.fromTo(this.lightboxImage,
                { scale: 0.85, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.4, ease: 'power2.out' }
            );
        }

        this.updateImage(item);
        this._mouseOverImage = false;
        this._startSlideshow();
    }

    close() {
        if (!this.lightbox) return;
        this._clearSlideshow();
        this._mouseOverImage = false;

        if (typeof gsap !== 'undefined') {
            gsap.to(this.lightbox, {
                opacity: 0, duration: 0.25,
                onComplete: () => {
                    this.lightbox.classList.remove('active');
                    this.lightbox.style.display  = 'none';
                    this.lightbox.style.opacity  = '';
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.galleryData = window.galleryData || [];
        window.lightbox = new Lightbox();
    });
} else {
    window.galleryData = window.galleryData || [];
    window.lightbox = new Lightbox();
}
