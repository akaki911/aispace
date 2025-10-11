
const express = require('express');
const router = express.Router();
const { logActivity } = require('../services/activity_bus');
const store = require('../utils/activity_store');
const { verify } = require('../utils/activity_hmac');

router.post('/', express.json(), (req,res) => {
  const sig = req.header('X-Activity-Signature') || req.body.sig;
  const payload = { ...(req.body||{}) }; delete payload.sig;
  const ver = verify(payload, sig);
  if (!ver.ok) return res.status(403).json({ ok:false, error: ver.error || 'Invalid signature' });

  const allowed = new Set(['SUPER_ADMIN','Gurulo','Replit Assistant']);
  if (!payload?.author?.name || !allowed.has(payload.author.name)) return res.status(400).json({ ok:false, error:'Invalid author' });
  if (!payload?.actionType || !payload?.summary) return res.status(400).json({ ok:false, error:'Missing fields' });
  if (!payload?.timestamp) return res.status(400).json({ ok:false, error:'Missing timestamp' });

  const evt = logActivity({ ...payload, verified: ver });
  res.json({ ok:true, id: evt.id, verified: ver });
});

router.get('/', (req,res)=> { const {limit,author,actionType}=req.query; res.json({ ok:true, data: store.query({ limit: parseInt(limit||'100',10), author, actionType }) }); });
router.get('/stats', (_req,res)=> res.json(store.stats()));

// Dev-only diag: emit 3 sample events (no HMAC)
router.get('/diag', (_req,res) => {
  const now = new Date().toISOString();
  logActivity({ author:{name:'SUPER_ADMIN',type:'USER'},       actionType:'CONFIG_UPDATED',   summary:'Diag: memory updated',  details:{file:'memory',description:'debug'}, timestamp:now });
  logActivity({ author:{name:'Gurulo',type:'INTERNAL_AI'},     actionType:'AI_COMMAND',       summary:'Diag: AI refactor',     details:{file:'src/App.tsx',description:'debug'}, timestamp:now });
  logActivity({ author:{name:'Replit Assistant',type:'EXTERNAL_AI'}, actionType:'FILE_MODIFIED', summary:'Diag: patched file',    details:{file:'backend/index.js',description:'debug'}, timestamp:now });
  res.json({ ok:true, emitted:3 });
});



module.exports = router;
