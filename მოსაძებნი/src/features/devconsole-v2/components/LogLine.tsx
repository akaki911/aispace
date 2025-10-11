// @ts-nocheck
import React, { useState } from 'react';
import { LogEntry } from '../../contexts/DevConsoleContext.types';

interface LogLineProps {
  log: LogEntry;
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onMetaToggle?: (log: LogEntry | null) => void;
  showingMeta?: boolean;
}

export const LogLine: React.FC<LogLineProps> = ({ log, isPinned, onPin, onUnpin, onMetaToggle, showingMeta = false }) => {
  const [copied, setCopied] = useState(false);

  const formatTimestamp = (ts: number, showDate: boolean = false) => {
    const date = new Date(ts);
    const baseTime = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    const timeStr = `${baseTime}.${milliseconds}`;
    
    if (showDate) {
      const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      return `${dateStr} ${timeStr}`;
    }
    
    return timeStr;
  };

  const getSourceColor = (source: string | undefined) => {
    if (!source) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    
    switch (source.toLowerCase()) {
      case 'ai': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'backend': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'frontend': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getLevelColor = (level: string | undefined) => {
    if (!level) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    
    switch (level.toLowerCase()) {
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 ring-2 ring-red-300 animate-pulse';
      case 'warn': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 ring-1 ring-orange-300';
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'debug': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getLevelIcon = (level: string | undefined) => {
    if (!level) return '🔘';
    
    switch (level.toLowerCase()) {
      case 'error': return '🔴';
      case 'warn': return '🟠';
      case 'info': return '🔵';
      case 'debug': return '⚪';
      default: return '🔘';
    }
  };

  const copyLine = async () => {
    const lineText = `[${formatTimestamp(log.ts || Date.now())}] [${log.source || 'unknown'}:${log.level || 'log'}] ${log.message || 'No message'}${log.meta ? '\nMeta: ' + JSON.stringify(log.meta, null, 2) : ''}`;
    try {
      await navigator.clipboard.writeText(lineText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy log line:', error);
    }
  };

  const copyFullEntry = async () => {
    const fullEntry = {
      timestamp: formatTimestamp(log.ts || Date.now()),
      source: log.source || 'unknown',
      level: log.level || 'log',
      message: log.message || 'No message',
      ...(log.meta && { meta: log.meta })
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(fullEntry, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy full entry:', error);
    }
  };

  return (
    <div 
      className={`log-line relative hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700 font-mono text-sm ${
        isPinned ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
      } ${showingMeta ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
    >
      {/* Grid Layout for Consistent Columns - Responsive */}
      <div className="grid grid-cols-[auto_90px_80px_1fr_auto] gap-3 items-start min-h-[24px] lg:grid-cols-[auto_100px_90px_1fr_auto] xl:gap-4">
        {/* Timestamp Column - Fixed width for consistency */}
        <div className="text-xs text-gray-500 dark:text-gray-400 shrink-0 w-[140px] overflow-hidden">
          <span className="block truncate" title={formatTimestamp(log.ts || Date.now(), true)}>
            {formatTimestamp(log.ts || Date.now(), true)}
          </span>
        </div>

        {/* Source Badge Column - Fixed width */}
        <div className="shrink-0">
          <span className={`px-2 py-1 text-xs rounded font-medium uppercase block text-center truncate ${getSourceColor(log.source)}`}>
            {(log.source || 'UNKNOWN').substring(0, 8)}
          </span>
        </div>

        {/* Level Badge Column - Fixed width */}
        <div className="shrink-0">
          <span className={`px-2 py-1 text-xs rounded-full font-medium uppercase block text-center truncate ${getLevelColor(log.level)}`}>
            {getLevelIcon(log.level)} {(log.level || 'LOG').substring(0, 5)}
          </span>
        </div>

        {/* Message Column - Flexible but controlled */}
        <div className="min-w-0 flex-1">
          <div className={`break-words ${
            log.level?.toLowerCase() === 'error' ? 'text-red-600 dark:text-red-400 font-medium' :
            log.level?.toLowerCase() === 'warn' ? 'text-orange-600 dark:text-orange-400' :
            'text-gray-900 dark:text-gray-100'
          }`}>
            <span className="block" title={log.message || 'No message'}>
              {log.message || 'No message'}
            </span>
          </div>
          
          {/* Meta Toggle - Proper spacing */}
          {log.meta && Object.keys(log.meta).length > 0 && (
            <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
              <button
                onClick={() => {
                  onMetaToggle?.(showingMeta ? null : log);
                }}
                className={`text-xs hover:underline flex items-center gap-1 transition-all duration-300 ${
                  showingMeta 
                    ? 'text-orange-600 dark:text-orange-400 font-medium' 
                    : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                <span className={`transition-transform duration-300 ${showingMeta ? 'rotate-90' : ''}`}>
                  ▶️
                </span>
                {showingMeta ? 'Hide Meta' : 'Show Meta'}
                <span className="text-gray-500 ml-1">({Object.keys(log.meta).length} fields)</span>
              </button>
            </div>
          )}
        </div>

        {/* Actions Column - Fixed width */}
        <div className="flex items-center space-x-1 shrink-0 w-[72px] justify-end">
          <button
            onClick={copyLine}
            className="text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors p-1"
            title="Copy line text"
          >
            {copied ? '✅' : '📋'}
          </button>

          <button
            onClick={copyFullEntry}
            className="text-xs text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors p-1"
            title="Copy full JSON entry"
          >
            📄
          </button>

          <button
            onClick={isPinned ? onUnpin : onPin}
            className={`text-xs transition-colors p-1 ${
              isPinned
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
            }`}
            title={isPinned ? 'Unpin this log' : 'Pin this log'}
          >
            {isPinned ? '🔖' : '📑'}
          </button>
        </div>
      </div>
    </div>
  );
};