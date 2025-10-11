
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');

// Temporarily force enable activity persistence for testing
const ENABLE = true; // process.env.ENABLE_ACTIVITY_PERSIST === '1';
const dir = path.join(__dirname, '..', 'data');
const file = path.join(dir, 'activity.log.jsonl');
const MAX = 10000;
const ROTATE_MB = parseInt(process.env.ACTIVITY_ROTATE_MB || '10', 10);

let ring = [];
let rotating = false;
let partCounter = 0;
let currentMonthKey = new Date().toISOString().slice(0,7); // YYYY-MM

function ensure() {
  if (!ENABLE) return;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '');
}

function hydrate() {
  if (!ENABLE || !fs.existsSync(file)) return;
  const tempRing = [];
  const readable = fs.createReadStream(file, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: readable, crlfDelay: Infinity });
  rl.on('line', (line) => {
    try { if (line.trim()) { tempRing.push(JSON.parse(line)); if (tempRing.length > MAX) tempRing.shift(); } } catch {}
  });
  rl.on('close', () => { ring = tempRing; console.log(`[ActivityStore] Hydrated ${ring.length} events from log.`); });
}

function monthKeyFromTs(tsIso) { const d = new Date(tsIso || Date.now()); return isNaN(d.getTime()) ? currentMonthKey : d.toISOString().slice(0,7); }
function shouldRotateBySize() { try { const st = fs.statSync(file); return (st.size/(1024*1024)) >= ROTATE_MB; } catch { return false; } }
function rotateNow(done) {
  if (rotating) return done && done();
  rotating = true;
  try {
    const outName = `activity.log.${currentMonthKey}.part${partCounter++}.jsonl.gz`;
    const outPath = path.join(dir, outName);
    const inp = fs.createReadStream(file);
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(outPath);
    inp.on('error', () => { rotating = false; done && done(); });
    out.on('finish', () => { try { fs.truncateSync(file, 0); } catch {} rotating = false; done && done(); });
    inp.pipe(gzip).pipe(out);
  } catch { rotating = false; done && done(); }
}

function append(evt) {
  // Always accept activity events (temporarily disable ENABLE check for testing)
  console.log('💾 Activity Store: Appending event:', evt.actionType, 'Enable:', ENABLE);
  const now = Date.now();
  const key = [evt?.author?.name, evt?.actionType, evt?.details?.file].join('|');
  if (ring.length && (now - new Date(ring[ring.length-1]?.timestamp).getTime() < 3000)) {
    const lastKey = [ring[ring.length-1]?.author?.name, ring[ring.length-1]?.actionType, ring[ring.length-1]?.details?.file].join('|');
    if (key === lastKey) return;
  }
  ring.push(evt); if (ring.length > MAX) ring = ring.slice(-MAX);

  const evtMonth = monthKeyFromTs(evt.timestamp);
  const write = () => fs.appendFile(file, JSON.stringify(evt) + '\n', ()=>{});
  if (evtMonth !== currentMonthKey || shouldRotateBySize()) {
    if (evtMonth !== currentMonthKey) { currentMonthKey = evtMonth; partCounter = 0; }
    rotateNow(write);
  } else { write(); }
}

function query({ limit = 100, author, actionType }) {
  return ring.filter(e => (author ? e?.author?.name === author : true))
             .filter(e => (actionType ? e?.actionType === actionType : true))
             .slice(-limit).reverse();
}

// Replay helpers
function parseId(id) { const [ts, ctr] = String(id || '').split('-'); return { ts: Number(ts)||0, ctr: Number(ctr)||0 }; }
function lastId() { const last = ring[ring.length-1]; return last?.id || null; }
function getSince(sinceId, limit=200) {
  if (!sinceId) return ring.slice(-limit);
  const pivot = parseId(sinceId); const out=[];
  for (const e of ring) { const p = parseId(e.id); if (p.ts > pivot.ts || (p.ts === pivot.ts && p.ctr > pivot.ctr)) out.push(e); }
  return out.slice(-limit);
}
function seedMonotonic() { return parseId(lastId()); }

ensure(); hydrate();

module.exports = { append, query, stats: () => {
  const last24 = Date.now() - 24*3600e3;
  const recent = ring.filter(e => new Date(e.timestamp).getTime() >= last24);
  const byActor={}, byType={}; for (const e of recent){ byActor[e?.author?.name]=(byActor[e?.author?.name]||0)+1; byType[e?.actionType]=(byType[e?.actionType]||0)+1; }
  return { count: recent.length, byActor, byType };
}, parseId, lastId, getSince, seedMonotonic };
