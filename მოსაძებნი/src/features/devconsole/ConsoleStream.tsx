
import React, { useEffect, useRef, useState } from 'react';
import { useDevConsoleStore } from './store';

export const ConsoleStream: React.FC = () => {
  const {
    logs,
    autoscroll,
    sourceFilter,
    levelFilter,
    textFilter,
    theme,
    sseStatus,
    setAutoscroll,
    setSseStatus,
    addLog,
    clearLogs,
    setSourceFilter,
    setLevelFilter,
    setTextFilter
  } = useDevConsoleStore();

  const [isPaused, setIsPaused] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (textFilter && !log.message.toLowerCase().includes(textFilter.toLowerCase())) return false;
    return true;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoscroll && logContainerRef.current && !isPaused) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoscroll, isPaused]);

  // SSE Connection
  useEffect(() => {
    const connectSSE = () => {
      setSseStatus('connecting');
      
      const url = new URL('/api/dev/console/stream', window.location.origin);
      url.searchParams.set('source', sourceFilter);
      if (levelFilter !== 'all') url.searchParams.set('level', levelFilter);
      if (textFilter) url.searchParams.set('text', textFilter);

      eventSourceRef.current = new EventSource(url.toString());

      eventSourceRef.current.onopen = () => {
        console.log('🔗 Console SSE connected');
        setSseStatus('connected');
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data);
          addLog(logEntry);
        } catch (err) {
          console.error('Failed to parse log entry:', err);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('Console SSE error:', error);
        setSseStatus('error');
        setTimeout(connectSSE, 3000); // Reconnect after 3s
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sourceFilter, levelFilter, textFilter]);

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'ai': return 'bg-green-600';
      case 'backend': return 'bg-purple-600';
      case 'frontend': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const handleExport = () => {
    const exportData = filteredLogs.map(log => ({
      timestamp: new Date(log.ts).toISOString(),
      source: log.source,
      level: log.level,
      message: log.message,
      meta: log.meta
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className={`h-full flex flex-col ${
      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
    }`}>
      
      {/* Controls Bar */}
      <div className={`flex items-center justify-between p-3 border-b ${
        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'
      }`}>
        
        {/* Filters */}
        <div className="flex items-center space-x-3">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className={`px-2 py-1 rounded text-sm ${
              theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <option value="all">ყველა წყარო</option>
            <option value="ai">AI Service</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className={`px-2 py-1 rounded text-sm ${
              theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
            }`}
          >
            <option value="all">ყველა დონე</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>

          <input
            type="text"
            placeholder="ტექსტის ძებნა..."
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className={`px-2 py-1 rounded text-sm w-48 ${
              theme === 'dark' ? 'bg-gray-700 border-gray-600 placeholder-gray-400' : 'bg-white border-gray-300'
            }`}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1 rounded text-sm ${
              isPaused 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPaused ? '▶️ განაგრძე' : '⏸️ დაპაუზება'}
          </button>

          <button
            onClick={() => setAutoscroll(!autoscroll)}
            className={`px-3 py-1 rounded text-sm ${
              autoscroll 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            📜 Auto-scroll
          </button>

          <button
            onClick={handleExport}
            className="px-3 py-1 rounded text-sm bg-purple-600 hover:bg-purple-700 text-white"
          >
            📥 Export
          </button>

          <button
            onClick={clearLogs}
            className="px-3 py-1 rounded text-sm bg-red-600 hover:bg-red-700 text-white"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Log Stream */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto font-mono text-sm p-2"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {filteredLogs.length === 0 ? (
          <div className={`text-center py-8 ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <div className="text-4xl mb-2">📝</div>
            <p>ლოგები ჯერ არ არის...</p>
            <p className="text-xs mt-1">
              კავშირი: {sseStatus === 'connected' ? '🟢' : '🔴'} {sseStatus}
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={`${log.ts}-${index}`} 
              className={`flex items-start space-x-3 py-1 hover:bg-opacity-50 ${
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              }`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 text-xs w-16 flex-shrink-0">
                {new Date(log.ts).toTimeString().split(' ')[0]}
              </span>

              {/* Source Badge */}
              <span className={`px-2 py-0.5 rounded text-xs text-white font-medium w-16 text-center ${
                getSourceColor(log.source)
              }`}>
                {log.source.toUpperCase()}
              </span>

              {/* Level Badge */}
              <span className={`text-xs font-medium w-12 ${
                getLogLevelColor(log.level)
              }`}>
                {log.level.toUpperCase()}
              </span>

              {/* Message */}
              <span className="flex-1 break-words">
                {log.message}
              </span>

              {/* Meta data (if exists) */}
              {log.meta && Object.keys(log.meta).length > 0 && (
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">📊</summary>
                  <pre className="mt-1 p-2 bg-gray-800 rounded text-xs overflow-x-auto">
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* Status Bar */}
      <div className={`px-3 py-2 text-xs border-t ${
        theme === 'dark' ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-gray-300 bg-gray-50'
      }`}>
        📊 ლოგები: {filteredLogs.length} / {logs.length} | 
        🔗 კავშირი: {sseStatus} | 
        📜 {autoscroll ? 'Auto-scroll ჩართული' : 'Auto-scroll გამორთული'} |
        ⏸️ {isPaused ? 'დაპაუზებული' : 'აქტიური'}
      </div>
    </div>
  );
};
