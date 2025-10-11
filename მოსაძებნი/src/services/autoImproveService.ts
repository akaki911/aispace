import type { AutoUpdateKPIs, AutoUpdateRun, LiveEvent } from '../types/autoImprove';
import { mockDataGenerator } from './mockDataGenerator';

class AutoImproveService {
  private baseURL = '/api/ai/autoimprove';

  async fetchKPIs(): Promise<AutoUpdateKPIs> {
    try {
      console.log('🔍 [AutoImprove Service] KPIs-ების ჩატვირთვა...');

      const response = await fetch(`${this.baseURL}/kpis`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.warn('[AUTO-IMPROVE] KPIs API failed, using mock data');
        return mockDataGenerator.generateKPIs();
      }

      const data = await response.json();
      console.log('✅ [AutoImprove Service] რეალური KPIs ჩაიტვირთა:', data);

      // Return properly structured KPIs
      return data.kpis || {
        aiHealth: 'OK',
        backendHealth: 'OK',
        frontendHealth: 'OK',
        queueLength: 0,
        p95ResponseTime: 150,
        errorRate: 0,
        mode: 'real-data',
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.warn('[AUTO-IMPROVE] KPIs fetch error, falling back to mock data:', error);
      // Return fallback KPIs instead of throwing
      return mockDataGenerator.generateKPIs();
    }
  }

  async fetchHistory(limit: number = 20): Promise<AutoUpdateRun[]> {
    try {
      console.log('🔍 [AutoImprove Service] ისტორიის ჩატვირთვა...');

      const response = await fetch(`${this.baseURL}/history?limit=${limit}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.warn('[AUTO-IMPROVE] History API failed, using mock data');
        return mockDataGenerator.generateHistory(limit);
      }

      const data = await response.json();
      console.log('✅ [AutoImprove Service] რეალური ისტორია ჩაიტვირთა');
      return data.history || [];
    } catch (error) {
      console.warn('[AUTO-IMPROVE] History fetch error, falling back to mock data:', error);
      throw error; // Re-throw to handle properly in UI
    }
  }

  async controlAction(action: 'pause' | 'resume'): Promise<void> {
    const response = await fetch(`${this.baseURL}/monitor/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    if (!response.ok) {
      throw new Error(`Failed to ${action}`);
    }
  }

  async retryRun(runId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/monitor/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId })
    });

    if (!response.ok) {
      throw new Error('Failed to retry run');
    }
  }

  async rollbackRun(runId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/monitor/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId })
    });

    if (!response.ok) {
      throw new Error('Failed to rollback run');
    }
  }

  async exportData(format: 'csv' | 'json', runId?: string): Promise<Blob> {
    const url = `${this.baseURL}/monitor/export?format=${format}${runId ? `&runId=${runId}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to export data');
    }

    return response.blob();
  }

  setupSSE(
    onMessage: (event: MessageEvent) => void,
    onError: () => void,
    onOpen: () => void
  ): EventSource {
    console.log('🔗 [AutoImprove Service] SSE კავშირის ჩართვა...');

    const eventSource = new EventSource(`${this.baseURL}/monitor/stream`);

    eventSource.onmessage = onMessage;
    eventSource.onerror = (error) => {
      console.error('❌ [AutoImprove Service] SSE კავშირის შეცდომა:', error);
      onError();
    };
    eventSource.onopen = onOpen;

    return eventSource;
  }

  async generateProposals(): Promise<any> {
    try {
      console.log('🤖 [AutoImprove Service] შემოთავაზებების გენერაცია...');

      const response = await fetch('/api/ai/autoimprove/generate-proposals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ [AutoImprove Service] შემოთავაზებები გენერირდა:', data);
      return data;
    } catch (error) {
      console.error('❌ [AutoImprove Service] გენერაციის შეცდომა:', error);
      throw error;
    }
  }

  async analyzeCodebase(): Promise<any> {
    try {
      console.log('🔍 [AutoImprove Service] კოდბეისის ანალიზი...');

      const response = await fetch('/api/ai/autoimprove/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ [AutoImprove Service] კოდბეისის ანალიზი დასრულდა:', data);
      return data;
    } catch (error) {
      console.error('❌ [AutoImprove Service] ანალიზის შეცდომა:', error);
      throw error;
    }
  }
}

export const autoImproveService = new AutoImproveService();