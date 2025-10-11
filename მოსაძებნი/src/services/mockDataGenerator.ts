// @ts-nocheck

/**
 * 🎯 Mock Data Generator for Auto-Improve System
 * ავტო-გაუმჯობესების სისტემისთვის მოკ მონაცემების გენერატორი
 */

import type { 
  Proposal, 
  AutoUpdateKPIs, 
  AutoUpdateRun, 
  LiveEvent 
} from '../types/autoImprove';

export class MockDataGenerator {
  private static instance: MockDataGenerator;
  private georgianMessages: string[] = [
    '🔧 მომხმარებელი წარმატებით ავტორიზირებული - SUPER_ADMIN',
    '📊 Firebase Firestore კავშირი სტაბილურად მუშაობს',
    '⚡ API Request დამუშავდა - Response Time: 180ms',
    '💾 Redis Cache განახლება შესრულებულია',
    '📁 TypeScript ფაილები წარმატებით კომპილირდა',
    '🚨 Payment Gateway Error - Card Validation Failed',
    '⚠️ Memory Usage: 85% - Garbage Collection საჭიროა',
    '🐛 Debug: Request Timeout - 30s exceeded',
    '✅ Database Connection Pool Optimized',
    '🔍 File Analysis Complete - 15 issues found',
    '📈 Performance Metrics Updated',
    '🛡️ Security Scan Completed - No vulnerabilities',
    '🔄 Auto-backup process initiated',
    '💡 AI Suggestion: Optimize React components',
    '🎯 Load Balancer Health Check: OK',
    '📝 Log Rotation Completed Successfully',
    '🌐 CDN Cache Invalidation Started',
    '⚙️ Configuration Validation Passed',
    '🚀 Deployment Process Started',
    '📋 Code Quality Check: 92% Score'
  ];

  private georgianProposalTitles: string[] = [
    'React კომპონენტების ოპტიმიზაცია',
    'TypeScript ტიპების გაუმჯობესება',
    'API Response-ის ოპტიმიზაცია',
    'Database Query-ების ოპტიმიზაცია',
    'Frontend Bundle Size-ის შემცირება',
    'Error Handling-ის გაუმჯობესება',
    'Authentication Flow-ის უსაფრთხოება',
    'Performance Monitoring-ის დაყენება',
    'Code Splitting-ის იმპლემენტაცია',
    'Cache Strategy-ის ოპტიმიზაცია'
  ];

  private georgianProposalDescriptions: string[] = [
    'React კომპონენტების re-rendering-ის ოპტიმიზაცია useMemo და useCallback-ით',
    'TypeScript ინტერფეისების სრული ტიპიზაცია API Response-ებისთვის',
    'GraphQL Query-ების ოპტიმიზაცია N+1 Problem-ის გადასაჭრელად',
    'PostgreSQL Index-ების დამატება slow query-ების ოპტიმიზაციისთვის',
    'Webpack Bundle Analyzer-ის გამოყენება chunk size-ის შემცირებისთვის',
    'Global Error Boundary-ების იმპლემენტაცია React aplikation-ში',
    'JWT Token Refresh Mechanism-ის უსაფრთხო იმპლემენტაცია',
    'Prometheus Metrics-ების დაყენება Performance Monitoring-ისთვის',
    'React.lazy() და Suspense-ის გამოყენება Route-based Code Splitting-ისთვის',
    'Redis Cache-ის სტრატეგიის ოპტიმიზაცია TTL და Invalidation Pattern-ებით'
  ];

  public static getInstance(): MockDataGenerator {
    if (!MockDataGenerator.instance) {
      MockDataGenerator.instance = new MockDataGenerator();
    }
    return MockDataGenerator.instance;
  }

  /**
   * Generate realistic KPIs data
   * რეალისტური KPI მონაცემების გენერაცია
   */
  generateKPIs(): AutoUpdateKPIs {
    const healthStates: Array<'OK' | 'WARN' | 'ERROR'> = ['OK', 'WARN', 'ERROR'];
    const modes: Array<'auto' | 'manual' | 'paused'> = ['auto', 'manual', 'paused'];

    return {
      aiHealth: healthStates[Math.floor(Math.random() * healthStates.length)],
      backendHealth: healthStates[Math.floor(Math.random() * healthStates.length)],
      frontendHealth: healthStates[Math.floor(Math.random() * healthStates.length)],
      queueLength: Math.floor(Math.random() * 50),
      p95ResponseTime: Math.floor(Math.random() * 1000) + 100,
      errorRate: Math.floor(Math.random() * 10),
      lastRunAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      mode: modes[Math.floor(Math.random() * modes.length)]
    };
  }

  /**
   * Generate realistic proposals
   * რეალისტური შემოთავაზებების გენერაცია
   */
  generateProposals(count: number = 5): Proposal[] {
    const statuses: Array<'pending' | 'applied' | 'rejected' | 'validating'> =
      ['pending', 'applied', 'rejected', 'validating'];
    const priorities: Array<'low' | 'medium' | 'high' | 'critical'> =
      ['low', 'medium', 'high', 'critical'];
    const categories: Array<'performance' | 'security' | 'maintainability' | 'bug-fix'> =
      ['performance', 'security', 'maintainability', 'bug-fix'];
    const severities: Array<'P1' | 'P2' | 'P3'> = ['P1', 'P2', 'P3'];

    return Array.from({ length: count }, (_, i) => ({
      id: `proposal_${Date.now()}_${i}`,
      title: this.georgianProposalTitles[Math.floor(Math.random() * this.georgianProposalTitles.length)],
      description: this.georgianProposalDescriptions[Math.floor(Math.random() * this.georgianProposalDescriptions.length)],
      summary: 'Key improvements identified for the latest auto-improve iteration.',
      status: statuses[Math.floor(Math.random() * statuses.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      impact: Math.floor(Math.random() * 10) + 1,
      confidence: Math.floor(Math.random() * 100) + 1,
      estimatedTime: Math.floor(Math.random() * 120) + 5,
      createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      appliedAt: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
      files: this.generateAffectedFiles().map(path => ({
        path,
        lines: Math.floor(Math.random() * 50) + 1,
        rule: `rule-${Math.floor(Math.random() * 100)}`,
        note: 'Automated analysis detected potential improvement'
      })),
      changes: this.generateChanges(),
      validation: {
        passed: Math.random() > 0.3,
        issues: Math.random() > 0.7 ? this.generateValidationIssues() : [],
        completedAt: new Date().toISOString()
      }
    }));
  }

  /**
   * Generate history data
   * ისტორიის მონაცემების გენერაცია
   */
  generateHistory(count: number = 10): AutoUpdateRun[] {
    const runTypes: Array<'manual' | 'scheduled' | 'triggered'> = ['manual', 'scheduled', 'triggered'];
    const results: Array<'success' | 'failed' | 'running'> = ['success', 'failed', 'running'];

    return Array.from({ length: count }, (_, i) => ({
      id: `run_${Date.now()}_${i}`,
      startedAt: new Date(Date.now() - Math.random() * 604800000).toISOString(),
      completedAt: new Date(Date.now() - Math.random() * 604800000 + 3600000).toISOString(),
      result: results[Math.floor(Math.random() * results.length)],
      type: runTypes[Math.floor(Math.random() * runTypes.length)],
      proposalsProcessed: Math.floor(Math.random() * 20) + 1,
      proposalsApplied: Math.floor(Math.random() * 15),
      issuesFound: Math.floor(Math.random() * 10),
      duration: Math.floor(Math.random() * 3600) + 60,
      trigger: this.generateTrigger(),
      sources: [this.generateEventSource()],
      cid: `cid_${Math.random().toString(36).slice(2, 10)}`
    }));
  }

  /**
   * Generate live events
   * ლაივ ივენთების გენერაცია
   */
  generateLiveEvents(count: number = 20): LiveEvent[] {
    const eventTypes: Array<LiveEvent['type']> = [
      'CheckStarted',
      'CheckPassed',
      'CheckFailed',
      'TestsRunning',
      'TestsPassed',
      'TestsFailed',
      'Risk',
      'ArtifactsReady',
      'ProposalsPushed'
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: `event_${Date.now()}_${i}`,
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      message: this.georgianMessages[Math.floor(Math.random() * this.georgianMessages.length)],
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      source: this.generateEventSource(),
      metadata: this.generateEventMetadata(),
      cid: `cid_${Math.random().toString(36).slice(2, 10)}`,
      ...(Math.random() > 0.7 ? { risk: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as LiveEvent['risk'] } : {})
    }));
  }

  /**
   * Generate continuous stream of live events
   * ლაივ ივენთების უწყვეტი ნაკადის გენერაცია
   */
  startLiveEventStream(callback: (event: LiveEvent) => void, intervalMs: number = 2000): () => void {
    const interval = setInterval(() => {
      const liveTypes: Array<LiveEvent['type']> = [
        'CheckStarted',
        'CheckPassed',
        'CheckFailed',
        'TestsRunning',
        'TestsPassed',
        'TestsFailed',
        'Risk',
        'ArtifactsReady',
        'ProposalsPushed'
      ];
      const event: LiveEvent = {
        id: `live_event_${Date.now()}_${Math.random()}`,
        type: liveTypes[Math.floor(Math.random() * liveTypes.length)],
        message: this.georgianMessages[Math.floor(Math.random() * this.georgianMessages.length)],
        timestamp: new Date().toISOString(),
        source: this.generateEventSource(),
        metadata: this.generateEventMetadata(),
        cid: `cid_${Math.random().toString(36).slice(2, 10)}`,
        ...(Math.random() > 0.8 ? { risk: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as LiveEvent['risk'] } : {})
      };
      callback(event);
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Generate system status changes
   * სისტემის სტატუსის ცვლილებების გენერაცია
   */
  generateStatusUpdate(): Partial<AutoUpdateKPIs> {
    const updates: Partial<AutoUpdateKPIs> = {};
    
    if (Math.random() > 0.7) {
      updates.queueLength = Math.floor(Math.random() * 50);
    }
    
    if (Math.random() > 0.8) {
      updates.p95ResponseTime = Math.floor(Math.random() * 1000) + 100;
    }
    
    if (Math.random() > 0.9) {
      updates.errorRate = Math.floor(Math.random() * 10);
    }

    return updates;
  }

  // Helper methods
  private generateAffectedFiles(): string[] {
    const files = [
      'src/components/ChatPanel.tsx',
      'src/services/aiService.ts',
      'backend/routes/ai_proxy.js',
      'ai-service/services/groq_service.js',
      'src/hooks/useAuth.ts',
      'src/utils/validation.ts',
      'backend/middleware/auth.js',
      'src/components/FileTree.tsx'
    ];
    
    const count = Math.floor(Math.random() * 4) + 1;
    return files.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateChanges(): Array<{ file: string; additions: number; deletions: number }> {
    return this.generateAffectedFiles().map(file => ({
      file,
      additions: Math.floor(Math.random() * 50) + 1,
      deletions: Math.floor(Math.random() * 30)
    }));
  }

  private generateValidationIssues(): string[] {
    const issues = [
      'TypeScript compilation errors in affected files',
      'ESLint warnings detected',
      'Unit tests failing after changes',
      'Integration tests require updates',
      'Performance regression detected'
    ];
    
    const count = Math.floor(Math.random() * 3) + 1;
    return issues.sort(() => 0.5 - Math.random()).slice(0, count);
  }

  private generateTrigger(): string {
    const triggers = [
      'Scheduled daily optimization',
      'Performance threshold exceeded',
      'User-requested analysis',
      'Error rate spike detected',
      'Manual system scan'
    ];
    
    return triggers[Math.floor(Math.random() * triggers.length)];
  }

  private generateEventSource(): string {
    const sources = ['AI-Service', 'Backend', 'Frontend', 'Database', 'Cache', 'Monitor'];
    return sources[Math.floor(Math.random() * sources.length)];
  }

  private generateEventMetadata(): Record<string, any> {
    return {
      requestId: `req_${Math.random().toString(36).substr(2, 9)}`,
      userId: Math.random() > 0.5 ? `user_${Math.random().toString(36).substr(2, 5)}` : 'system',
      duration: Math.floor(Math.random() * 1000) + 10,
      memoryUsage: Math.floor(Math.random() * 100) + 20
    };
  }
}

// Export singleton instance
export const mockDataGenerator = MockDataGenerator.getInstance();

// Export utility functions for easy access
export const generateMockKPIs = () => mockDataGenerator.generateKPIs();
export const generateMockProposals = (count?: number) => mockDataGenerator.generateProposals(count);
export const generateMockHistory = (count?: number) => mockDataGenerator.generateHistory(count);
export const generateMockLiveEvents = (count?: number) => mockDataGenerator.generateLiveEvents(count);
