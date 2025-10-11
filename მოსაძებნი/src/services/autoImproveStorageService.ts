
export interface AutoImproveState {
  proposals: any[];
  selectedProposal: any | null;
  appliedProposals: string[];
  validationResults: Record<string, any>;
  verificationResults: Record<string, any>;
  showPostApplyVerification: string | null;
  kpis: any;
  history: any[];
  liveEvents: any[];
  lastUpdateTimestamp: number;
  activeTab: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

class AutoImproveStorageService {
  private readonly STORAGE_KEY = 'auto-improve-state';
  private readonly STORAGE_VERSION = '1.0';

  // მონაცემების შენახვა
  saveState(state: Partial<AutoImproveState>): void {
    try {
      const currentState = this.loadState();
      const updatedState: AutoImproveState = {
        ...currentState,
        ...state,
        lastUpdateTimestamp: Date.now()
      };

      const storageData = {
        version: this.STORAGE_VERSION,
        state: updatedState,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData));
      console.log('✅ [AUTO-IMPROVE] მონაცემები შენახულია localStorage-ში');
    } catch (error) {
      console.error('❌ [AUTO-IMPROVE] მონაცემების შენახვის შეცდომა:', error);
    }
  }

  // მონაცემების ჩატვირთვა
  loadState(): AutoImproveState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultState();
      }

      const storageData = JSON.parse(stored);
      
      // ვერსიის შემოწმება
      if (storageData.version !== this.STORAGE_VERSION) {
        console.warn('⚠️ [AUTO-IMPROVE] მონაცემების ვერსია განსხვავებულია, ვიყენებთ ნაგულისხმევ მნიშვნელობებს');
        return this.getDefaultState();
      }

      // მონაცემების ასაკის შემოწმება (24 საათი)
      const savedAt = new Date(storageData.savedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        console.warn('⚠️ [AUTO-IMPROVE] მონაცემები ძველია (24 საათზე მეტი), ვასუფთავებთ');
        this.clearState();
        return this.getDefaultState();
      }

      console.log('✅ [AUTO-IMPROVE] მონაცემები ჩაიტვირთა localStorage-იდან');
      return storageData.state;
    } catch (error) {
      console.error('❌ [AUTO-IMPROVE] მონაცემების ჩატვირთვის შეცდომა:', error);
      return this.getDefaultState();
    }
  }

  // მონაცემების გასუფთავება
  clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ [AUTO-IMPROVE] localStorage გასუფთავდა');
    } catch (error) {
      console.error('❌ [AUTO-IMPROVE] localStorage-ის გასუფთავების შეცდომა:', error);
    }
  }

  // მხოლოდ განსაზღვრული ველების შენახვა
  savePartialState(partialState: Partial<AutoImproveState>): void {
    const currentState = this.loadState();
    this.saveState({ ...currentState, ...partialState });
  }

  // ნაგულისხმევი მდგომარეობა
  private getDefaultState(): AutoImproveState {
    return {
      proposals: [],
      selectedProposal: null,
      appliedProposals: [],
      validationResults: {},
      verificationResults: {},
      showPostApplyVerification: null,
      kpis: {
        aiHealth: 'OK',
        backendHealth: 'OK',
        frontendHealth: 'OK',
        queueLength: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        lastRunAt: '',
        mode: 'auto'
      },
      history: [],
      liveEvents: [],
      lastUpdateTimestamp: Date.now(),
      activeTab: 'overview',
      connectionStatus: 'connecting'
    };
  }

  // მონაცემების შემოწმება - არის თუ არა შენახული
  hasStoredState(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // მონაცემების ექსპორტი ბაქაპისთვის
  exportState(): string {
    const state = this.loadState();
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: this.STORAGE_VERSION,
      state
    }, null, 2);
  }

  // მონაცემების იმპორტი
  importState(exportedData: string): boolean {
    try {
      const data = JSON.parse(exportedData);
      if (data.version === this.STORAGE_VERSION && data.state) {
        this.saveState(data.state);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [AUTO-IMPROVE] იმპორტის შეცდომა:', error);
      return false;
    }
  }
}

export const autoImproveStorageService = new AutoImproveStorageService();
