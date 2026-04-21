/**
 * Theme Toggle Functionality
 * Manages dark/light theme preference
 */

class ThemeManager {
    constructor() {
        this.themeKey = 'mem-gallery-theme';
        this.themeToggle = document.getElementById('themeToggle');
        this.htmlElement = document.documentElement;

        this.init();
    }

    init() {
        // Get saved theme or use system preference
        const savedTheme = localStorage.getItem(this.themeKey);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

        this.setTheme(initialTheme);

        // Attach event listener
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggle());
        }

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(this.themeKey)) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    setTheme(theme) {
        const isLight = theme === 'light';
        this.htmlElement.setAttribute('data-theme', theme);
        localStorage.setItem(this.themeKey, theme);
        this.updateThemeIcon(isLight);
    }

    toggle() {
        const currentTheme = this.htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    updateThemeIcon(isLight) {
        if (this.themeToggle) {
            this.themeToggle.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
        }
    }
}

// Mobile Navigation Handler
class MobileNav {
    constructor() {
        this.hamburger = document.getElementById('hamburger');
        this.navMenu = document.getElementById('navMenu');

        if (this.hamburger && this.navMenu) {
            this.hamburger.addEventListener('click', () => this.toggle());
        }
    }

    toggle() {
        const isActive = this.hamburger.classList.toggle('active');
        this.navMenu.classList.toggle('active');
        this.hamburger.setAttribute('aria-expanded', isActive);
    }
}

// Initialize theme manager and mobile nav when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ThemeManager();
        new MobileNav();
    });
} else {
    new ThemeManager();
    new MobileNav();
}
