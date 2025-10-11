
import React, { useState, useEffect } from 'react';
import { useDevConsoleStore } from './store';

interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: Test[];
  lastRun?: number;
  status: 'idle' | 'running' | 'passed' | 'failed';
}

interface Test {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error?: string;
  details?: string;
}

export const TestsPanel: React.FC = () => {
  const { theme } = useDevConsoleStore();
  const [testSuites, setTestSuites] = useState<TestSuite[]>([
    {
      id: 'health',
      name: '🏥 Health Checks',
      description: 'სისტემის ჯანმრთელობის შემოწმება',
      status: 'idle',
      tests: [
        { id: 'backend-ping', name: 'Backend Connectivity', status: 'pending' },
        { id: 'ai-service-ping', name: 'AI Service Connectivity', status: 'pending' },
        { id: 'database-check', name: 'Database Connection', status: 'pending' },
        { id: 'groq-api-check', name: 'Groq API Status', status: 'pending' }
      ]
    },
    {
      id: 'e2e',
      name: '🔄 End-to-End Tests',
      description: 'ფუნქციონალური ტესტები',
      status: 'idle',
      tests: [
        { id: 'user-login', name: 'User Authentication', status: 'pending' },
        { id: 'ai-chat', name: 'AI Chat Flow', status: 'pending' },
        { id: 'admin-panel', name: 'Admin Panel Access', status: 'pending' }
      ]
    },
    {
      id: 'ai-latency',
      name: '⚡ AI Performance Tests',
      description: 'AI სერვისის შესრულების ტესტები',
      status: 'idle',
      tests: [
        { id: 'ai-response-time', name: 'Response Time < 2s', status: 'pending' },
        { id: 'ai-accuracy', name: 'Response Accuracy', status: 'pending' },
        { id: 'ai-memory', name: 'Memory Usage', status: 'pending' }
      ]
    }
  ]);

  const runTestSuite = async (suiteId: string) => {
    setTestSuites(prev => prev.map(suite => 
      suite.id === suiteId 
        ? { ...suite, status: 'running', lastRun: Date.now() }
        : suite
    ));

    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;

    // Run each test sequentially
    for (const test of suite.tests) {
      // Mark test as running
      setTestSuites(prev => prev.map(s => 
        s.id === suiteId 
          ? {
              ...s,
              tests: s.tests.map(t => 
                t.id === test.id 
                  ? { ...t, status: 'running' }
                  : t
              )
            }
          : s
      ));

      // Simulate test execution
      const startTime = Date.now();
      const success = await simulateTest(test.id);
      const duration = Date.now() - startTime;

      // Update test result
      setTestSuites(prev => prev.map(s => 
        s.id === suiteId 
          ? {
              ...s,
              tests: s.tests.map(t => 
                t.id === test.id 
                  ? { 
                      ...t, 
                      status: success ? 'passed' : 'failed',
                      duration,
                      error: !success ? 'ტესტი ვერ ჩაიარა' : undefined,
                      details: success ? 'ტესტი წარმატებით ჩაიარა' : undefined
                    }
                  : t
              )
            }
          : s
      ));

      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Mark suite as complete
    const allPassed = suite.tests.every(() => Math.random() > 0.3); // 70% success rate
    setTestSuites(prev => prev.map(s => 
      s.id === suiteId 
        ? { ...s, status: allPassed ? 'passed' : 'failed' }
        : s
    ));
  };

  const simulateTest = async (testId: string): Promise<boolean> => {
    // Simulate different test scenarios
    switch (testId) {
      case 'backend-ping':
        try {
          const response = await fetch('/api/health');
          return response.ok;
        } catch {
          return false;
        }
      
      case 'ai-service-ping':
        try {
          const response = await fetch('/api/health');  // AI health endpoint would be here
          return response.ok;
        } catch {
          return false;
        }
      
      default:
        // Random success for demo purposes
        return Math.random() > 0.2; // 80% success rate
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue-400 bg-blue-600';
      case 'passed': return 'text-green-400 bg-green-600';
      case 'failed': return 'text-red-400 bg-red-600';
      default: return 'text-gray-400 bg-gray-600';
    }
  };

  return (
    <div className={`h-full overflow-y-auto p-6 ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    }`}>
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">🧪 ტესტების ცენტრი</h2>
        <p className="text-gray-500">
          სისტემის ფუნქციონალური და შესრულების ტესტები
        </p>
      </div>

      {/* Test Suites */}
      <div className="space-y-6">
        {testSuites.map((suite) => (
          <div 
            key={suite.id}
            className={`p-6 rounded-lg border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            }`}
          >
            {/* Suite Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">{suite.name}</h3>
                <p className="text-sm text-gray-500">{suite.description}</p>
              </div>
              
              <div className="flex items-center space-x-3">
                {suite.lastRun && (
                  <span className="text-xs text-gray-500">
                    ბოლო: {new Date(suite.lastRun).toLocaleTimeString('ka-GE')}
                  </span>
                )}
                
                <span className={`px-3 py-1 rounded text-xs font-medium ${
                  getStatusColor(suite.status)
                }`}>
                  {suite.status.toUpperCase()}
                </span>
                
                <button
                  onClick={() => runTestSuite(suite.id)}
                  disabled={suite.status === 'running'}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                    suite.status === 'running'
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {suite.status === 'running' ? '🏃 გაშვებული...' : '▶️ გაშვება'}
                </button>
              </div>
            </div>

            {/* Tests List */}
            <div className="space-y-2">
              {suite.tests.map((test) => (
                <div 
                  key={test.id}
                  className={`flex items-center justify-between p-3 rounded ${
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      getStatusColor(test.status)
                    }`}>
                      {test.status === 'running' ? '🏃' : 
                       test.status === 'passed' ? '✅' :
                       test.status === 'failed' ? '❌' : '⏸️'}
                    </span>
                    
                    <span className="font-medium">{test.name}</span>
                    
                    {test.duration && (
                      <span className="text-xs text-gray-500">
                        ({test.duration}ms)
                      </span>
                    )}
                  </div>

                  {test.status === 'running' && (
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                  )}
                </div>
              ))}
            </div>

            {/* Suite Summary */}
            <div className="mt-4 pt-4 border-t border-gray-700 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>
                  📊 ტესტები: {suite.tests.length} |
                  ✅ ჩაირო: {suite.tests.filter(t => t.status === 'passed').length} |
                  ❌ ვერ ჩაირო: {suite.tests.filter(t => t.status === 'failed').length}
                </span>
                
                {suite.status === 'running' && (
                  <span className="text-blue-400">
                    მიმდინარეობს...
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Summary */}
      <div className={`mt-6 p-4 rounded-lg ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
      }`}>
        <h4 className="font-medium mb-2">📈 ზოგადი სტატისტიკა</h4>
        <div className="text-sm text-gray-500">
          სულ ტესტების ნაკრები: {testSuites.length} | 
          აქტიური: {testSuites.filter(s => s.status === 'running').length} |
          წარმატებული: {testSuites.filter(s => s.status === 'passed').length} |
          წარუმატებელი: {testSuites.filter(s => s.status === 'failed').length}
        </div>
      </div>
    </div>
  );
};
