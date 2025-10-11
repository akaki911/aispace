
import React, { useState } from 'react';
import { useDevConsoleStore } from './store';

interface Job {
  id: string;
  command: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startTime: number;
  endTime?: number;
  output?: string;
  error?: string;
}

export const JobsPanel: React.FC = () => {
  const { theme } = useDevConsoleStore();
  const [jobs, setJobs] = useState<Job[]>([]);

  const runCommand = async (command: string, target?: string) => {
    const jobId = `job-${Date.now()}`;
    const newJob: Job = {
      id: jobId,
      command: `${command} ${target || ''}`.trim(),
      status: 'queued',
      startTime: Date.now()
    };

    setJobs(prev => [newJob, ...prev]);

    // Simulate job execution
    setTimeout(() => {
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'running' }
          : job
      ));
    }, 500);

    try {
      const response = await fetch('/api/dev/commands/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target || 'backend' })
      });

      const result = await response.json();
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              status: response.ok ? 'success' : 'failed',
              endTime: Date.now(),
              output: result.message || 'Command completed',
              error: !response.ok ? result.error : undefined
            }
          : job
      ));
    } catch (error) {
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          : job
      ));
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'queued': return 'text-gray-400 bg-gray-600';
      case 'running': return 'text-blue-400 bg-blue-600';
      case 'success': return 'text-green-400 bg-green-600';
      case 'failed': return 'text-red-400 bg-red-600';
    }
  };

  const quickActions = [
    { label: '🔄 Restart Backend', command: 'restart', target: 'backend' },
    { label: '🤖 Restart AI Service', command: 'restart', target: 'ai-service' },
    { label: '⚛️ Restart Frontend', command: 'restart', target: 'frontend' },
    { label: '🗑️ Flush Cache', command: 'flush', target: 'cache' },
    { label: '🏥 Health Check', command: 'health', target: 'all' },
    { label: '🧠 Groq Ping', command: 'ping', target: 'groq' }
  ];

  return (
    <div className={`h-full flex flex-col ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    }`}>
      
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-2xl font-bold mb-4">🏃 Jobs & Commands</h2>
        
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => runCommand(action.command, action.target)}
              className={`px-4 py-3 rounded-lg text-left transition-colors ${
                theme === 'dark' 
                  ? 'bg-gray-800 hover:bg-gray-700 border border-gray-600' 
                  : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{action.label}</div>
              <div className="text-xs text-gray-500 mt-1">
                {action.command} {action.target}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-6">
        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-gray-500">ჯერ არც ერთი ჯობი არ გაშვებულა</p>
            <p className="text-sm text-gray-400 mt-2">
              ზემოთ Quick Actions-დან აირჩიეთ ბრძანება
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div 
                key={job.id}
                className={`p-4 rounded-lg border ${
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        getStatusColor(job.status)
                      }`}>
                        {job.status.toUpperCase()}
                      </span>
                      
                      <span className="font-mono text-sm">
                        {job.command}
                      </span>
                      
                      <span className="text-xs text-gray-500">
                        {new Date(job.startTime).toLocaleTimeString('ka-GE')}
                      </span>
                      
                      {job.endTime && (
                        <span className="text-xs text-gray-400">
                          ({Math.round((job.endTime - job.startTime) / 1000)}s)
                        </span>
                      )}
                    </div>

                    {/* Output/Error */}
                    {job.output && (
                      <div className={`mt-2 p-2 rounded text-sm font-mono ${
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                      }`}>
                        <span className="text-green-400">✅ </span>
                        {job.output}
                      </div>
                    )}

                    {job.error && (
                      <div className={`mt-2 p-2 rounded text-sm font-mono ${
                        theme === 'dark' ? 'bg-red-900' : 'bg-red-100'
                      }`}>
                        <span className="text-red-400">❌ </span>
                        {job.error}
                      </div>
                    )}

                    {job.status === 'running' && (
                      <div className="mt-2 flex items-center space-x-2 text-blue-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />
                        <span className="text-sm">მუშაობს...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-6 py-3 border-t text-xs text-gray-500 ${
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'
      }`}>
        📊 სულ ჯობები: {jobs.length} | 
        🏃 აქტიური: {jobs.filter(j => j.status === 'running').length} | 
        ✅ წარმატებული: {jobs.filter(j => j.status === 'success').length} |
        ❌ წარუმატებელი: {jobs.filter(j => j.status === 'failed').length}
      </div>
    </div>
  );
};
