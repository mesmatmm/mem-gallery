/**
 * optimize-images.js
 * Converts original images from assets/images/ into:
 *   - assets/images-optimized/  (WebP, max 1920px, quality 85)
 *   - assets/images-thumbs/     (WebP, max 480px,  quality 75)
 * Skips already-processed files. Tracks progress in .optimization-manifest.json
 * Removes optimized/thumb files whose originals no longer exist (sync).
 */

const sharp  = require('sharp');
const fs     = require('fs');
const path   = require('path');

const ROOT          = __dirname;
const ORIGINALS_DIR = path.join(ROOT, 'assets/images');
const OPTIMIZED_DIR = path.join(ROOT, 'assets/images-optimized');
const THUMBS_DIR    = path.join(ROOT, 'assets/images-thumbs');
const MANIFEST_FILE = path.join(ROOT, '.optimization-manifest.json');

const OPTIMIZED_WIDTH = 1920;
const THUMB_WIDTH     = 480;
const OPTIMIZED_QUALITY = 85;
const THUMB_QUALITY     = 75;

const SUPPORTED      = /\.(jpg|jpeg|png|webp|heic|tiff|gif)$/i;
const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.HEIC', '.JPG', '.JPEG', '.PNG', '.tiff', '.gif'];

// Load manifest of already-processed files
let manifest = {};
if (fs.existsSync(MANIFEST_FILE)) {
    try { manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); } catch (_) {}
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function removeIfEmpty(dir) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
    }
}

function originalExistsForStem(folder, stem) {
    const origFolder = path.join(ORIGINALS_DIR, folder);
    if (!fs.existsSync(origFolder)) return false;
    return SUPPORTED_EXTS.some(ext => fs.existsSync(path.join(origFolder, stem + ext)));
}

// Remove optimized + thumb files that have no matching original
function syncOrphans() {
    let removed = 0;

    // Check each folder in images-optimized/
    if (fs.existsSync(OPTIMIZED_DIR)) {
        const folders = fs.readdirSync(OPTIMIZED_DIR)
            .filter(f => fs.statSync(path.join(OPTIMIZED_DIR, f)).isDirectory());

        for (const folder of folders) {
            const origFolderPath = path.join(ORIGINALS_DIR, folder);

            // Entire original folder gone → remove both optimized and thumbs folders
            if (!fs.existsSync(origFolderPath)) {
                fs.rmSync(path.join(OPTIMIZED_DIR, folder), { recursive: true, force: true });
                const thumbFolder = path.join(THUMBS_DIR, folder);
                if (fs.existsSync(thumbFolder)) {
                    fs.rmSync(thumbFolder, { recursive: true, force: true });
                }
                // Clean manifest entries for this folder
                const prefix = folder + path.sep;
                Object.keys(manifest).forEach(k => {
                    if (k === folder || k.startsWith(prefix) || k.startsWith(folder + '/')) {
                        delete manifest[k];
                    }
                });
                console.log(`  🗑  removed folder: ${folder}`);
                removed++;
                continue;
            }

            // Check individual files inside this folder
            const optimizedFiles = fs.readdirSync(path.join(OPTIMIZED_DIR, folder))
                .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f));

            for (const file of optimizedFiles) {
                const stem = file.replace(/\.[^.]+$/, '');
                if (!originalExistsForStem(folder, stem)) {
                    // Delete optimized file
                    const optPath = path.join(OPTIMIZED_DIR, folder, file);
                    if (fs.existsSync(optPath)) fs.unlinkSync(optPath);
                    // Delete thumbnail
                    const thumbPath = path.join(THUMBS_DIR, folder, file);
                    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
                    // Remove manifest entries for this stem
                    Object.keys(manifest).forEach(k => {
                        const kFolder = path.dirname(k);
                        const kStem   = path.basename(k).replace(/\.[^.]+$/, '');
                        if (kFolder === folder && kStem === stem) delete manifest[k];
                    });
                    console.log(`  🗑  removed orphan: ${folder}/${file}`);
                    removed++;
                }
            }

            // Remove folder if now empty
            removeIfEmpty(path.join(OPTIMIZED_DIR, folder));
            removeIfEmpty(path.join(THUMBS_DIR, folder));
        }
    }

    // Also clean up any orphan thumb folders not present in optimized
    if (fs.existsSync(THUMBS_DIR)) {
        const thumbFolders = fs.readdirSync(THUMBS_DIR)
            .filter(f => fs.statSync(path.join(THUMBS_DIR, f)).isDirectory());

        for (const folder of thumbFolders) {
            if (!fs.existsSync(path.join(ORIGINALS_DIR, folder))) {
                fs.rmSync(path.join(THUMBS_DIR, folder), { recursive: true, force: true });
                console.log(`  🗑  removed orphan thumb folder: ${folder}`);
                removed++;
            }
        }
    }

    if (removed > 0) {
        console.log(`\n  Removed ${removed} orphaned file(s)/folder(s)`);
    }
    return removed;
}

async function processImage(folder, filename) {
    const srcPath       = path.join(ORIGINALS_DIR, folder, filename);
    const stem          = filename.replace(/\.[^.]+$/, '');
    const outFilename   = `${stem}.webp`;
    const optimizedPath = path.join(OPTIMIZED_DIR, folder, outFilename);
    const thumbPath     = path.join(THUMBS_DIR,    folder, outFilename);

    const key = path.join(folder, filename);

    // Skip if already processed and source hasn't changed
    const stat = fs.statSync(srcPath);
    if (manifest[key] && manifest[key].mtime === stat.mtimeMs) {
        console.log(`  skip  ${key}`);
        return;
    }

    ensureDir(path.join(OPTIMIZED_DIR, folder));
    ensureDir(path.join(THUMBS_DIR,    folder));

    // Optimized version
    await sharp(srcPath)
        .rotate()                           // auto-rotate from EXIF
        .resize({ width: OPTIMIZED_WIDTH, withoutEnlargement: true })
        .webp({ quality: OPTIMIZED_QUALITY })
        .toFile(optimizedPath);

    // Thumbnail version
    await sharp(srcPath)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbPath);

    manifest[key] = { mtime: stat.mtimeMs, processed: Date.now() };
    console.log(`  ✓  ${key}`);
}

async function main() {
    if (!fs.existsSync(ORIGINALS_DIR)) {
        console.log('No assets/images/ folder found. Add original photos there first.');
        process.exit(0);
    }

    // 1. Remove orphaned optimized/thumb files first
    console.log('\n🔍 Syncing orphaned files…');
    syncOrphans();

    // 2. Process originals
    const folders = fs.readdirSync(ORIGINALS_DIR)
        .filter(f => fs.statSync(path.join(ORIGINALS_DIR, f)).isDirectory())
        .sort();

    if (folders.length === 0) {
        console.log('No folders found in assets/images/. Nothing to do.');
        fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
        process.exit(0);
    }

    let total = 0, done = 0, skipped = 0, errors = 0;

    for (const folder of folders) {
        const files = fs.readdirSync(path.join(ORIGINALS_DIR, folder))
            .filter(f => SUPPORTED.test(f))
            .sort();

        if (files.length === 0) continue;

        console.log(`\n📁 ${folder}  (${files.length} images)`);
        total += files.length;

        for (const file of files) {
            try {
                const key  = path.join(folder, file);
                const stat = fs.statSync(path.join(ORIGINALS_DIR, folder, file));
                if (manifest[key] && manifest[key].mtime === stat.mtimeMs) {
                    skipped++;
                } else {
                    done++;
                }
                await processImage(folder, file);
            } catch (err) {
                errors++;
                console.error(`  ✗  ${file}: ${err.message}`);
            }
        }
    }

    // Save manifest
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

    console.log(`\n─────────────────────────────────────`);
    console.log(`Total:     ${total}`);
    console.log(`Processed: ${done}`);
    console.log(`Skipped:   ${skipped}`);
    if (errors) console.log(`Errors:    ${errors}`);
    console.log(`\n✅ Done! Run generate-gallery-data.js next to update gallery.js.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
