/**
 * Typewriter Effect for Hero Tagline
 * Cycles through phrases with typing and deleting animation
 */

class Typewriter {
    constructor(elementSelector) {
        this.element = document.querySelector(elementSelector);
        if (!this.element) return;

        this.phrases = [
            'Framing life',
            'Chasing light',
            'Telling stories',
            'Capturing moments'
        ];

        this.phraseIndex = 0;
        this.charIndex = 0;
        this.isDeleting = false;
        this.typingSpeed = 120;
        this.deletingSpeed = 80;
        this.pauseTime = 2000;
        this.isInitial = true;

        // Check for reduced motion preference
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (this.prefersReducedMotion) {
            this.showStaticPhrase();
        } else {
            this.type();
        }
    }

    showStaticPhrase() {
        // If reduced motion is preferred, just show one phrase with fade effect
        this.element.textContent = this.phrases[0];
        this.element.style.transition = 'opacity 1s ease';

        setInterval(() => {
            this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
            this.element.style.opacity = '0';

            setTimeout(() => {
                this.element.textContent = this.phrases[this.phraseIndex];
                this.element.style.opacity = '1';
            }, 500);
        }, 4000);
    }

    type() {
        const current = this.phrases[this.phraseIndex];

        if (this.isDeleting) {
            this.element.textContent = current.substring(0, this.charIndex - 1);
            this.charIndex--;
        } else {
            this.element.textContent = current.substring(0, this.charIndex + 1);
            this.charIndex++;
        }

        let speed = this.typingSpeed;

        if (!this.isDeleting && this.charIndex === current.length) {
            // Pause after typing complete
            setTimeout(() => {
                this.isDeleting = true;
                this.type();
            }, this.pauseTime);
            return;
        } else if (this.isDeleting && this.charIndex === 0) {
            // Move to next phrase
            this.isDeleting = false;
            this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
            setTimeout(() => this.type(), 200);
            return;
        }

        speed = this.isDeleting ? this.deletingSpeed : this.typingSpeed;
        setTimeout(() => this.type(), speed);
    }
}

// Initialize typewriter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Typewriter('.tagline');
});
