class SystemCleanerService {
  private cleaningEnabled = true;
  private lastCleanup: string | null = null;

  isCleaningEnabled() {
    return this.cleaningEnabled;
  }

  setCleaningEnabled(value: boolean) {
    this.cleaningEnabled = value;
  }

  getLastCleanupTime() {
    return this.lastCleanup;
  }

  async cleanup() {
    if (!this.cleaningEnabled) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    this.lastCleanup = new Date().toISOString();
    if (typeof window !== 'undefined') {
      console.info('[SystemCleanerService] Cleanup completed at', this.lastCleanup);
    }
  }
}

export const systemCleanerService = new SystemCleanerService();
