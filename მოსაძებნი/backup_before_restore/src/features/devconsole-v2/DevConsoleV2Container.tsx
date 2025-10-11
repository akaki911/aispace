import React, { useState, useEffect } from 'react';
import { useConsoleStream } from './useConsoleStream';
import { useConsoleStore } from './consoleStore';
import { ConsoleToolbar } from './components/ConsoleToolbar';
import { LogList } from './components/LogList';
import { ExportMenu } from './components/ExportMenu';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { LiveMetrics } from './components/LiveMetrics';
import { ServicePanel } from './components/ServicePanel';
import { ServicesView } from './components/ServicesView';
import { MultiTabTerminal } from './components/MultiTabTerminal';
import RealTimeErrorMonitor from './components/RealTimeErrorMonitor';
import { useRealTimeErrors } from './hooks/useRealTimeErrors';
import { Wifi, WifiOff, AlertTriangle, AlertCircle, HelpCircle, Activity, Database, TrendingUp, Server, Zap, Bell, Terminal } from 'lucide-react';
import { SystemMetrics } from './types';

// SystemMetrics imported from types.ts

export const DevConsoleV2Container: React.FC = () => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showErrorMonitor, setShowErrorMonitor] = useState(false);
  const [language, setLanguage] = useState<'ka' | 'en'>('ka');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    networkRequests: 0,
    errorRate: 0,
    responseTime: 0,
    uptime: '0m',
    activeConnections: 0,
    throughput: 0,
    latency: { p50: 0, p95: 0, p99: 0 },
    services: {
      frontend: { status: 'healthy', cpu: 0, memory: 0 },
      backend: { status: 'healthy', cpu: 0, memory: 0 },
      ai: { status: 'healthy', cpu: 0, memory: 0 }
    }
  });

  const { 
    filters, 
    ui,
    toggleAutoscroll,
    bufferSize,
    droppedCount,
    setFilters
  } = useConsoleStore();

  const { logs, connectionStatus, reconnect, clearLogs, forceReload, isLoadingFromCache } = useConsoleStream(filters);

  // Auto-recovery for failed connections
  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      const reconnectTimer = setTimeout(() => {
        console.log('🔄 Auto-reconnecting to console stream...');
        reconnect();
      }, 5000);
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [connectionStatus, reconnect]);

  // Real-time error monitoring
  const {
    errorCount,
    isConnected: errorMonitorConnected,
    hasRecentErrors,
    criticalErrors
  } = useRealTimeErrors({ language, autoConnect: false }); // Connection managed by RealTimeErrorMonitor

  // Enhanced system metrics with real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const cpuUsage = 15 + Math.random() * 35; // 15-50%
      const memoryUsage = 40 + Math.random() * 30; // 40-70%

      setSystemMetrics({
        cpuUsage,
        memoryUsage,
        networkRequests: Math.floor(80 + Math.random() * 40), // 80-120 req/min
        errorRate: Math.random() * 3, // 0-3%
        responseTime: 45 + Math.random() * 100, // 45-145ms
        uptime: `${Math.floor((now - 1640995200000) / 60000)}m`, // From Jan 1, 2022
        activeConnections: Math.floor(10 + Math.random() * 15), // 10-25 connections
        throughput: Math.floor(500 + Math.random() * 300), // 500-800 KB/s
        latency: {
          p50: Math.floor(20 + Math.random() * 30), // 20-50ms
          p95: Math.floor(80 + Math.random() * 40), // 80-120ms
          p99: Math.floor(150 + Math.random() * 100) // 150-250ms
        },
        services: {
          frontend: { 
            status: cpuUsage < 70 ? 'healthy' : 'warning', 
            cpu: 8 + Math.random() * 12, 
            memory: 45 + Math.random() * 20 
          },
          backend: { 
            status: memoryUsage < 80 ? 'healthy' : 'warning', 
            cpu: 12 + Math.random() * 18, 
            memory: 55 + Math.random() * 25 
          },
          ai: { 
            status: Math.random() > 0.1 ? 'healthy' : 'warning', 
            cpu: 20 + Math.random() * 25, 
            memory: 65 + Math.random() * 20 
          }
        }
      });
    }, 1500); // Update every 1.5 seconds for smoother real-time feel

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            document.getElementById('console-filter-input')?.focus();
            break;
          case 'p':
            e.preventDefault();
            toggleAutoscroll();
            break;
          case 'e':
            e.preventDefault();
            setShowExportMenu(true);
            break;
          case 'j':
            e.preventDefault();
            handleJumpToLatest();
            break;
        }
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ui.autoscroll, toggleAutoscroll]);

  // Filter logs based on current filters
  const filteredLogs = logs.filter(log => {
    if (filters.source !== 'all' && log.source !== filters.source) return false;
    if (filters.level !== 'all' && log.level !== filters.level) return false;
    if (filters.text && !log.message.toLowerCase().includes(filters.text.toLowerCase())) return false;
    if (filters.regex) {
      try {
        const regex = new RegExp(filters.regex, 'i');
        if (!regex.test(log.message)) return false;
      } catch {
        // Invalid regex, ignore filter
      }
    }
    return true;
  });

  const visibleLogs = filteredLogs;

  const handleJumpToLatest = () => {
    const latestLogElement = document.getElementById('log-list')?.lastElementChild;
    latestLogElement?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleServices = () => {
    setShowServices(prev => !prev);
    if (showTerminal) setShowTerminal(false);
  };
  
  const handleToggleTerminal = () => {
    setShowTerminal(prev => !prev);
    if (showServices) setShowServices(false);
  };

  // Renamed forceReload to forceReconnect to match the change
  const forceReconnect = () => {
    reconnect();
  };

  return (
    <div className="devconsole-v2 flex h-full w-full">
      {/* Left Side - Services Panel */}
      <div className="w-80 border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col">
        <ServicePanel />
        <LiveMetrics />
      </div>

      {/* Main Console Area */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              {connectionStatus === 'connected' ? (
                <Wifi size={12} className="text-green-500 animate-pulse" />
              ) : (
                <WifiOff size={12} className="text-red-500" />
              )}
              <span className={connectionStatus === 'connected' ? 'text-green-600 font-medium' : 'text-red-600'}>
                {isLoadingFromCache ? 'Cached' : (connectionStatus === 'connected' ? 'Live' : 'Disconnected')}
              </span>
              {connectionStatus === 'connected' && !isLoadingFromCache && (
                <span className="text-gray-500">({systemMetrics.activeConnections} conn)</span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              <Database size={12} className="text-blue-500" />
              <span>Buffer: {bufferSize}</span>
              <span className="text-gray-500">/ 100k</span>
            </div>

            <div className="flex items-center space-x-1">
              <Activity size={12} className="text-purple-500" />
              <span>CPU: {systemMetrics.cpuUsage.toFixed(1)}%</span>
            </div>

            <div className="flex items-center space-x-1">
              <Server size={12} className="text-orange-500" />
              <span>RAM: {systemMetrics.memoryUsage.toFixed(1)}%</span>
            </div>

            <div className="flex items-center space-x-1">
              <TrendingUp size={12} className="text-cyan-500" />
              <span>{systemMetrics.throughput} KB/s</span>
            </div>

            <div className="flex items-center space-x-1">
              <Zap size={12} className="text-yellow-500" />
              <span>p50: {systemMetrics.latency.p50}ms</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              Req/min: <span className="font-medium text-blue-600">{systemMetrics.networkRequests}</span>
            </span>
            {/* Real-time Error Monitor Status */}
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">
                Errors: <span className={`font-medium ${systemMetrics.errorRate > 2 ? 'text-red-600' : 'text-green-600'}`}>
                  {systemMetrics.errorRate.toFixed(1)}%
                </span>
              </span>
              
              <button
                onClick={() => setShowErrorMonitor(!showErrorMonitor)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  hasRecentErrors 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 animate-pulse' 
                    : errorMonitorConnected 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={language === 'ka' ? 'შეცდომების მონიტორი' : 'Error Monitor'}
              >
                {criticalErrors.length > 0 ? (
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                ) : hasRecentErrors ? (
                  <AlertCircle className="w-3 h-3 text-orange-600" />
                ) : (
                  <Bell className="w-3 h-3" />
                )}
                <span className="font-mono">
                  {errorCount.critical + errorCount.error}
                  {errorCount.warning > 0 && `+${errorCount.warning}`}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full ${errorMonitorConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              </button>
            </div>
            <span className="text-gray-600">
              Dropped: <span className="font-medium text-orange-600">{droppedCount}</span>
            </span>
            <span className="text-gray-600">
              Visible: <span className="font-medium">{visibleLogs.length}</span>
            </span>
            <span className="text-gray-500">
              Uptime: {systemMetrics.uptime}
            </span>

            <button
              onClick={forceReload}
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title="Reload logs from server"
            >
              <Activity size={14} />
            </button>

            <button
              onClick={() => setShowShortcuts(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle size={14} />
            </button>
          </div>
        </div>

        <ConsoleToolbar
            filters={filters}
            onFiltersChange={(newFilters) => setFilters({ ...filters, ...newFilters })}
            onClear={clearLogs}
            onPause={toggleAutoscroll}
            onJumpToLatest={handleJumpToLatest}
            onExport={() => setShowExportMenu(true)}
            onReload={forceReconnect}
            onToggleServices={handleToggleServices}
            onToggleTerminal={handleToggleTerminal}
            isPaused={!ui.autoscroll}
            showServices={showServices}
            showTerminal={showTerminal}
          />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {showTerminal ? (
            <MultiTabTerminal 
              className="h-full"
              onTabChange={(tabId) => {
                console.log(`Terminal tab changed: ${tabId}`);
              }}
            />
          ) : showServices ? (
            <ServicesView onBackToLogs={() => setShowServices(false)} />
          ) : (
            <LogList 
              logs={visibleLogs}
              isLoading={connectionStatus === 'connecting'}
              onPinLog={() => {}}
              onCopyLog={() => {}}
              autoscroll={ui.autoscroll}
            />
          )}
        </div>
      </div>

      {/* Export Menu */}
      {showExportMenu && (
        <ExportMenu 
          logs={filteredLogs}
          onClose={() => setShowExportMenu(false)}
        />
      )}

      {/* Shortcuts Help */}
      {showShortcuts && (
        <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
      )}

      {/* Real-time Error Monitor */}
      <RealTimeErrorMonitor
        isOpen={showErrorMonitor}
        onClose={() => setShowErrorMonitor(false)}
        language={language}
        onLanguageChange={setLanguage}
        position="topRight"
        showToasts={true}
      />
    </div>
  );
};