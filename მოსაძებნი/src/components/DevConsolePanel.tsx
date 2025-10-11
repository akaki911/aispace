// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { X, Terminal, Trash2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useDebug } from '../contexts/useDebug';
import { useAuth } from '../contexts/useAuth';

const DevConsolePanel: React.FC = () => {
  const { logs, clearLogs, isConsoleVisible, toggleConsole, logEvent } = useDebug();
  const { user } = useAuth();
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Add initialization log when component mounts
  React.useEffect(() => {
    logEvent({
      type: 'INFO',
      message: 'Debug Console Panel initialized successfully! 🚀',
      component: 'DevConsolePanel'
    });
  }, [logEvent]);

  // Check if user should see the debug console
  const shouldShowConsole = user && (
    user.personalId === "01019062020" || // Akaki Tsintsadze
    user.role === 'SUPER_ADMIN'
  );

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (isConsoleVisible && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isConsoleVisible]);

  if (!shouldShowConsole) {
    return null;
  }

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-400';
      case 'WARN':
        return 'text-yellow-400';
      case 'API':
        return 'text-blue-400';
      case 'MODAL':
        return 'text-purple-400';
      case 'VALIDATION':
        return 'text-orange-400';
      default:
        return 'text-green-400';
    }
  };

  const getLogTypeBg = (type: string) => {
    switch (type) {
      case 'ERROR':
        return 'bg-red-900/20';
      case 'WARN':
        return 'bg-yellow-900/20';
      case 'API':
        return 'bg-blue-900/20';
      case 'MODAL':
        return 'bg-purple-900/20';
      case 'VALIDATION':
        return 'bg-orange-900/20';
      default:
        return 'bg-green-900/20';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <>
      {/* Toggle Button */}
      {!isConsoleVisible && (
        <button
          onClick={toggleConsole}
          className="fixed bottom-4 right-4 z-[9998] bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 border border-gray-600"
          title="Open Debug Console"
        >
          <Terminal className="w-5 h-5" />
        </button>
      )}

      {/* Debug Console Panel */}
      {isConsoleVisible && (
        <div className="fixed bottom-4 right-4 z-[9999] w-[500px] h-[400px] bg-black/90 border border-gray-600 rounded-lg shadow-2xl flex flex-col backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-600 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium text-sm">Debug Console</span>
              <span className="text-gray-400 text-xs">({logs.length}/100)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearLogs}
                className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={toggleConsole}
                className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                title="Close console"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Logs Container */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-8">
                No debug logs yet. Interact with the app to see events here.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded text-xs font-mono border-l-2 ${getLogTypeBg(log.type)} border-l-current`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400 text-[10px]">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className={`font-semibold text-[10px] ${getLogTypeColor(log.type)}`}>
                          [{log.type}]
                        </span>
                        {log.component && (
                          <span className="text-gray-500 text-[10px]">
                            {log.component}
                          </span>
                        )}
                      </div>
                      <div className="text-white text-xs break-words">
                        {log.message}
                      </div>
                      {log.metadata && (
                        <details className="mt-1">
                          <summary className="text-gray-400 text-[10px] cursor-pointer hover:text-gray-300">
                            Metadata ▼
                          </summary>
                          <pre className="text-gray-300 text-[10px] mt-1 bg-gray-900/50 p-1 rounded overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-gray-600 bg-gray-800/50">
            <div className="text-gray-400 text-[10px] text-center">
              Debug Console • Auto-scroll enabled • Max 100 entries
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DevConsolePanel;