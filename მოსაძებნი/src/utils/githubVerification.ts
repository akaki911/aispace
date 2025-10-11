
/**
 * GitHub Integration Verification Utility
 * Tests all GitHub endpoints and logs results to browser console
 */

export interface EndpointTestResult {
  endpoint: string;
  status: number;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export class GitHubEndpointsVerifier {
  private baseUrl: string = '';

  private endpoints = [
    '/api/ai/github/config',
    '/api/ai/github/_diag',
    '/api/ai/github/status',
    '/api/ai/github/status/detailed',
    '/api/ai/github/stats',
    '/api/ai/github/commits',
    '/api/ai/github/branches',
    '/api/ai/github/branches/status',
    '/api/ai/github/issues/stats'
  ];

  async verifyAllEndpoints(): Promise<EndpointTestResult[]> {
    console.group('🔍 GitHub Integration Endpoints Verification');
    console.log('Testing all GitHub endpoints for proper responses...');
    
    const results: EndpointTestResult[] = [];
    
    for (const endpoint of this.endpoints) {
      const result = await this.testEndpoint(endpoint);
      results.push(result);
    }
    
    this.logSummary(results);
    console.groupEnd();
    
    return results;
  }

  private async testEndpoint(endpoint: string): Promise<EndpointTestResult> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();
    
    console.group(`🔄 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`⏱️  Response Time: ${duration}ms`);
      console.log(`🌐 URL: ${url}`);
      
      let data: any = null;
      let error: string | undefined = undefined;
      
      try {
        data = await response.json();
        console.log('📊 Response Data:', data);
        
        // Additional validation for expected response structure
        if (endpoint.includes('/status') && !data.hasOwnProperty('connected')) {
          console.warn('⚠️  Status endpoint missing "connected" property');
        }
        
        if (endpoint.includes('/stats') && response.ok && !data.hasOwnProperty('openIssues')) {
          console.warn('⚠️  Stats endpoint missing expected properties');
        }
        
      } catch (jsonError) {
        error = 'Failed to parse JSON response';
        console.error('❌ JSON Parse Error:', jsonError);
      }
      
      const result: EndpointTestResult = {
        endpoint,
        status: response.status,
        success: response.ok,
        data,
        error: response.ok ? undefined : (error || `HTTP ${response.status}`),
        timestamp: new Date().toISOString()
      };
      
      if (response.ok) {
        console.log('✅ Endpoint Test PASSED');
      } else {
        console.error('❌ Endpoint Test FAILED');
      }
      
      console.groupEnd();
      return result;
      
    } catch (fetchError) {
      const result: EndpointTestResult = {
        endpoint,
        status: 0,
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Network error',
        timestamp: new Date().toISOString()
      };
      
      console.error('❌ Network Error:', fetchError);
      console.groupEnd();
      return result;
    }
  }

  private logSummary(results: EndpointTestResult[]) {
    console.group('📋 Verification Summary');
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`📊 Success Rate: ${Math.round((passed/total) * 100)}%`);
    
    if (failed > 0) {
      console.group('❌ Failed Endpoints');
      results.filter(r => !r.success).forEach(result => {
        console.error(`${result.endpoint}: ${result.status} - ${result.error}`);
      });
      console.groupEnd();
    }
    
    console.group('📊 Status Code Distribution');
    const statusCodes = results.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    Object.entries(statusCodes).forEach(([code, count]) => {
      const icon = code === '200' ? '✅' : code.startsWith('4') ? '⚠️' : '❌';
      console.log(`${icon} ${code}: ${count} endpoints`);
    });
    console.groupEnd();
    
    console.groupEnd();
  }

  // Quick verification function for development
  static async quickVerify(): Promise<void> {
    const verifier = new GitHubEndpointsVerifier();
    await verifier.verifyAllEndpoints();
  }
}

// Export for use in browser console
(window as any).verifyGitHubEndpoints = GitHubEndpointsVerifier.quickVerify;

export default GitHubEndpointsVerifier;
