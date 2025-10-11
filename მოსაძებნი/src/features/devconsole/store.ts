
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LogEntry {
  ts: number;
  source: 'ai' | 'backend' | 'frontend';
  level: 'info' | 'warn' | 'error';
  message: string;
  meta?: Record<string, any>;
}

export interface MetricsData {
  ts: number;
  services: {
    backend: {
      cpu: number;
      memory: number;
      status: string;
      uptime: number;
    };
    ai: {
      cpu: number;
      memory: number;
      status: string;
      requests: number;
    };
    frontend: {
      status: string;
      buildTime: string;
    };
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

interface DevConsoleState {
  // UI State
  activeTab: 'console' | 'metrics' | 'jobs' | 'tests';
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  
  // Console State
  logs: LogEntry[];
  maxLogs: number;
  autoscroll: boolean;
  pinnedLogs: string[];
  
  // Filters
  sourceFilter: 'all' | 'ai' | 'backend' | 'frontend';
  levelFilter: 'all' | 'info' | 'warn' | 'error';
  textFilter: string;
  timeRangeFilter: 'all' | '1h' | '6h' | '24h';
  
  // Connection State
  sseStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastReconnectAt: number;
  
  // Metrics State
  metrics: MetricsData | null;
  metricsHistory: MetricsData[];
  
  // Actions
  setActiveTab: (tab: DevConsoleState['activeTab']) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: DevConsoleState['theme']) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setAutoscroll: (autoscroll: boolean) => void;
  togglePinLog: (logId: string) => void;
  setSourceFilter: (filter: DevConsoleState['sourceFilter']) => void;
  setLevelFilter: (filter: DevConsoleState['levelFilter']) => void;
  setTextFilter: (filter: string) => void;
  setTimeRangeFilter: (filter: DevConsoleState['timeRangeFilter']) => void;
  setSseStatus: (status: DevConsoleState['sseStatus']) => void;
  setMetrics: (metrics: MetricsData) => void;
  addMetricsHistory: (metrics: MetricsData) => void;
}

export const useDevConsoleStore = create<DevConsoleState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeTab: 'console',
      sidebarCollapsed: false,
      theme: 'dark',
      
      logs: [],
      maxLogs: 10000,
      autoscroll: true,
      pinnedLogs: [],
      
      sourceFilter: 'all',
      levelFilter: 'all',
      textFilter: '',
      timeRangeFilter: 'all',
      
      sseStatus: 'disconnected',
      lastReconnectAt: 0,
      
      metrics: null,
      metricsHistory: [],
      
      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
      
      addLog: (log) => set((state) => {
        const newLogs = [...state.logs, log];
        if (newLogs.length > state.maxLogs) {
          newLogs.splice(0, newLogs.length - state.maxLogs);
        }
        return { logs: newLogs };
      }),
      
      clearLogs: () => set({ logs: [] }),
      
      setAutoscroll: (autoscroll) => set({ autoscroll }),
      
      togglePinLog: (logId) => set((state) => {
        const pinned = state.pinnedLogs.includes(logId);
        return {
          pinnedLogs: pinned 
            ? state.pinnedLogs.filter(id => id !== logId)
            : [...state.pinnedLogs, logId]
        };
      }),
      
      setSourceFilter: (filter) => set({ sourceFilter: filter }),
      setLevelFilter: (filter) => set({ levelFilter: filter }),
      setTextFilter: (filter) => set({ textFilter: filter }),
      setTimeRangeFilter: (filter) => set({ timeRangeFilter: filter }),
      
      setSseStatus: (status) => set({ sseStatus: status }),
      
      setMetrics: (metrics) => set({ metrics }),
      
      addMetricsHistory: (metrics) => set((state) => {
        const newHistory = [...state.metricsHistory, metrics];
        if (newHistory.length > 100) {
          newHistory.splice(0, newHistory.length - 100);
        }
        return { metricsHistory: newHistory };
      })
    }),
    {
      name: 'dev-console-store',
      partialize: (state) => ({
        activeTab: state.activeTab,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        autoscroll: state.autoscroll,
        sourceFilter: state.sourceFilter,
        levelFilter: state.levelFilter,
        timeRangeFilter: state.timeRangeFilter
      })
    }
  )
);
