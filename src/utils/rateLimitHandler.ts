class RateLimitManager {
  private cooldownUntil = 0;

  shouldThrottle(): boolean {
    return Date.now() < this.cooldownUntil;
  }

  registerFailure(retryAfterMs = 1000) {
    this.cooldownUntil = Date.now() + retryAfterMs;
  }
}

export const rateLimitManager = new RateLimitManager();
