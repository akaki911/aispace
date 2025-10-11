
// src/lib/env.ts
export function getApiBaseURL() {
  // პრიორიტეტი: VITE_AI_SERVICE_URL → VITE_API_URL → relative
  const env = import.meta.env;
  const c1 = env?.VITE_AI_SERVICE_URL?.trim();
  const c2 = env?.VITE_API_URL?.trim();

  if (c1) return c1.replace(/\/+$/, '');
  if (c2) return c2.replace(/\/+$/, '');

  // ფოლბექი: იგივე origin-ზე პროქსირებული ბექენდი (vite proxy / nginx)
  return '';
}
