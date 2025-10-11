// @ts-nocheck
import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ConsoleFilters } from '../consoleStore';
import { Pause, Play, Trash2, Download, Terminal, RefreshCcw } from 'lucide-react';
import { AdvancedFilters } from './AdvancedFilters';

interface ConsoleToolbarProps {
  filters: ConsoleFilters;
  onFiltersChange: (filters: Partial<ConsoleFilters>) => void;
  onClear: () => void;
  onPause: () => void;
  onJumpToLatest: () => void;
  onExport: () => void;
  onReload?: () => void;
  onToggleServices: () => void;
  onToggleTerminal?: () => void;
  isPaused: boolean;
  showServices: boolean;
  showTerminal?: boolean;
  tabs?: Array<{ id: string; label: string; icon?: LucideIcon }>;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export const ConsoleToolbar: React.FC<ConsoleToolbarProps> = ({
  filters,
  onFiltersChange,
  onPause,
  onJumpToLatest,
  onClear,
  onExport,
  onReload,
  onToggleServices,
  onToggleTerminal,
  isPaused,
  showServices,
  showTerminal = false,
  tabs = [],
  activeTab,
  onTabChange
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    sources: filters.source !== 'all' ? filters.source.split(',') : [],
    levels: filters.level !== 'all' ? filters.level.split(',') : [],
    httpStatus: [],
    routes: [],
    regex: filters.regex || '',
    regexEnabled: !!filters.regex
  });

  

  return (
    <div className="console-toolbar flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-gray-900 border-b">
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 mr-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-500 text-white border-blue-600'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {Icon && <Icon size={14} />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Source Filter */}
      <select
        value={filters.source}
        onChange={(e) => onFiltersChange({ source: e.target.value as ConsoleFilters['source'] })}
        className="px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
      >
        <option value="all">All Sources</option>
        <option value="ai">AI Service</option>
        <option value="backend">Backend</option>
        <option value="frontend">Frontend</option>
      </select>

      {/* Level Filter */}
      <select
        value={filters.level}
        onChange={(e) => onFiltersChange({ level: e.target.value as ConsoleFilters['level'] })}
        className="px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
      >
        <option value="all">All Levels</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
        <option value="debug">Debug</option>
      </select>

      {/* Text Filter */}
      <input
        id="console-filter-input"
        type="text"
        placeholder="Filter text..."
        value={filters.text}
        onChange={(e) => onFiltersChange({ text: e.target.value })}
        className="px-2 py-1 text-sm border rounded flex-1 min-w-32 dark:bg-gray-800 dark:border-gray-600"
      />

      {/* Regex Toggle */}
      <div className="flex items-center space-x-1">
        <input
          type="checkbox"
          id="regex-toggle"
          checked={!!filters.regex}
          onChange={(e) => onFiltersChange({ regex: e.target.checked ? filters.text : '' })}
          className="w-4 h-4"
        />
        <label htmlFor="regex-toggle" className="text-sm text-gray-600 dark:text-gray-400">
          Regex
        </label>
      </div>

      {/* Time Range */}
      <select
        value={filters.timeRange}
        onChange={(e) => onFiltersChange({ timeRange: e.target.value as ConsoleFilters['timeRange'] })}
        className="px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
      >
        <option value="all">All Time</option>
        <option value="5m">Last 5m</option>
        <option value="15m">Last 15m</option>
        <option value="1h">Last 1h</option>
      </select>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {onReload && (
          <button
            onClick={onReload}
            className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            title="Reload Logs"
          >
            🔄 Reload
          </button>
        )}

        <button
          onClick={onToggleServices}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showServices
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="View Services and Routes"
        >
          🧭 View Services
        </button>

        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center space-x-1 ${
              showTerminal
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Multi-Tab Terminal"
          >
            <Terminal size={12} />
            <span>Terminal</span>
          </button>
        )}

        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showAdvancedFilters
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          title="Advanced Filters"
        >
          ⚙️ Advanced
        </button>

        <button
          onClick={onExport}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
          title="Export logs"
        >
          <Download size={14} className="mr-1 inline" />
          Export
        </button>

        <button
          onClick={onPause}
          className={`px-3 py-1 text-sm rounded ${
            isPaused
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}
          title="Ctrl/⌘+P"
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <button
          onClick={onJumpToLatest}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
          title="Ctrl/⌘+J"
        >
          ⬇ Latest
        </button>

        <button
          onClick={onClear}
          className="px-3 py-1 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded"
        >
          🗑 Clear
        </button>

        {onReload && (
          <button
            onClick={onReload}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 rounded"
            title="Reload logs"
          >
            <RefreshCcw size={14} className="mr-1 inline" />
            Reload
          </button>
        )}
      </div>
      {showAdvancedFilters && (
        <AdvancedFilters
          filters={advancedFilters}
          onFiltersChange={(newFilters) => {
            setAdvancedFilters(newFilters);

            // Create a partial filters object to pass to onFiltersChange
            const updatedFilters: Partial<ConsoleFilters> = {};

            // Map advanced filters to console filters - handle single vs multiple selection
            if (newFilters.sources.length === 1) {
              updatedFilters.source = newFilters.sources[0] as 'all' | 'ai' | 'backend' | 'frontend';
            } else if (newFilters.sources.length === 0) {
              updatedFilters.source = 'all';
            } else {
              // If multiple sources selected, default to 'all' for now
              updatedFilters.source = 'all';
            }

            if (newFilters.levels.length === 1) {
              updatedFilters.level = newFilters.levels[0] as 'all' | 'info' | 'warn' | 'error';
            } else if (newFilters.levels.length === 0) {
              updatedFilters.level = 'all';
            } else {
              // If multiple levels selected, default to 'all' for now
              updatedFilters.level = 'all';
            }

            // Apply regex filter if enabled
            if (newFilters.regexEnabled && newFilters.regex) {
              updatedFilters.regex = newFilters.regex;
              updatedFilters.text = ''; // Clear text filter when using regex
            } else {
              updatedFilters.regex = '';
            }

            // Call the parent's onFiltersChange with the mapped filters
            onFiltersChange(updatedFilters);

            setShowAdvancedFilters(false);
          }}
          onClose={() => setShowAdvancedFilters(false)}
        />
      )}
    </div>
  );
};