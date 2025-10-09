interface CleanupStats {
  cachesCleared: number;
  filesDeleted: number;
}

class SystemCleanerService {
  private cleaningEnabled = true;
  private lastCleanup: string | null = null;

  isCleaningEnabled(): boolean {
    return this.cleaningEnabled;
  }

  setCleaningEnabled(enabled: boolean) {
    this.cleaningEnabled = enabled;
  }

  getLastCleanupTime(): string | null {
    return this.lastCleanup;
  }

  async performManualCleanup(): Promise<CleanupStats> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.lastCleanup = new Date().toISOString();
    return {
      cachesCleared: Math.floor(Math.random() * 3) + 1,
      filesDeleted: Math.floor(Math.random() * 5) + 1,
    };
  }
}

export const systemCleanerService = new SystemCleanerService();
