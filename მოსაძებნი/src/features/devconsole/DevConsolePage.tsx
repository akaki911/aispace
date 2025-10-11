
import React, { useEffect } from 'react';
import { useDevConsoleStore } from './store';
import { ConsoleStream } from './ConsoleStream';
import { MetricsPanel } from './MetricsPanel';
import { JobsPanel } from './JobsPanel';
import { TestsPanel } from './TestsPanel';
import { CommandPalette } from './CommandPalette';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';

export const DevConsolePage: React.FC = () => {
  const { activeTab, theme, sidebarCollapsed } = useDevConsoleStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // TODO: Open command palette
        console.log('🎯 Command Palette (Ctrl/⌘+K)');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'console':
        return <ConsoleStream />;
      case 'metrics':
        return <MetricsPanel />;
      case 'jobs':
        return <JobsPanel />;
      case 'tests':
        return <TestsPanel />;
      default:
        return <ConsoleStream />;
    }
  };

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Status Bar */}
      <StatusBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <main className={`flex-1 overflow-hidden transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}>
          {renderContent()}
        </main>
      </div>
      
      {/* Command Palette */}
      <CommandPalette />
    </div>
  );
};
