import React, { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LogEntry } from '../../context/DevConsoleContext';
import { LogLine } from './LogLine';
import { MetaViewer } from './MetaViewer';

interface LogListProps {
  logs: LogEntry[];
  isPaused?: boolean;
  isLoading?: boolean;
  onPinLog?: () => void;
  onCopyLog?: () => void;
  autoscroll?: boolean;
}

export const LogList: React.FC<LogListProps> = ({
  logs,
  isPaused = false,
  isLoading: _isLoading = false,
  onPinLog: _onPinLog,
  onCopyLog: _onCopyLog,
  autoscroll: _autoscroll = true
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastLogCountRef = useRef(logs.length);
  const [pinnedLogs, setPinnedLogs] = React.useState<Set<string>>(new Set());
  const [isUserScrolling, setIsUserScrolling] = React.useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const [activeMetaLog, setActiveMetaLog] = useState<LogEntry | null>(null);

  // Virtual scrolling for performance
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Increased row height for better spacing
    overscan: 20
  });

  // Handle user scrolling to pause auto-scroll
  const handleScroll = () => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;

    if (!isAtBottom && !isUserScrolling) {
      setIsUserScrolling(true);
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (isAtBottom) {
        setIsUserScrolling(false);
      }
    }, 1000);
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    const shouldScroll = !isPaused && !isUserScrolling && logs.length > lastLogCountRef.current;

    if (shouldScroll && parentRef.current) {
      setTimeout(() => {
        if (parentRef.current && !isPaused && !isUserScrolling) {
          parentRef.current.scrollTo({
            top: parentRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
    lastLogCountRef.current = logs.length;
  }, [logs.length, isPaused, isUserScrolling]);

  const onPinLog = (logId: string) => {
    setPinnedLogs(prev => new Set(prev).add(logId));
  };

  const onUnpinLog = (logId: string) => {
    setPinnedLogs(prev => {
      const newSet = new Set(prev);
      newSet.delete(logId);
      return newSet;
    });
  };

  const handleMetaToggle = (log: LogEntry | null) => {
    setActiveMetaLog(log);
  };

  const closeMetaViewer = () => {
    setActiveMetaLog(null);
  };

  return (
    <div className="relative flex-1 flex flex-col">
      {/* Table Header */}
      <div className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600 px-3 py-2 font-mono text-xs font-semibold">
        <div className="grid grid-cols-[auto_90px_80px_1fr_auto] gap-3 items-center lg:grid-cols-[auto_100px_90px_1fr_auto] xl:gap-4">
          <div className="text-gray-700 dark:text-gray-300 w-[140px]">TIMESTAMP</div>
          <div className="text-gray-700 dark:text-gray-300 text-center">SOURCE</div>
          <div className="text-gray-700 dark:text-gray-300 text-center">LEVEL</div>
          <div className="text-gray-700 dark:text-gray-300">MESSAGE</div>
          <div className="text-gray-700 dark:text-gray-300 text-center w-[72px]">ACTIONS</div>
        </div>
      </div>

      {/* Auto-scroll status indicator */}
      {(isPaused || isUserScrolling) && (
        <div className="absolute top-12 right-2 z-10 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-xs font-medium border border-yellow-300 dark:border-yellow-700">
          {isPaused ? '⏸️ Paused' : '👆 User Scrolling'}
        </div>
      )}

      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="console-log-list flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 font-mono text-sm scroll-smooth"
        style={{ 
          height: '100%',
          position: 'relative',
          zIndex: 1
        }}
      >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const log = logs[virtualItem.index];
          if (!log) return null;

          const logId = log.id;
          const isPinned = pinnedLogs.has(logId);

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
                overflow: 'visible',
                zIndex: 1
              }}
            >
              <LogLine
                key={logId}
                log={log}
                isPinned={isPinned}
                onPin={() => onPinLog(logId)}
                onUnpin={() => onUnpinLog(logId)}
                onMetaToggle={handleMetaToggle}
                showingMeta={activeMetaLog?.id === log.id}
              />
            </div>
          );
        })}
      </div>

      {logs.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-lg mb-2">📋</div>
              <div>No logs available</div>
              <div className="text-sm">Logs will appear here as they are received</div>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Modal - Rendered outside virtualized container */}
      {activeMetaLog && (
        <MetaViewer 
          log={activeMetaLog} 
          onClose={closeMetaViewer} 
        />
      )}
    </div>
  );
};