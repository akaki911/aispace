
/**
 * GitHub Integration Frontend Testing Utilities
 * Tests GitHub functionality from the frontend perspective
 */

export interface GitHubTestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
}

export class GitHubFrontendTester {
  private results: GitHubTestResult[] = [];

  async testBranchesPagination(): Promise<GitHubTestResult> {
    try {
      console.log('🔄 Testing branches pagination...');
      
      const response = await fetch('/api/ai/github/branches?per_page=1&page=1');
      const data = await response.json();
      
      if (response.ok) {
        const hasBranches = data.branches && Array.isArray(data.branches);
        const result = {
          test: 'Branches Pagination',
          success: hasBranches,
          message: hasBranches ? 'Branches API working' : 'No branches data',
          details: {
            branchCount: data.branches?.length || 0,
            pagination: data.pagination || 'none'
          }
        };
        this.results.push(result);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const result = {
        test: 'Branches Pagination',
        success: false,
        message: `Pagination test failed: ${err.message}`,
        details: { error: err.message }
      };
      this.results.push(result);
      return result;
    }
  }

  async testPushFlow(): Promise<GitHubTestResult> {
    try {
      console.log('🔄 Testing push workflow...');
      
      // Test if push endpoint exists and responds
      const response = await fetch('/api/ai/github/status', {
        method: 'GET'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const hasRemote = data.remoteUrl && data.remoteUrl !== null;
        const result = {
          test: 'Push Flow Readiness',
          success: hasRemote,
          message: hasRemote ? 'Push flow ready' : 'No remote configured',
          details: {
            connected: data.connected,
            remoteUrl: data.remoteUrl ? 'configured' : 'missing',
            hasChanges: data.hasChanges
          }
        };
        this.results.push(result);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const result = {
        test: 'Push Flow Readiness',
        success: false,
        message: `Push test failed: ${err.message}`,
        details: { error: err.message }
      };
      this.results.push(result);
      return result;
    }
  }

  async testConflictHandling(): Promise<GitHubTestResult> {
    try {
      console.log('🔄 Testing conflict handling...');
      
      // Test non-existent PR merge to see error handling
      const response = await fetch('/api/ai/github/pulls/999999/mergeable', {
        method: 'GET'
      });
      
      // We expect this to fail gracefully
      if (response.status === 404 || response.status === 400) {
        const result = {
          test: 'Conflict Handling',
          success: true,
          message: 'Error handling works correctly',
          details: {
            expectedError: true,
            status: response.status,
            message: 'Correctly handles non-existent resources'
          }
        };
        this.results.push(result);
        return result;
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const result = {
        test: 'Conflict Handling',
        success: false,
        message: `Conflict handling test failed: ${err.message}`,
        details: { error: err.message }
      };
      this.results.push(result);
      return result;
    }
  }

  async testWebhookEndpoints(): Promise<GitHubTestResult> {
    try {
      console.log('🔄 Testing webhook endpoints...');
      
      const response = await fetch('/api/ai/github/webhook/github/security-status');
      const data = await response.json();
      
      if (response.ok) {
        const isConfigured = data.success && data.secretConfigured;
        const result = {
          test: 'Webhook Configuration',
          success: isConfigured,
          message: isConfigured ? 'Webhooks properly configured' : 'Webhook configuration incomplete',
          details: {
            secretConfigured: data.secretConfigured,
            securityEnabled: data.securityEnabled,
            integration: data.integration
          }
        };
        this.results.push(result);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const result = {
        test: 'Webhook Configuration',
        success: false,
        message: `Webhook test failed: ${err.message}`,
        details: { error: err.message }
      };
      this.results.push(result);
      return result;
    }
  }

  async runAllTests(): Promise<GitHubTestResult[]> {
    console.log('🚀 Starting GitHub Frontend Tests...\n');
    
    this.results = [];
    
    await this.testBranchesPagination();
    await this.testPushFlow();
    await this.testConflictHandling();
    await this.testWebhookEndpoints();
    
    console.log('\n📊 Frontend Test Summary:');
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    console.log(`✅ Passed: ${passed}/${this.results.length}`);
    console.log(`❌ Failed: ${failed}/${this.results.length}`);
    
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.message}`);
    });
    
    return this.results;
  }

  getResults(): GitHubTestResult[] {
    return this.results;
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testGitHubIntegration = async () => {
    const tester = new GitHubFrontendTester();
    return await tester.runAllTests();
  };
}

export default GitHubFrontendTester;
