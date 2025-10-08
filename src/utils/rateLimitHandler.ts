class RateLimitManager {
  private readonly backoffMap = new Map<string, number>();

  registerBackoff(key: string, delayMs: number) {
    if (delayMs <= 0) {
      this.backoffMap.delete(key);
      return;
    }
    const expiresAt = Date.now() + delayMs;
    this.backoffMap.set(key, expiresAt);
  }

  reset(key: string) {
    this.backoffMap.delete(key);
  }

  isPollingDisabled(key: string) {
    const until = this.backoffMap.get(key) ?? 0;
    return until > Date.now();
  }

  getBackoffDelay(key: string) {
    const until = this.backoffMap.get(key) ?? 0;
    if (until <= Date.now()) {
      return 0;
    }
    return until - Date.now();
  }
}

export const rateLimitManager = new RateLimitManager();
