/**
 * Cinematic / Fullscreen Mode Toggle
 * Hides UI elements for a immersive gallery experience
 */

class CinematicMode {
    constructor() {
        this.button = document.getElementById('fullscreenToggle');
        if (!this.button) return;

        this.isActive = false;

        // Add click handler
        this.button.addEventListener('click', () => this.toggle());

        // Allow ESC key to exit cinematic mode (only when lightbox is NOT open)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                const lightbox = document.getElementById('lightbox');
                const lightboxOpen = lightbox && (lightbox.style.display === 'flex' || lightbox.classList.contains('active'));
                if (!lightboxOpen) {
                    this.toggle();
                }
            }
        });
    }

    toggle() {
        if (this.isActive) {
            this.disable();
        } else {
            this.enable();
        }
    }

    enable() {
        document.body.classList.add('cinematic-mode');
        this.button.setAttribute('aria-pressed', 'true');
        this.button.title = 'Exit cinematic mode (ESC)';
        // not persisted
        this.isActive = true;
        this.showHint();
    }

    disable() {
        document.body.classList.remove('cinematic-mode');
        this.button.setAttribute('aria-pressed', 'false');
        this.button.title = 'Enter cinematic mode';
        // not persisted
        this.isActive = false;
        this.removeHint();
    }

    showHint() {
        if (document.getElementById('cinematic-hint')) return;
        const hint = document.createElement('div');
        hint.id = 'cinematic-hint';
        hint.textContent = 'Press ESC to exit cinematic mode';
        document.body.appendChild(hint);
        // Fade out after 3 seconds
        setTimeout(() => hint.classList.add('fade-out'), 3000);
        setTimeout(() => this.removeHint(), 3600);
    }

    removeHint() {
        const hint = document.getElementById('cinematic-hint');
        if (hint) hint.remove();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new CinematicMode();
});
