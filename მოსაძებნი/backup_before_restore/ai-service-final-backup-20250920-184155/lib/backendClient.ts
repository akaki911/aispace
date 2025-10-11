
import axios from 'axios';

interface Proposal {
  title: string;
  severity: 'P1' | 'P2' | 'P3';
  summary: string;
  evidence: Array<{
    file: string;
    line: number;
    rule: string;
    note: string;
  }>;
  patch: {
    type: 'unified';
    diff: string;
  };
  risk?: 'low' | 'medium' | 'high';
  rollbackPlan?: string;
}

class BackendClient {
  private baseUrl: string;
  private timeout: number = 15000;

  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5002';
  }

  async submitProposal(proposal: Proposal): Promise<any> {
    try {
      console.log(`🔗 [BACKEND-CLIENT] Submitting proposal: ${proposal.title}`);
      console.log(`🔗 [BACKEND-CLIENT] Target URL: ${this.baseUrl}/api/ai/autoimprove/proposals`);
      
      const payload = {
        title: proposal.title,
        severity: proposal.severity,
        summary: proposal.summary,
        evidence: proposal.evidence,
        patch: proposal.patch,
        risk: proposal.risk || 'low',
        rollbackPlan: proposal.rollbackPlan || 'Manual review and revert if needed'
      };

      console.log(`🔗 [BACKEND-CLIENT] Payload size: ${JSON.stringify(payload).length} chars`);

      const response = await axios.post(
        `${this.baseUrl}/api/ai/autoimprove/proposals`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ai-service',
            'X-Service-Token': 'ai-service-internal'
          },
          withCredentials: true
        }
      );

      if (response.data?.ok) {
        console.log(`✅ [BACKEND-CLIENT] Proposal submitted successfully: ${response.data.data?.id}`);
        return response.data;
      } else {
        throw new Error(response.data?.error || 'Backend rejected proposal');
      }

    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || error.response.statusText;
        console.error(`❌ [BACKEND-CLIENT] HTTP ${status}: ${message}`);
        throw new Error(`Backend error (${status}): ${message}`);
      } else if (error.request) {
        console.error('❌ [BACKEND-CLIENT] Network error:', error.message);
        throw new Error(`Network error: ${error.message}`);
      } else {
        console.error('❌ [BACKEND-CLIENT] Request setup error:', error.message);
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.warn('⚠️ [BACKEND-CLIENT] Backend health check failed:', error.message);
      return false;
    }
  }
}

export const backendClient = new BackendClient();
