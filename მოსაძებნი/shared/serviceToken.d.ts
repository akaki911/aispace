export interface ServiceAuthConfig {
  key: string;
  type: 'shared' | 'legacy' | 'fallback';
  secret: string;
  ttlSeconds: number;
  signOptions: Record<string, unknown>;
  verifyOptions: Record<string, unknown>;
  isFallback: boolean;
}

export interface CreateServiceTokenOptions {
  service?: string;
  role?: string;
  permissions?: string[];
  ttlSeconds?: number;
  expiresIn?: number | string;
  issuer?: string;
  audience?: string;
  algorithm?: string;
  iat?: number;
}

export interface CreateServiceTokenPayload {
  svc?: string;
  service?: string;
  role?: string;
  permissions?: string[];
  type?: string;
  iat?: number;
  [key: string]: unknown;
}

export interface VerifyServiceTokenResult {
  decoded: Record<string, unknown> & { permissions?: string[]; service?: string; svc?: string; role?: string };
  config: ServiceAuthConfig;
}

export function createServiceToken(payload?: CreateServiceTokenPayload, options?: CreateServiceTokenOptions): string;
export function verifyServiceToken(token: string, overrides?: { verifyOptions?: Record<string, unknown> }): VerifyServiceTokenResult;
export function getServiceAuthConfigs(): ServiceAuthConfig[];
export const DEFAULT_SERVICE_SECRET: string;
export const DEFAULT_SERVICE_TOKEN_TTL: number;
export const LEGACY_AUDIENCE: string;
export const LEGACY_ISSUER: string;
