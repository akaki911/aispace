
// backend/routes/files_apply.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const PROJECT_ROOT = path.resolve(process.cwd());

// traversal-ის პრევენცია
function safeResolve(relPath) {
  const abs = path.resolve(PROJECT_ROOT, relPath);
  if (!abs.startsWith(PROJECT_ROOT)) {
    const err = new Error('BAD_PATH');
    err.status = 400;
    throw err;
  }
  return abs;
}

// POST /api/files/apply  { path: "src/...", content: "..." }
router.post('/apply', express.json({ limit: '2mb' }), (req, res) => {
  try {
    const { path: rel, content } = req.body || {};
    if (!rel || typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'bad_payload' });
    }
    const abs = safeResolve(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    return res.json({ ok: true, path: rel });
  } catch (e) {
    const code = e.status || (e.message === 'BAD_PATH' ? 400 : 500);
    return res.status(code).json({ ok: false, error: e.message || 'apply_failed' });
  }
});

module.exports = router;
