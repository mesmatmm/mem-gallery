/**
 * Page Transition Handler
 * Creates smooth fade-out when navigating between pages
 * Fade-in is handled by CSS animation on body
 */

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        const target = link.getAttribute('target');

        // Skip: anchor links, external URLs, new tab, admin, mailto
        if (!href || href.startsWith('#') || href.startsWith('http://') || href.startsWith('https://') || target === '_blank') {
            return;
        }
        if (href.includes('admin') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }

        e.preventDefault();
        document.body.classList.add('page-exit');

        setTimeout(() => {
            window.location.href = href;
        }, 300);
    });
});
