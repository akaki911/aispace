class RateLimitManager {
  private cooldownUntil = 0;

  shouldThrottle(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  registerFailure(retryAfterMs = 1000) {
    this.cooldownUntil = Date.now() + retryAfterMs;
  }

  isPollingDisabled(_key: string): boolean {
    return this.shouldThrottle();
  }

  getBackoffDelay(_key: string): number {
    return Math.max(0, this.cooldownUntil - Date.now());
  }
}

export const rateLimitManager = new RateLimitManager();
