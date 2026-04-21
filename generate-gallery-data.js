/**
 * generate-gallery-data.js
 * Scans assets/images-optimized/ and regenerates assets/js/gallery.js.
 * Preserves existing captions, tags, categories, and exif data.
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = __dirname;
const OPTIMIZED_DIR = path.join(ROOT, 'assets/images-optimized');
const THUMBS_DIR    = path.join(ROOT, 'assets/images-thumbs');
const ORIGINALS_DIR = path.join(ROOT, 'assets/images');
const OUTPUT_FILE   = path.join(ROOT, 'assets/js/gallery.js');

// Folder → default category mapping
const FOLDER_CATEGORIES = {
    'Cairo University':            'architecture',
    'Nahdet Misr Statue':          'architecture',
    'Streets':                     'street',
    'Segma':                       'street',
    'Exam Times':                  'street',
    'Ghibli Style':                'street',
    'Cats':                        'landscape',
    'Flowers':                     'landscape',
    'Greenery':                    'landscape',
    'Lab 5 Zoology - Fall 2024':   'landscape',
    'Random':                      'uncategorized',
    'ZOthers':                     'uncategorized',
};

// Folder → default tags mapping
const FOLDER_TAGS = {
    'Cairo University':            ['campus', 'building', 'landmarks', 'egypt'],
    'Nahdet Misr Statue':          ['monument', 'landmark', 'egypt', 'statue'],
    'Streets':                     ['street', 'city', 'urban', 'egypt'],
    'Segma':                       ['street', 'city', 'urban'],
    'Exam Times':                  ['street', 'campus', 'life'],
    'Ghibli Style':                ['art', 'ghibli', 'illustration'],
    'Cats':                        ['cats', 'animals', 'nature'],
    'Flowers':                     ['flowers', 'nature', 'garden'],
    'Greenery':                    ['nature', 'green', 'landscape'],
    'Lab 5 Zoology - Fall 2024':   ['nature', 'science', 'university'],
    'Random':                      ['random', 'miscellaneous'],
    'ZOthers':                     ['other'],
};

// Folder → default caption function
function defaultCaption(folder, filename) {
    const captions = {
        'Cairo University':           'Cairo University campus view',
        'Nahdet Misr Statue':         'Nahdet Misr monument',
        'Streets':                    'Street photography',
        'Segma':                      'Street scene',
        'Exam Times':                 'Campus life during exam season',
        'Ghibli Style':               'Ghibli-inspired artwork',
        'Cats':                       'A curious feline moment',
        'Flowers':                    'Blooming flowers',
        'Greenery':                   'Lush greenery',
        'Lab 5 Zoology - Fall 2024':  'Lab and nature study',
        'Random':                     'A captured moment',
        'ZOthers':                    'Photography',
    };
    return captions[folder] || 'A captured moment';
}

// Load existing gallery data to preserve metadata
function loadExistingData() {
    if (!fs.existsSync(OUTPUT_FILE)) return new Map();
    const src = fs.readFileSync(OUTPUT_FILE, 'utf8');
    const m = src.match(/const galleryData\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return new Map();
    try {
        // eslint-disable-next-line no-new-func
        const entries = (new Function(`return ${m[1]};`))();
        const map = new Map();
        entries.forEach(e => map.set(e.image, e));
        return map;
    } catch (_) {
        return new Map();
    }
}

function titleFromFilename(filename) {
    return filename
        .replace(/\.[^.]+$/, '')    // remove extension
        .replace(/[_-]/g, ' ')      // underscores/hyphens → spaces
        .replace(/\s+/g, ' ')
        .trim();
}

function findOriginal(folder, stem) {
    const origFolder = path.join(ORIGINALS_DIR, folder);
    if (!fs.existsSync(origFolder)) return null;
    const exts = ['.jpg', '.jpeg', '.png', '.heic', '.HEIC', '.JPG', '.JPEG', '.PNG'];
    for (const ext of exts) {
        const candidate = path.join(origFolder, stem + ext);
        if (fs.existsSync(candidate)) {
            return `assets/images/${folder}/${stem}${ext}`;
        }
    }
    return null;
}

function main() {
    const existing = loadExistingData();
    console.log(`Loaded ${existing.size} existing entries.`);

    const folders = fs.readdirSync(OPTIMIZED_DIR)
        .filter(f => fs.statSync(path.join(OPTIMIZED_DIR, f)).isDirectory())
        .sort();

    const entries = [];
    let id = 1;

    folders.forEach(folder => {
        const files = fs.readdirSync(path.join(OPTIMIZED_DIR, folder))
            .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f))
            .sort();

        files.forEach(file => {
            const imagePath     = `assets/images-optimized/${folder}/${file}`;
            const thumbPath     = `assets/images-thumbs/${folder}/${file}`;
            const stem          = file.replace(/\.[^.]+$/, '');
            const origPath      = findOriginal(folder, stem);

            // Preserve existing metadata if available
            const prev = existing.get(imagePath);

            const entry = {
                id,
                category: prev?.category || FOLDER_CATEGORIES[folder] || 'uncategorized',
                title:    prev?.title    || titleFromFilename(file),
                folder,
                image:    imagePath,
                thumbnail: thumbPath,
                caption:  prev?.caption  || defaultCaption(folder, file),
                tags:     prev?.tags     || FOLDER_TAGS[folder] || [],
                exif:     prev?.exif     || { camera: '', lens: '', settings: '' },
            };

            if (origPath) entry.fullImage = origPath;

            entries.push(entry);
            id++;
        });
    });

    const js = `/**
 * Gallery Functionality
 * AUTO-GENERATED by generate-gallery-data.js
 * Handles gallery rendering, filtering, search, navigation, and animations
 */

// Gallery data with real images, tags, and EXIF information
const galleryData = ${JSON.stringify(entries, null, 4).replace(/"([^"]+)":/g, '$1:').replace(/"/g, "'")};
`;

    fs.writeFileSync(OUTPUT_FILE, js, 'utf8');
    console.log(`✅ gallery.js written with ${entries.length} entries.`);
}

main();
