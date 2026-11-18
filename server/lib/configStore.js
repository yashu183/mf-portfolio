// Writing portfolioConfig.json from the app. Every change goes through updateConfig, which
//   - runs one change at a time (two saves at once can't lose either),
//   - keeps a copy of the file as it was in .config-backups/ (the newest MAX_BACKUPS),
//   - writes a temp file and renames it over the real one, so a crash halfway never leaves half a file,
//   - writes the JSON the way it is written by hand: short flat objects on one line, the rest indented.
// The server reads the file on every request, so nothing needs a restart afterwards.
const path = require('path');
const fs = require('fs').promises;
const { CONFIG_PATH } = require('./config');

const BACKUP_DIR = path.join(path.dirname(CONFIG_PATH), '.config-backups');
const MAX_BACKUPS = 50;
const LINE_WIDTH = 140;

// ─── Formatting ───────────────────────────────────────────────────────────────
const isFlat = (value) => Object.values(value).every((v) => v === null || typeof v !== 'object');
const inline = (value) => {
    if (Array.isArray(value)) return value.length ? `[ ${value.map(inline).join(', ')} ]` : '[]';
    if (value && typeof value === 'object') {
        const entries = Object.entries(value);
        return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }` : '{}';
    }
    return JSON.stringify(value);
};

function format(value, indent = '') {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    const next = `${indent}  `;
    if (Array.isArray(value)) {
        if (!value.length) return '[]';
        // a short list of plain values stays on one line
        if (value.every((v) => v === null || typeof v !== 'object') && indent.length + inline(value).length <= LINE_WIDTH) {
            return inline(value);
        }
        return `[\n${value.map((v) => `${next}${format(v, next)}`).join(',\n')}\n${indent}]`;
    }
    // a short object of plain values (a lumpsum, a gold bar, an FD cycle) stays on one line
    if (isFlat(value) && indent.length + inline(value).length <= LINE_WIDTH) return inline(value);
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${format(v, next)}`).join(',\n')}\n${indent}}`;
}

// ─── Backups ──────────────────────────────────────────────────────────────────
async function backup(raw) {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(path.join(BACKUP_DIR, `portfolioConfig-${stamp}.json`), raw, 'utf-8');
    const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.startsWith('portfolioConfig-')).sort();
    await Promise.all(files.slice(0, Math.max(0, files.length - MAX_BACKUPS)).map((f) => fs.unlink(path.join(BACKUP_DIR, f))));
}

// ─── The one way in ───────────────────────────────────────────────────────────
let queue = Promise.resolve();

/**
 * Applies `change(config)` to portfolioConfig.json. `change` edits the config in place and returns what the
 * caller should send back; if it throws, nothing is written.
 */
function updateConfig(change) {
    const run = queue.then(async () => {
        const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);
        const result = await change(config);
        await backup(raw);
        const tmp = `${CONFIG_PATH}.${process.pid}.tmp`;
        await fs.writeFile(tmp, `${format(config)}\n`, 'utf-8');
        await fs.rename(tmp, CONFIG_PATH);
        return result;
    });
    queue = run.catch(() => {});
    return run;
}

module.exports = { updateConfig, format, CONFIG_PATH, BACKUP_DIR };
