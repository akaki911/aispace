
export function relativeTime(iso: string){
  const t = new Date(iso).getTime(); const diff = Math.max(0, Date.now()-t);
  const m = Math.floor(diff/60000); if (m<1) return 'just now';
  if (m<60) return `${m} minute${m!==1?'s':''} ago`;
  const h = Math.floor(m/60); if (h<24) return `${h} hour${h!==1?'s':''} ago`;
  const d = Math.floor(h/24); return `${d} day${d!==1?'s':''} ago`;
}
