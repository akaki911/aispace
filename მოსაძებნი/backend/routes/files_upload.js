
// backend/routes/files_upload.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// tmp/attachments საქაღალდე
const UPLOAD_DIR = path.resolve(process.cwd(), 'tmp', 'attachments');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// უსაფრთხო სახელები
function safeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]/g, '_')
    .slice(-120);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}__${safeName(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB × 5
  fileFilter: (_req, file, cb) => {
    // ტექსტური/კოდის/JSON/და (სურვილისამებრ) სურათების მხარდაჭერა
    const ok = /^(text\/|image\/|application\/(json|javascript|typescript|xml|yaml|x-yaml))/i.test(file.mimetype);
    if (!ok) return cb(Object.assign(new Error('UNSUPPORTED_TYPE'), { code: 'UNSUPPORTED_TYPE' }));
    cb(null, true);
  }
});

// POST /api/files/upload  (multipart/form-data, field name: "files")
router.post('/upload', upload.array('files', 5), (req, res) => {
  const items = (req.files || []).map(f => ({
    id: path.basename(f.path),
    name: f.originalname,
    size: f.size,
    mime: f.mimetype,
    url: `/api/files/attachment/${path.basename(f.path)}`
  }));
  res.json({ ok: true, items });
});

// GET /api/files/attachment/:id — ჩამოტვირთვა/ჩანართისთვის
router.get('/attachment/:id', (req, res) => {
  const fileId = req.params.id;
  const abs = path.resolve(UPLOAD_DIR, fileId);
  if (!abs.startsWith(UPLOAD_DIR)) return res.status(400).json({ ok: false, error: 'bad_path' });
  if (!fs.existsSync(abs)) return res.status(404).json({ ok: false, error: 'not_found' });
  res.sendFile(abs);
});

module.exports = router;
