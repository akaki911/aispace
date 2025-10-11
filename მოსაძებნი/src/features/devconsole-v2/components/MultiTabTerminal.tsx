import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  X, 
  Terminal as TerminalIcon, 
  Play, 
  Square, 
  RotateCcw,
  Settings,
  Copy,
  Search,
  ChevronUp,
  ChevronDown,
  Folder,
  Clock
} from 'lucide-react';
import { TerminalTab, TerminalSession, TerminalEventMessage, TerminalOutput } from '../types/terminal';
import { useTerminalStore } from '../hooks/useTerminalStore';

interface MultiTabTerminalProps {
  className?: string;
  onTabChange?: (tabId: string) => void;
}

export const MultiTabTerminal: React.FC<MultiTabTerminalProps> = ({ 
  className = '', 
  onTabChange 
}) => {
  const {
    tabs,
    activeTabId,
    sessions,
    connections,
    createTab,
    closeTab,
    setActiveTab,
    executeCommand,
    renameTab,
    getTabHistory,
    clearTabOutput
  } = useTerminalStore();

  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentCommand, setCurrentCommand] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const terminalOutputRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const activeSession = activeTab ? sessions.get(activeTab.sessionId) : null;

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [activeSession?.output]);

  // Handle tab change callback
  useEffect(() => {
    if (activeTabId && onTabChange) {
      onTabChange(activeTabId);
    }
  }, [activeTabId, onTabChange]);

  const handleCreateTab = useCallback(async () => {
    const tabId = await createTab(`Terminal ${tabs.length + 1}`);
    if (commandInputRef.current) {
      commandInputRef.current.focus();
    }
  }, [createTab, tabs.length]);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setTimeout(() => {
      if (commandInputRef.current) {
        commandInputRef.current.focus();
      }
    }, 100);
  }, [setActiveTab]);

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const handleCommandSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCommand.trim() || !activeSession) return;

    const command = currentCommand.trim();
    
    // Add to command history
    setCommandHistory(prev => {
      const newHistory = [...prev.filter(cmd => cmd !== command), command];
      return newHistory.slice(-50); // Keep last 50 commands
    });
    setHistoryIndex(-1);
    setCurrentCommand('');

    try {
      await executeCommand(activeSession.id, command);
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  }, [currentCommand, activeSession, executeCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > -1) {
        const newIndex = historyIndex === commandHistory.length - 1 ? -1 : historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(newIndex === -1 ? '' : commandHistory[newIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // TODO: Implement tab completion
    }
  }, [commandHistory, historyIndex]);

  const handleCopyOutput = useCallback(() => {
    if (!activeSession?.output || activeSession.output.length === 0) return;
    
    const text = activeSession.output
      .map(output => output.content)
      .join('');
    
    navigator.clipboard.writeText(text).then(() => {
      console.log('Terminal output copied to clipboard');
    });
  }, [activeSession?.output]);

  const handleClearOutput = useCallback(() => {
    if (activeTabId) {
      clearTabOutput(activeTabId);
    }
  }, [activeTabId, clearTabOutput]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play size={12} className="text-green-500 animate-pulse" />;
      case 'error': return <Square size={12} className="text-red-500" />;
      default: return <TerminalIcon size={12} className="text-gray-500" />;
    }
  };

  const getOutputTypeClass = (type: string) => {
    switch (type) {
      case 'stderr': return 'text-red-400';
      case 'command': return 'text-blue-400 font-medium';
      case 'error': return 'text-red-500 font-medium';
      case 'info': return 'text-yellow-400';
      default: return 'text-gray-300';
    }
  };

  const filteredOutput = activeSession?.output?.filter(output => 
    !searchQuery || output.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-gray-100 ${className}`}>
      {/* Terminal Tabs Header */}
      <div className="flex items-center border-b border-gray-700 bg-gray-800">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`flex items-center px-4 py-2 border-r border-gray-700 cursor-pointer min-w-0 ${
                tab.isActive 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              <div className="flex items-center space-x-2 min-w-0">
                {getStatusIcon(tab.status)}
                <span className="text-sm truncate">{tab.name}</span>
                {tab.hasUnsavedOutput && (
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                )}
              </div>
              <button
                onClick={(e) => handleCloseTab(tab.id, e)}
                className="ml-2 p-1 hover:bg-gray-600 rounded"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="flex items-center space-x-2 px-4">
          <button
            onClick={handleCreateTab}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="ახალი ტერმინალი"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="ძებნა"
          >
            <Search size={16} />
          </button>
          <button
            onClick={handleCopyOutput}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="ასლის აღება"
            disabled={!activeSession?.output?.length}
          >
            <Copy size={16} />
          </button>
          <button
            onClick={handleClearOutput}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="გასუფთავება"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b border-gray-700 p-2 bg-gray-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ძებნა ტერმინალის შედეგებში..."
            className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Terminal Content */}
      {activeTab && activeSession ? (
        <div className="flex-1 flex flex-col">
          {/* Session Info Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Folder size={12} />
                <span>{activeSession.workingDirectory}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock size={12} />
                <span>ბოლო აქტივობა: {new Date(activeSession.lastActivity).toLocaleTimeString()}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-xs ${
                activeSession.status === 'running' ? 'bg-green-900 text-green-300' :
                activeSession.status === 'error' ? 'bg-red-900 text-red-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {activeSession.status}
              </span>
            </div>
          </div>

          {/* Terminal Output */}
          <div 
            ref={terminalOutputRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed"
            style={{ 
              backgroundColor: '#0d1117',
              scrollbarWidth: 'thin',
              scrollbarColor: '#6b7280 #1f2937'
            }}
          >
            {filteredOutput.length === 0 && (
              <div className="text-gray-500 text-center py-8">
                {searchQuery ? 'შედეგები ვერ მოიძებნა' : 'ტერმინალი მზადაა ბრძანებისთვის...'}
              </div>
            )}
            {filteredOutput.map((output, index) => (
              <div 
                key={index} 
                className={`${getOutputTypeClass(output.type)} whitespace-pre-wrap break-words`}
              >
                {output.content}
              </div>
            ))}
          </div>

          {/* Command Input */}
          <form onSubmit={handleCommandSubmit} className="border-t border-gray-700 bg-gray-800">
            <div className="flex items-center px-4 py-3">
              <span className="text-green-400 font-mono text-sm mr-2">$</span>
              <input
                ref={commandInputRef}
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="შეიყვანეთ ბრძანება..."
                className="flex-1 bg-transparent border-none outline-none text-white font-mono text-sm placeholder-gray-500"
                disabled={activeSession.status === 'running'}
                autoFocus
              />
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <ChevronUp size={12} />
                  <ChevronDown size={12} />
                  <span>ისტორია</span>
                </span>
                <span>Tab - დასრულება</span>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-500">
            <TerminalIcon size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-lg mb-2">ტერმინალი არ არის არჩეული</p>
            <p className="text-sm mb-4">შექმენით ახალი ტერმინალი დასაწყებად</p>
            <button
              onClick={handleCreateTab}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 mx-auto"
            >
              <Plus size={16} />
              <span>ახალი ტერმინალი</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiTabTerminal;