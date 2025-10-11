import { getAiServiceBaseURL } from '@/lib/env';
import { analyzeNetworkError, enhanceWithNetworkMetadata } from './networkErrorDetection';
import { getAdminAuthHeaders } from './adminToken';
import { mergeHeaders } from './httpHeaders';

type HttpMethod = RequestInit['method'];

const SAFE_DIRECT_AI_ENDPOINTS = new Set(['/api/ai/health', '/api/ai/models', '/api/ai/status']);
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504, 521, 522, 523, 524]);
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

const normalizePath = (input: string): string => {
  if (ABSOLUTE_URL_PATTERN.test(input)) {
    try {
      const url = new URL(input);
      return url.pathname.replace(/\/+$/, '') || '/';
    } catch (error) {
      console.warn('⚠️  [AI Fallback] Failed to normalise absolute URL:', error);
      return '/';
    }
  }

  const prefixed = input.startsWith('/') ? input : `/${input}`;
  const withoutQuery = prefixed.split('?')[0];
  return withoutQuery.replace(/\/+$/, '') || '/';
};

const isSafeGetRequest = (url: string, method?: HttpMethod): boolean => {
  const effectiveMethod = (method ?? 'GET').toUpperCase();
  if (effectiveMethod !== 'GET') {
    return false;
  }

  const path = normalizePath(url);
  return SAFE_DIRECT_AI_ENDPOINTS.has(path);
};

const normalizeBaseUrl = (base: string): string | null => {
  if (!base) {
    return null;
  }

  if (ABSOLUTE_URL_PATTERN.test(base)) {
    return base;
  }

  if (base.startsWith('//')) {
    return `https:${base}`;
  }

  if (/^[\w.-]+:\d+$/.test(base)) {
    return `http://${base}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(base, window.location.origin).toString();
    } catch (error) {
      console.warn('⚠️  [AI Fallback] Failed to resolve relative AI base URL:', error);
    }
  }

  return null;
};

export const buildDirectAiUrl = (url: string): string | null => {
  const base = normalizeBaseUrl(getAiServiceBaseURL());
  if (!base) {
    return null;
  }

  const path = normalizePath(url) || '/';

  try {
    return new URL(path, base).toString();
  } catch (error) {
    console.warn('⚠️  [AI Fallback] Failed to build direct AI URL:', error);
    return null;
  }
};

export const shouldUseDirectAiFallback = (url: string, init?: RequestInit): boolean => {
  return isSafeGetRequest(url, init?.method);
};

export interface DirectAiFetchResult {
  response: Response;
  usedFallback: boolean;
}

export const fetchWithDirectAiFallback = async (
  url: string,
  init: RequestInit = {},
): Promise<DirectAiFetchResult> => {
  const initWithHeaders: RequestInit = {
    ...init,
    headers: mergeHeaders({ Accept: 'application/json' }, getAdminAuthHeaders(), init.headers),
  };

  const initWithCredentials: RequestInit =
    initWithHeaders.credentials || initWithHeaders.credentials === 'omit'
      ? initWithHeaders
      : { ...initWithHeaders, credentials: 'include' as RequestCredentials };

  const candidates: Array<{ target: string; usedFallback: boolean }> = [
    { target: url, usedFallback: false },
  ];

  if (shouldUseDirectAiFallback(url, init)) {
    const directUrl = buildDirectAiUrl(url);
    if (directUrl && directUrl !== url) {
      candidates.push({ target: directUrl, usedFallback: true });
    }
  }

  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.target, initWithCredentials);

      if (!response.ok && !candidate.usedFallback && candidates.length > 1 && RETRYABLE_STATUS_CODES.has(response.status)) {
        response.body?.cancel?.();
        console.warn(
          `⚠️  [AI Fallback] ${candidate.target} responded with ${response.status}. Trying direct AI service next.`,
        );
        continue;
      }

      if (candidate.usedFallback) {
        console.info(`🔁 [AI Fallback] Direct AI service served ${normalizePath(url)}`);
      }

      return { response, usedFallback: candidate.usedFallback };
    } catch (error) {
      const analysis = analyzeNetworkError(error);
      const enriched = enhanceWithNetworkMetadata(error as Error, analysis);

      if (analysis.isNetworkError && !candidate.usedFallback && candidates.length > 1) {
        console.warn(
          `⚠️  [AI Fallback] Network error on ${candidate.target} (${analysis.code ?? 'network'}). Retrying via direct AI service.`,
        );
        lastError = enriched;
        continue;
      }

      throw enriched;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('AI request failed after fallback attempts');
};
