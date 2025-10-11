
import React from 'react';
import { useDevConsoleStore } from './store';
import { 
  ChatBubbleLeftIcon, 
  CommandLineIcon, 
  DocumentTextIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  PlayIcon,
  BeakerIcon,
  ChartBarIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';

export const Sidebar: React.FC = () => {
  const { 
    activeTab, 
    sidebarCollapsed, 
    theme,
    setActiveTab, 
    setSidebarCollapsed 
  } = useDevConsoleStore();

  const menuItems = [
    { id: 'chat', icon: ChatBubbleLeftIcon, label: 'Chat', disabled: true },
    { id: 'console', icon: CommandLineIcon, label: 'Console' },
    { id: 'files', icon: DocumentTextIcon, label: 'Files', disabled: true },
    { id: 'memory', icon: CircleStackIcon, label: 'Memory', disabled: true },
    { id: 'settings', icon: Cog6ToothIcon, label: 'Settings', disabled: true },
    { id: 'jobs', icon: PlayIcon, label: 'Jobs' },
    { id: 'tests', icon: BeakerIcon, label: 'Tests' },
    { id: 'metrics', icon: ChartBarIcon, label: 'Metrics' }
  ];

  return (
    <div className={`fixed left-0 top-8 bottom-0 transition-all duration-300 z-10 ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    } ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-300'
    } border-r`}>
      
      {/* Toggle Button */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-2 rounded-lg hover:bg-gray-700 transition-colors ${
            theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
      </div>
      
      {/* Menu Items */}
      <nav className="p-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.disabled;
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id as any)}
              disabled={isDisabled}
              className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors mb-1 ${
                isActive 
                  ? theme === 'dark' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 text-blue-800'
                  : isDisabled
                  ? theme === 'dark'
                    ? 'text-gray-500 cursor-not-allowed'
                    : 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                  ? 'text-gray-300 hover:bg-gray-700'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              {!sidebarCollapsed && (
                <span className="ml-3 text-sm font-medium">
                  {item.label}
                  {isDisabled && ' (Soon)'}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
