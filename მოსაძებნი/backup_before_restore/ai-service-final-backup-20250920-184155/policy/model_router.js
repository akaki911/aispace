'use strict';

/**
 * routeQuery(query: string): { policy: string, model: 'large' | 'small' | 'none' }
 *
 * Policies:
 * - 'GREETING'           -> model: 'none'   (სტატიკური პასუხი, API გამოძახების გარეშე)
 * - 'SIMPLE_QA'          -> model: 'small'  (მოკლე/ფაქტუალური/ზოგადი კითხვა)
 * - 'CODE_COMPLEX'       -> model: 'large'  (კოდის გენერაცია/დებაგი/შეცდომები)
 * - 'REASONING_COMPLEX'  -> model: 'large'  (გრძელი/მრავალსაფეხურიანი ანალიზი, არაკოდური)
 */

function normalize(q = '') {
  return String(q || '').trim();
}

function countWords(str = '') {
  return normalize(str).split(/\s+/).filter(Boolean).length;
}

function isLongOrComplex(str = '') {
  const text = normalize(str);
  const words = countWords(text);
  // გრძელი პრომპტი ან ბევრ წინადადებად დაყოფილი — მიმანიშნებელია რთულზე
  const sentences = text.split(/[.!?？！…]+/).filter(s => s.trim().length > 0).length;
  return words >= 40 || text.length >= 250 || sentences >= 3;
}

function routeQuery(query = '', opts = {}) {
  const q = normalize(query);
  const qLower = q.toLowerCase();
  const words = countWords(q);

  // Support manual override
  if (opts.modelOverride === 'small') {
    return { policy: 'MANUAL_OVERRIDE', model: 'small', overridden: true };
  }
  if (opts.modelOverride === 'large') {
    return { policy: 'MANUAL_OVERRIDE', model: 'large', overridden: true };
  }

  // --- GREETING: მოკლე მისალმება — განვტვირთოთ მოდელი საერთოდ
  // Only if message is short (<=8 words) and purely greeting-focused
  const GREETING_RE =
    /^(გამარჯობა|გაგიმარჯოთ|მოგესალმებ(ი|თ)|დილა\s+მშვიდობისა|შუადღე\s+მშვიდობისა|საღამო\s+მშვიდობისა|როგორ\s+ხარ\??|როგორ\s+ხართ\??|hello|hi|hey|good\s+(morning|afternoon|evening)|how\s+are\s+you\??)[\s\!\?\.\,]*$/i;
  
  if (GREETING_RE.test(qLower) && words <= 8) {
    return { policy: 'GREETING', model: 'none' };
  }

  // --- CODE_COMPLEX: კოდი/დებაგი/შეცდომები → დიდი მოდელი
  // მოიცავს troubleshooting-საც (error/debug/fix/не работает)
  const CODE_COMPLEX_RE =
    /(დამიწერე|კოდი(?!ფიკაცია)\b|snippet|regex|ფუნქცი(ა|ის|ებს)|component|კომპონენტი|hook|typescript|tsx\b|ts\b|js\b|node(\.js)?\b|express\b|nest(js)?\b|debug\b|refactor\b|fix\s+this|unit\s*test|test\s+case|type\s*error|stack\s*trace|ReferenceError|TypeError|SyntaxError|არ\s+მუშაობ(ს|და)|მაქვს\s+შეცდომა|ვერ\s+ვუშვ(ებ|რი)|error|exception|failed|cannot|doesn'?t\s+work)/i;
  if (CODE_COMPLEX_RE.test(qLower)) {
    return { policy: 'CODE_COMPLEX', model: 'large' };
  }

  // --- REASONING_COMPLEX: არაკოდური, მაგრამ რთული/გრძელი ამოცანები → დიდი მოდელი
  const REASONING_HINTS_RE =
    /(ამიხსენი|გაანალიზე|გაადათვალე|გადამიწყვიტე|დაგეგმე|იდეა(ები)?|სტრატეგი|შედარე|შეაფასე|განიხილე|რთული\s*ამოცანა|კომპლექსური|why\b|how\s+to\s+solve|break\s*down|analysis|strategy|compare|evaluate|trade[-\s]*offs)/i;
  
  // Georgian-specific complex reasoning patterns
  const GEORGIAN_COMPLEX_RE = 
    /(სრული\s*(ანალიზი|გააზრება)|დეტალური\s*ახსნა|ღრმა\s*ანალიზი|მრავალმხრივი\s*მიდგომა|კომპლექსური\s*პრობლემა|რთული\s*გადაწყვეტილება)/i;
  
  if (REASONING_HINTS_RE.test(qLower) || GEORGIAN_COMPLEX_RE.test(qLower) || isLongOrComplex(q)) {
    return { policy: 'REASONING_COMPLEX', model: 'large' };
  }

  // --- SIMPLE_QA: მოკლე/ზოგადი კითხვები → პატარა, სწრაფი მოდელი
  const SIMPLE_QA_RE =
    /(რა\s+არის|ვინ\s+არის|როდის\b|სად\b|რა\s+ნიშნავს|what\s+is\b|who\s+is\b|when\b|where\b|define\b|definition\b)/i;
  const shortEnough = countWords(q) <= 25 && q.length <= 160;
  if (SIMPLE_QA_RE.test(qLower) || shortEnough) {
    return { policy: 'SIMPLE_QA', model: 'small' };
  }

  // ნაგულისხმევად გადავიყვანოთ SIMPLE_QA-ში (ეკონომიური default)
  return { policy: 'SIMPLE_QA', model: 'small' };
}

module.exports = { routeQuery };