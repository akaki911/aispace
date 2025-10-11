const crypto = require('crypto');
const SECRET = process.env.ACTIVITY_HMAC_SECRET || 'dev-secret';
const MAX_SKEW = parseInt(process.env.ACTIVITY_HMAC_MAX_SKEW_MS || '60000', 10);
const seen = new Map(); let sweep=0;

function sign(payload){ const data = typeof payload==='string'?payload:JSON.stringify(payload); return crypto.createHmac('sha256', SECRET).update(data).digest('hex'); }
function verify(payload, sig=''){
  if (!sig) return { ok:false, devMode: SECRET==='dev-secret', error:'Missing signature' };
  const ts = Date.parse(payload?.timestamp || ''); const now = Date.now();
  if (!ts || Math.abs(now - ts) > MAX_SKEW) return { ok:false, devMode: SECRET==='dev-secret', error:'Timestamp skew' };
  const expected = sign(payload);
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  if (!ok) return { ok:false, devMode: SECRET==='dev-secret', error:'Bad signature' };
  const exp = seen.get(sig); if (exp && exp > now) return { ok:false, devMode: SECRET==='dev-secret', error:'Replay' };
  seen.set(sig, now + MAX_SKEW);
  if (++sweep % 200 === 0) { const t=Date.now(); for (const [k,v] of seen) if (v<=t) seen.delete(k); }
  return { ok:true, devMode: SECRET==='dev-secret' };
}
module.exports = { sign, verify };