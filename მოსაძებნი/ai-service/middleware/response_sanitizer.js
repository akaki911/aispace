// SOL-206: Response sanitizer with persona & grammar guard
// Ensures Gurulo responses follow ownership/Replit policies and Georgian grammar

function sanitizeGuruloReply(out, lastUserMessage = '') {
  console.log('🔧 [SOL-206] Sanitizer called with:', { hasOut: !!out, msgLength: lastUserMessage?.length });
  if (!out || typeof out !== 'string') return out;
  
  const userSaidReplit = /replit/i.test(lastUserMessage || '');
  let s = out.trim();
  
  // მისალმების დუბლირების შემცირება
  s = s.replace(/^(გამარჯობა[!！]?\s*\n?){2,}/i, 'გამარჯობა\n');
  
  // პერსონა: არასდროს თქვას, რომ არის აკაკი
  s = s.replace(/მე\s+ვარ\s+აკაკი(\s+ცინცაძე)?/gi, 'მე ვარ გურულო');
  
  // უნებლიე ფაილ-წვდომის დაპირება → სწორი ფრაზა
  s = s.replace(/მე\s+ვ(ა)?მზადებ\s+ფაილ(ებს)?\s*რეპლიტზე/gi,
                'ფაილებზე პირდაპირი წვდომა არ მაქვს; ზუსტ ინსტრუქციებს მოგიმზადებთ');
  
  // გრამატიკა (სწრაფი ფიქსები)
  s = s.replace(/რა საკითხი აქვს თქვენ/gi, 'რა საკითხი გაქვთ');
  s = s.replace(/\bმე\s+ამზადებ\b/gi, 'მე ვამზადებ');
  s = s.replace(/გასაამცირებელ(ად|ი)/gi, 'გასარკვევად');
  
  // Replit-ის ავტო-ხსენების თავიდან აცილება — თუ მომხმარებელმა არ ახსენა
  if (!userSaidReplit) {
    s = s.replace(/\bReplit\b/gi, 'პროექტის სერვერი/რეპოზიტორია');
    s = s.replace(/\bრე(პლ|პლიტ)[^\s]*/gi, 'პროექტის სერვერი/რეპოზიტორია');
  }
  
  // HTTP 500 — ჩეკლისტის დამატება, თუ ეტაპები არ ჩანს
  if (/HTTP\s*500/i.test(s) && !/[•\-]\s/.test(s)) {
    s += `

დიაგნოსტიკის ჩეკლისტი (500):
- მოგვაწოდეთ ბოლო 50 ლოგი AI სერვისიდან.
- გადაამოწმეთ /api/ai/health (მოელით 200).
- შეამოწმეთ GROQ_API_KEY, ქსელი და მოდელის სახელი.
- Request-ID / stack trace დაურთეთ ზუსტი ლოკაციისთვის.`;
  }
  
  console.log('🔧 [SOL-206] Sanitizer result:', { inputLength: out?.length, outputLength: s?.length });
  return s;
}

module.exports = { sanitizeGuruloReply };