import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from './storage';

export interface ConsoleFilters {
  source: 'all' | 'ai' | 'backend' | 'frontend';
  level: 'all' | 'info' | 'warn' | 'error';
  text: string;
  regex: string;
  timeRange: '5m' | '15m' | '1h' | 'all';
}

export interface ConsoleUI {
  autoscroll: boolean;
  paused: boolean;
  theme: 'light' | 'dark' | 'auto';
  layout: 'compact' | 'comfortable';
}

export interface ConsoleState {
  filters: ConsoleFilters;
  ui: ConsoleUI;
  pinnedLogs: Set<string>;
  bufferSize: number;
  droppedCount: number;

  // Actions
  updateFilter: (key: keyof ConsoleFilters, value: string) => void;
  resetFilters: () => void;
  toggleAutoscroll: () => void;
  togglePause: () => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLayout: (layout: 'compact' | 'comfortable') => void;
  pinLog: (logId: string) => void;
  unpinLog: (logId: string) => void;
  clearPinnedLogs: () => void;
  jumpToLatest: () => void;
  clearLogs: () => void;
  setFilters: (partialFilters: Partial<ConsoleFilters>) => void; // Added setFilters
}

export interface ConsoleStoreActions {
  togglePinLog: (logId: string) => void;
  setSourceFilter: (source: string) => void;
  setLevelFilter: (level: string) => void;
  setTextFilter: (text: string) => void;
  setRegexFilter: (regex: string) => void;
  setTimeRangeFilter: (timeRange: string) => void;
  jumpToLatest: () => void;
  clearLogs: () => void;
}

const getInitialFilters = (): ConsoleFilters => {
  const cachedFilters = storage.getCachedData<ConsoleFilters>('FILTERS', {
    source: 'all',
    level: 'all',
    text: '',
    regex: '',
    timeRange: 'all'
  });
  return cachedFilters;
};

const defaultFilters: ConsoleFilters = getInitialFilters();

const defaultUI: ConsoleUI = {
  autoscroll: true,
  paused: false,
  theme: 'auto',
  layout: 'comfortable'
};

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set, _get) => ({
      filters: defaultFilters,
      ui: defaultUI,
      pinnedLogs: new Set<string>(),
      bufferSize: 0,
      droppedCount: 0,

      updateFilter: (key, value) => {
        set(state => {
          const newFilters = {
            ...state.filters,
            [key]: value
          };
          storage.setCachedData('FILTERS', newFilters);
          return { filters: newFilters };
        });
      },

      resetFilters: () => {
        const resetFilters: ConsoleFilters = {
          source: 'all' as const,
          level: 'all' as const,
          text: '',
          regex: '',
          timeRange: 'all' as const
        };
        storage.setCachedData('FILTERS', resetFilters);
        set({ filters: resetFilters });
      },

      toggleAutoscroll: () => {
        set(state => ({
          ui: {
            ...state.ui,
            autoscroll: !state.ui.autoscroll
          }
        }));
      },

      togglePause: () => {
        set(state => ({
          ui: {
            ...state.ui,
            paused: !state.ui.paused
          }
        }));
      },

      setTheme: (theme) => {
        set(state => ({
          ui: {
            ...state.ui,
            theme
          }
        }));
      },

      setLayout: (layout) => {
        set(state => ({
          ui: {
            ...state.ui,
            layout
          }
        }));
      },

      pinLog: (logId: string) => {
        set(state => ({
          pinnedLogs: new Set([...state.pinnedLogs, logId])
        }));
      },

      unpinLog: (logId) => {
        set(state => {
          const newPinned = new Set(state.pinnedLogs);
          newPinned.delete(logId);
          return { pinnedLogs: newPinned };
        });
      },

      clearPinnedLogs: () => {
        set({ pinnedLogs: new Set() });
      },

      togglePinLog: (logId) => {
        set((state) => ({
          pinnedLogs: state.pinnedLogs.has(logId)
            ? new Set([...state.pinnedLogs].filter(id => id !== logId))
            : new Set([...state.pinnedLogs, logId])
        }));
      },

      // Unified setFilters function
      setFilters: (partialFilters) => {
        set((state) => {
          const newFilters = { ...state.filters, ...partialFilters };
          storage.setCachedData('FILTERS', newFilters);
          return { filters: newFilters };
        });
      },

      // Individual filter setters
      setSourceFilter: (source: ConsoleFilters['source']) => {
        set((state) => ({
          filters: { ...state.filters, source }
        }));
      },

      setLevelFilter: (level: ConsoleFilters['level']) => {
        set((state) => ({
          filters: { ...state.filters, level }
        }));
      },

      setTextFilter: (text: string) => {
        set((state) => ({
          filters: { ...state.filters, text }
        }));
      },

      setRegexFilter: (regex: string) => {
        set((state) => ({
          filters: { ...state.filters, regex }
        }));
      },

      setTimeRangeFilter: (timeRange: ConsoleFilters['timeRange']) => {
        set((state) => ({
          filters: { ...state.filters, timeRange }
        }));
      },

      jumpToLatest: () => {
        // This will be handled by the LogList component
        const logList = document.querySelector('.console-log-list');
        if (logList) {
          logList.scrollTop = logList.scrollHeight;
        }
      },

      clearLogs: () => {
        // This will be handled by the useConsoleStream hook
      }
    }),
    {
      name: 'OURANOS_DEVCONSOLE_V2_STATE',
      partialize: (state) => ({
        filters: state.filters,
        ui: state.ui
        // Don't persist pinnedLogs (they're session-specific)
      })
    }
  )
);