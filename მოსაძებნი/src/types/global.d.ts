export {}; // ensure this file is treated as a module

declare global {
  interface Window {
    _rateLimitNotified?: number;
    verifySystem?: () => Promise<void>;
    clearAllCaches?: () => Promise<void>;
    __errorTimeouts?: Set<ReturnType<typeof setTimeout>>;
  }
}
