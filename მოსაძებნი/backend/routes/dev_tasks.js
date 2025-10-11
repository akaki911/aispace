// backend/routes/dev_tasks.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();
const ROOT = path.resolve(process.cwd());
const IGNORE = new Set(['node_modules', '.git', '.cache', 'tmp', 'dist', 'build']);

// optional env gate: DEV tasks off by default
const DEV_TASKS_ENABLED = process.env.DEV_TASKS_ENABLED === 'true';

// shallow file scan (with optional sample list)
function scanDir(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      // limit depth 4
      if ((acc.depth || 0) > 3) continue;
      scanDir(p, { ...acc, depth: (acc.depth || 0) + 1 });
    } else {
      acc.files.push(p.replace(ROOT + path.sep, ''));
      if (acc.files.length > 5000) break; // hard cap
    }
  }
}

router.get('/scan-files', (req, res) => {
  const files = [];
  scanDir(ROOT, { files, depth: 0 });
  const sample = files.slice(0, 50);
  res.json({ ok: true, total: files.length, sample });
});

// very safe npm installer (whitelist, no arbitrary shell)
function validatePkg(input) {
  // e.g. "multer" or "@types/node@^20"
  return /^[a-z0-9@/_\-]+(@[0-9A-Za-z.*^~<>=\-+]+)?$/i.test(input);
}

router.post('/install', express.json(), (req, res) => {
  if (!DEV_TASKS_ENABLED) return res.status(403).json({ ok: false, error: 'disabled' });
  const { pkg } = req.body || {};
  if (!pkg || !validatePkg(pkg)) return res.status(400).json({ ok: false, error: 'bad_pkg' });

  const pm = process.env.PACKAGE_MANAGER || 'npm';
  const args = pm === 'pnpm' ? ['add', pkg] : pm === 'yarn' ? ['add', pkg] : ['install', pkg, '--no-audit', '--no-fund'];

  const child = spawn(pm, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', d => (out += d.toString()));
  child.stderr.on('data', d => (err += d.toString()));
  child.on('close', code => {
    res.json({ ok: code === 0, code, out: out.slice(-4000), err: err.slice(-4000), pm, args });
  });
});

module.exports = router;