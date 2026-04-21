const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { exec } = require('child_process');

const app  = express();
const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, '.admin-config.json');

// Load / initialize config
let config = { username: 'Admin', password: 'changeme' };
if (fs.existsSync(CONFIG_FILE)) {
    try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (_) {}
} else {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// In-memory sessions: token → { username, lastActive }
const sessions = new Map();

// Expire sessions inactive for 5 minutes
const SESSION_TTL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    sessions.forEach((val, key) => {
        if (now - val.lastActive > SESSION_TTL) sessions.delete(key);
    });
}, 60_000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── helpers ───────────────────────────────────────────────────────────────────

function parseCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach(c => {
        const [k, ...v] = c.trim().split('=');
        if (k) out[k.trim()] = decodeURIComponent(v.join('='));
    });
    return out;
}

function requireAuth(req, res, next) {
    const { session } = parseCookies(req);
    const data = sessions.get(session);
    if (data) {
        data.lastActive = Date.now();
        req.username = data.username;
        return next();
    }
    // SSE requests can't handle redirects — send JSON 401 instead
    const wantsSSE = req.headers.accept === 'text/event-stream';
    if (wantsSSE) return res.status(401).end();
    res.redirect('/login.html');
}

function loadGalleryEntries() {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/gallery.js'), 'utf8');
    const m = src.match(/const galleryData\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return [];
    // eslint-disable-next-line no-new-func
    return (new Function(`return ${m[1]};`))();
}

function countImages(dir) {
    if (!fs.existsSync(dir)) return 0;
    let total = 0;
    try {
        fs.readdirSync(dir).forEach(folder => {
            const sub = path.join(dir, folder);
            if (fs.statSync(sub).isDirectory()) {
                total += fs.readdirSync(sub).filter(f => /\.(jpg|jpeg|png|webp|heic)$/i.test(f)).length;
            }
        });
    } catch (_) {}
    return total;
}

// ── static ────────────────────────────────────────────────────────────────────

app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.get('/login.html', (_req, res) => res.sendFile(path.join(ROOT, 'login.html')));

// ── auth routes ───────────────────────────────────────────────────────────────

app.get('/login',      (_req, res) => res.sendFile(path.join(ROOT, 'login.html')));
app.get('/login.html', (_req, res) => res.sendFile(path.join(ROOT, 'login.html')));

app.post('/api/auth', (req, res) => {
    const { username, password } = req.body;
    if (username === config.username && password === config.password) {
        const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessions.set(sid, { username, lastActive: Date.now() });
        res.setHeader('Set-Cookie', `session=${sid}; Path=/; HttpOnly; SameSite=Strict`);
        return res.json({ ok: true });
    }
    res.status(401).json({ ok: false, error: 'Invalid username or password' });
});

app.post('/api/logout', (req, res) => {
    sessions.delete(parseCookies(req).session);
    res.setHeader('Set-Cookie', 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({ username: req.username });
});

// Extend session (client pings this to signal activity)
app.post('/api/ping', requireAuth, (_req, res) => res.json({ ok: true }));

// ── protected pages ───────────────────────────────────────────────────────────

app.get('/', requireAuth, (_req, res) => res.sendFile(path.join(ROOT, 'admin.html')));

// ── API: stats ────────────────────────────────────────────────────────────────

app.get('/api/stats', requireAuth, (_req, res) => {
    try {
        const entries = loadGalleryEntries();
        const cats = {}, folders = new Set();
        entries.forEach(e => {
            cats[e.category] = (cats[e.category] || 0) + 1;
            folders.add(e.folder);
        });
        const optimizedCount = countImages(path.join(ROOT, 'assets/images-optimized'));
        res.json({ total: entries.length, folders: folders.size, categories: cats, optimized: optimizedCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── API: folders ──────────────────────────────────────────────────────────────

app.get('/api/folders', requireAuth, (_req, res) => {
    const optimizedDir = path.join(ROOT, 'assets/images-optimized');
    const originalsDir = path.join(ROOT, 'assets/images');
    try {
        const result = fs.readdirSync(optimizedDir)
            .filter(f => fs.statSync(path.join(optimizedDir, f)).isDirectory())
            .sort()
            .map(folder => {
                const files     = fs.readdirSync(path.join(optimizedDir, folder));
                const optimized = files.filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f)).length;
                const origPath  = path.join(originalsDir, folder);
                const originals = fs.existsSync(origPath)
                    ? fs.readdirSync(origPath).filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f)).length
                    : 0;
                return { folder, optimized, originals };
            });
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── API: gallery entries (paginated) ──────────────────────────────────────────

app.get('/api/gallery', requireAuth, (req, res) => {
    try {
        const entries = loadGalleryEntries();
        const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
        const limit = Math.max(1, parseInt(req.query.limit || '50', 10));
        const folder = req.query.folder || '';
        const cat    = req.query.category || '';
        const q      = (req.query.q || '').toLowerCase();

        let filtered = entries;
        if (folder) filtered = filtered.filter(e => e.folder === folder);
        if (cat)    filtered = filtered.filter(e => e.category === cat);
        if (q)      filtered = filtered.filter(e =>
            (e.title   || '').toLowerCase().includes(q) ||
            (e.caption || '').toLowerCase().includes(q) ||
            (e.folder  || '').toLowerCase().includes(q) ||
            (e.tags || []).some(t => t.toLowerCase().includes(q))
        );

        const total  = filtered.length;
        const sliced = filtered.slice((page - 1) * limit, page * limit);
        res.json({ total, page, limit, entries: sliced });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── API: update entry ─────────────────────────────────────────────────────────

app.patch('/api/gallery/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

        const galleryFile = path.join(ROOT, 'assets/js/gallery.js');
        let src = fs.readFileSync(galleryFile, 'utf8');
        const { caption, category, tags } = req.body;

        if (caption !== undefined) {
            src = src.replace(
                new RegExp(`(id: ${id}[\\s\\S]*?caption: ')[^']*(')`),
                (_, pre, post) => `${pre}${caption.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}${post}`
            );
        }
        if (category !== undefined) {
            src = src.replace(
                new RegExp(`(id: ${id}[\\s\\S]*?category: ')[^']*(')`),
                (_, pre, post) => `${pre}${category}${post}`
            );
        }
        if (tags !== undefined) {
            const tagsStr = JSON.stringify(tags).replace(/"/g, "'");
            src = src.replace(
                new RegExp(`(id: ${id}[\\s\\S]*?tags: )\\[[^\\]]*\\]`),
                (_, pre) => `${pre}${tagsStr}`
            );
        }

        fs.writeFileSync(galleryFile, src, 'utf8');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── API: delete entry ─────────────────────────────────────────────────────────

app.delete('/api/gallery/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

        const galleryFile = path.join(ROOT, 'assets/js/gallery.js');
        const entries = loadGalleryEntries().filter(e => e.id !== id);

        // Rewrite gallery.js with the entry removed
        const src = fs.readFileSync(galleryFile, 'utf8');
        const header = src.match(/^[\s\S]*?const galleryData\s*=/)[0].replace(/const galleryData\s*=$/, '').trimEnd();
        const js = `${header}\nconst galleryData = ${JSON.stringify(entries, null, 4).replace(/"([^"]+)":/g, '$1:').replace(/"/g, "'")
};\n`;
        fs.writeFileSync(galleryFile, js, 'utf8');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── SSE helper ────────────────────────────────────────────────────────────────

function startSSE(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    return (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ── API: regenerate gallery.js (SSE) ─────────────────────────────────────────

app.get('/api/regenerate', requireAuth, (req, res) => {
    const emit = startSSE(res);

    const script = path.join(ROOT, 'generate-gallery-data.js');
    if (!fs.existsSync(script)) {
        emit({ type: 'error', msg: '❌ generate-gallery-data.js not found' });
        return res.end();
    }

    // Count total images to show progress
    const total = countImages(path.join(ROOT, 'assets/images-optimized'));
    let done = 0;

    emit({ type: 'start', msg: '🔄 Scanning gallery images…', progress: { done: 0, total, skipped: 0, errors: 0 } });

    const child = exec(`node "${script}"`, { cwd: ROOT });

    child.stdout.on('data', chunk => {
        chunk.toString().split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;
            // Count scanned files from output
            const match = line.match(/gallery\.js written with (\d+) entries/);
            if (match) done = parseInt(match[1], 10);
            emit({ type: 'log', msg: line, progress: { done, total, skipped: 0, errors: 0 } });
        });
    });

    child.stderr.on('data', chunk => {
        chunk.toString().split('\n').forEach(line => {
            line = line.trim();
            if (line) emit({ type: 'warn', msg: `⚠ ${line}`, progress: { done, total, skipped: 0, errors: 0 } });
        });
    });

    child.on('close', code => {
        if (code === 0) {
            emit({ type: 'done', msg: `✅ Done! ${done} entries written to gallery.js`, progress: { done, total, skipped: 0, errors: 0 } });
        } else {
            emit({ type: 'error', msg: `❌ Process exited with code ${code}`, progress: { done, total, skipped: 0, errors: 0 } });
        }
        res.end();
    });
});

// ── API: optimize images (SSE) ────────────────────────────────────────────────

app.get('/api/optimize', requireAuth, (req, res) => {
    const emit = startSSE(res);

    const script = path.join(ROOT, 'optimize-images.js');
    if (!fs.existsSync(script)) {
        emit({ type: 'error', msg: '❌ optimize-images.js not found' });
        return res.end();
    }

    // Pre-count total source images
    const total = countImages(path.join(ROOT, 'assets/images'));
    let done = 0, skipped = 0, errors = 0, removed = 0;

    emit({ type: 'start', msg: `🖼 Found ${total} images to process…`, progress: { done, total, skipped, errors, removed } });

    const child = exec(`node "${script}"`, { cwd: ROOT, maxBuffer: 50 * 1024 * 1024 });

    child.stdout.on('data', chunk => {
        chunk.toString().split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;

            let type = 'log';
            if (/✓/.test(line))         { done++;    type = 'progress'; }
            else if (/skip/.test(line)) { skipped++; type = 'progress'; }
            else if (/✗/.test(line))    { errors++;  type = 'warn'; }
            else if (/🗑/.test(line))   { removed++; type = 'log'; }

            emit({ type, msg: line, progress: { done, total, skipped, errors, removed } });
        });
    });

    child.stderr.on('data', chunk => {
        chunk.toString().split('\n').forEach(line => {
            line = line.trim();
            if (line) { errors++; emit({ type: 'warn', msg: `⚠ ${line}`, progress: { done, total, skipped, errors, removed } }); }
        });
    });

    child.on('close', code => {
        const removedPart = removed > 0 ? `, ${removed} removed` : '';
        if (code === 0) {
            emit({ type: 'done', msg: `✅ Done! ${done} processed, ${skipped} skipped, ${errors} errors${removedPart}`, progress: { done, total, skipped, errors, removed } });
        } else {
            emit({ type: 'error', msg: `❌ Process exited with code ${code}`, progress: { done, total, skipped, errors, removed } });
        }
        res.end();
    });
});

// ── API: settings ─────────────────────────────────────────────────────────────

app.post('/api/settings', requireAuth, (req, res) => {
    const { username, password } = req.body;
    if (username !== undefined) {
        if (!username || username.trim().length < 2)
            return res.status(400).json({ error: 'Username must be at least 2 characters' });
        const oldUsername = req.username;
        config.username = username.trim();
        sessions.forEach((val, key) => { if (val.username === oldUsername) val.username = config.username; });
    }
    if (password !== undefined) {
        if (!password || password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        config.password = password;
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    res.json({ ok: true });
});

module.exports = app;
