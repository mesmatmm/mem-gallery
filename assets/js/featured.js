/**
 * Featured Gallery on Home Page
 * Displays curated or random sample images with sophisticated animations
 */

/**
 * Curated Series Configuration
 * Set enabled to true and fill in imageIds to display a hand-picked collection
 * Otherwise, random images will be shown
 */
const curatedSeriesConfig = {
    enabled: false,
    title: "A Curated Series",
    description: "Hand-picked moments from my favorite captures",
    imageIds: []
    // Example: imageIds: [1, 5, 12, 23, 34, 45]
};

class FeaturedGallery {
    constructor(displayCount = 6) {
        this.displayCount = displayCount;
        this.container = document.getElementById('featuredGrid');
        this.curatedContainer = document.getElementById('curatedGrid');
        this.curatedSection = document.getElementById('curatedSection');
        this.curatedDescription = document.getElementById('curatedDescription');
        this.init();
    }

    init() {
        if (!this.container || !galleryData || galleryData.length === 0) {
            console.warn('Featured gallery data not available');
            return;
        }

        // Check if curated series is enabled and has images
        if (curatedSeriesConfig.enabled && curatedSeriesConfig.imageIds.length > 0) {
            this.renderCuratedSeries();
        }

        // Get random samples for main featured section
        const samples = this.getRandomSamples(galleryData, this.displayCount);

        // Render featured items
        this.renderFeatured(samples);

        // Trigger animations
        this.animateItems();
    }

    getRandomSamples(data, count) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    getCuratedImages() {
        const images = galleryData.filter(item =>
            curatedSeriesConfig.imageIds.includes(item.id)
        );
        // Maintain the order from imageIds
        return curatedSeriesConfig.imageIds
            .map(id => images.find(img => img.id === id))
            .filter(Boolean);
    }

    renderCuratedSeries() {
        if (!this.curatedContainer || !this.curatedSection) return;

        const curatedImages = this.getCuratedImages();
        if (curatedImages.length === 0) return;

        // Show the curated section
        this.curatedSection.style.display = 'block';

        // Update description if provided
        if (this.curatedDescription && curatedSeriesConfig.description) {
            this.curatedDescription.textContent = curatedSeriesConfig.description;
        }

        // Clear existing content
        this.curatedContainer.innerHTML = '';

        // Render curated items
        curatedImages.forEach((item, index) => {
            const article = document.createElement('article');
            article.className = 'curated-item';
            article.style.animationDelay = `${index * 0.1}s`;

            article.innerHTML = `
                <img
                    src="${item.thumbnail}"
                    alt="${item.folder}"
                    loading="lazy"
                />
                <div class="curated-item-label">
                    ${item.folder}
                </div>
            `;

            article.addEventListener('click', () => {
                window.location.href = 'gallery.html';
            });

            this.curatedContainer.appendChild(article);
        });

        // Animate curated items
        this.animateCuratedItems();
    }

    animateCuratedItems() {
        if (!this.curatedContainer) return;

        const items = this.curatedContainer.querySelectorAll('.curated-item');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -50px 0px'
        });

        items.forEach(item => observer.observe(item));
    }

    renderFeatured(samples) {
        this.container.innerHTML = '';

        samples.forEach((item, index) => {
            const article = document.createElement('article');
            article.className = 'featured-item';
            article.style.animationDelay = `${index * 0.1}s`;

            article.innerHTML = `
                <div class="featured-image-wrapper">
                    <img
                        src="${item.thumbnail}"
                        alt="${item.folder}"
                        loading="lazy"
                        class="featured-image"
                    />
                    <div class="featured-overlay">
                        <div class="featured-content">
                            <h3>${item.folder}</h3>
                        </div>
                    </div>
                </div>
            `;

            article.addEventListener('click', () => {
                window.location.href = 'gallery.html';
            });

            this.container.appendChild(article);
        });
    }

    animateItems() {
        const items = this.container.querySelectorAll('.featured-item');

        // Use Intersection Observer for scroll animation
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -50px 0px'
        });

        items.forEach(item => observer.observe(item));
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new FeaturedGallery(6);
});
