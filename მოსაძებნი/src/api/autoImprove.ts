// @ts-nocheck

import { APIResponse, Proposal } from '../types/aimemory';

class AutoImproveAPI {
  private baseURL = '/api/ai/autoimprove';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async listProposals(): Promise<APIResponse<Proposal[]>> {
    try {
      const data = await this.request<any>('/proposals');

      const proposals = Array.isArray(data?.proposals)
        ? data.proposals
        : Array.isArray(data?.data)
          ? data.data
          : [];

      return {
        success: typeof data?.success === 'boolean' ? data.success : true,
        data: proposals,
        message: typeof data?.message === 'string' ? data.message : undefined,
        count: typeof data?.count === 'number' ? data.count : proposals.length,
        timestamp: data?.timestamp,
      };
    } catch (error) {
      throw new Error(`🔐 ავთენტიფიკაციის შეცდომა: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProposal(id: string): Promise<Proposal> {
    const response = await this.request<{ proposal: Proposal }>(`/proposals/${id}`);
    return response.proposal;
  }

  async dryRun(proposalId: string): Promise<any> {
    return this.request(`/dry-run/validate`, {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    });
  }

  async approve(proposalId: string): Promise<any> {
    return this.request(`/proposals/${proposalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ userId: '01019062020', dryRunPassed: true }),
    });
  }

  async apply(proposalId: string): Promise<any> {
    return this.request(`/proposals/${proposalId}/apply`, {
      method: 'POST',
    });
  }

  async rollback(proposalId: string, reason?: string): Promise<any> {
    return this.request(`/${proposalId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reject(proposalId: string, reason?: string): Promise<any> {
    return this.request(`/proposals/${proposalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async requestEdit(proposalId: string, note?: string): Promise<any> {
    return this.request(`/proposals/${proposalId}/request-edit`, {
      method: 'POST',
      body: JSON.stringify({ note })
    });
  }

  async getFeatureFlags(): Promise<any> {
    return this.request('/feature-flags');
  }

  async getMetrics(timeRange: string = '30d', scope: string = 'all'): Promise<any> {
    return this.request(`/metrics?timeRange=${timeRange}&scope=${scope}`);
  }

  async getProgress(sessionId: string): Promise<any> {
    return this.request(`/progress/${sessionId}`);
  }

  // AI Guard endpoints
  async validateGuard(filePath: string, operation: string = 'modify'): Promise<any> {
    return this.request('/guard/validate', {
      method: 'POST',
      body: JSON.stringify({ filePath, operation }),
    });
  }

  async getGuardAudit(limit: number = 50): Promise<any> {
    return this.request(`/guard/audit?limit=${limit}`);
  }

  async getGuardConfig(): Promise<any> {
    return this.request('/guard/config');
  }
}

export const autoImproveAPI = new AutoImproveAPI();
export const autoImproveApi = autoImproveAPI;

// Export types
export type { Proposal };
