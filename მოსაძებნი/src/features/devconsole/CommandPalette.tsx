
import React, { useState, useEffect, useRef } from 'react';
import { useDevConsoleStore } from './store';

interface Command {
  id: string;
  label: string;
  description: string;
  action: () => void;
  shortcut?: string;
}

export const CommandPalette: React.FC = () => {
  const { theme, setActiveTab } = useDevConsoleStore();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Commands list
  const commands: Command[] = [
    {
      id: 'console',
      label: '📝 Console-ზე გადასვლა',
      description: 'ლოგების ნახვა და ფილტრაცია',
      action: () => { setActiveTab('console'); setIsOpen(false); }
    },
    {
      id: 'metrics',
      label: '📊 Metrics-ზე გადასვლა',
      description: 'სისტემის მეტრიკების ნახვა',
      action: () => { setActiveTab('metrics'); setIsOpen(false); }
    },
    {
      id: 'jobs',
      label: '🏃 Jobs-ზე გადასვლა',
      description: 'ბრძანებების და ჯობების მართვა',
      action: () => { setActiveTab('jobs'); setIsOpen(false); }
    },
    {
      id: 'tests',
      label: '🧪 Tests-ზე გადასვლა',
      description: 'ტესტების გაშვება და შედეგების ნახვა',
      action: () => { setActiveTab('tests'); setIsOpen(false); }
    },
    {
      id: 'clear-logs',
      label: '🗑️ ლოგების გასუფთავება',
      description: 'ყველა ლოგის წაშლა',
      action: () => { /* Clear logs logic */ setIsOpen(false); }
    },
    {
      id: 'export-logs',
      label: '📥 ლოგების ექსპორტი',
      description: 'ლოგების JSON ფაილად შენახვა',
      action: () => { /* Export logs logic */ setIsOpen(false); }
    },
    {
      id: 'restart-backend',
      label: '🔄 Backend-ის რესტარტი',
      description: 'Backend სერვისის გადატვირთვა',
      action: () => { /* Restart backend */ setIsOpen(false); }
    },
    {
      id: 'restart-ai',
      label: '🤖 AI Service-ის რესტარტი',
      description: 'AI მიკროსერვისის გადატვირთვა',
      action: () => { /* Restart AI */ setIsOpen(false); }
    }
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      
      // Arrow navigation
      if (isOpen && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
        }
        
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
        }
        
        // Enter to execute
        if (e.key === 'Enter') {
          e.preventDefault();
          filteredCommands[selectedIndex]?.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center pt-32 z-50">
      <div className={`w-full max-w-2xl mx-4 rounded-lg shadow-2xl ${
        theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      } border`}>
        
        {/* Header */}
        <div className={`px-4 py-3 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
        }`}>
          <input
            ref={inputRef}
            type="text"
            placeholder="ბრძანების ძებნა... (Ctrl/⌘+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`w-full text-lg bg-transparent outline-none ${
              theme === 'dark' ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <p>ვერ მოიძებნა ბრძანება "{query}"</p>
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                onClick={() => command.action()}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-900'
                    : theme === 'dark'
                      ? 'hover:bg-gray-700'
                      : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{command.label}</div>
                    <div className={`text-sm ${
                      index === selectedIndex
                        ? 'text-blue-100'
                        : 'text-gray-500'
                    }`}>
                      {command.description}
                    </div>
                  </div>
                  
                  {command.shortcut && (
                    <div className={`px-2 py-1 rounded text-xs font-mono ${
                      index === selectedIndex
                        ? 'bg-blue-700 text-blue-100'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-200 text-gray-700'
                    }`}>
                      {command.shortcut}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2 border-t text-xs text-gray-500 ${
          theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between">
            <span>⌨️ Navigation: ↑↓ Arrow keys, ↵ Enter, Esc Close</span>
            <span>{filteredCommands.length} ბრძანება</span>
          </div>
        </div>
      </div>
    </div>
  );
};
