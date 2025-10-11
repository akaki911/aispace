import { useState, useEffect, useRef, useCallback } from 'react';
import { AIMemoryData } from '../../types/aimemory';

interface MemorySyncState {
  data: AIMemoryData;
  setData: React.Dispatch<React.SetStateAction<AIMemoryData>>;
  status: 'idle' | 'connecting' | 'connected' | 'error';
  connect: () => void;
  disconnect: () => void;
}

const defaultData: AIMemoryData = {
  personalInfo: { language: 'ka', role: 'developer', codeStyle: 'TypeScript functional' },
  savedRules: [],
  errorLogs: [],
  contextActions: [],
  codePreferences: [],
  stats: { accuracy: 0, items: 0, memoryMB: 0, lastSync: 0 },
  // გურულოს დეფოლტ მეხსიერება
  guruloInteractions: [],
  guruloContext: [],
  guruloPreferences: {
    responseStyle: 'detailed',
    language: 'ka',
    codeCommentStyle: 'georgian',
    explanationLevel: 'intermediate'
  },
  guruloFacts: []
};

export const useMemorySync = (): MemorySyncState => {
  const [data, setData] = useState<AIMemoryData>(defaultData);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseConnectedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // localStorage save with debounce
  const saveToLocalStorage = useCallback((newData: AIMemoryData) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem('ai-memory-data', JSON.stringify(newData));
      } catch (error) {
        console.warn('Failed to save to localStorage:', error);
      }
    }, 1000);
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai-memory-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(parsed);
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    saveToLocalStorage(data);
  }, [data, saveToLocalStorage]);

  const connect = useCallback(() => {
    if (sseConnectedRef.current) return;
    
    setStatus('connecting');
    try {
      const eventSource = new EventSource('/api/memory/realtime-errors');
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        sseConnectedRef.current = true;
        setStatus('connected');
      };
      
      eventSource.onerror = () => {
        sseConnectedRef.current = false;
        setStatus('error');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const newError = JSON.parse(event.data);
          setData(prev => ({
            ...prev,
            errorLogs: [...prev.errorLogs, newError]
          }));
        } catch (error) {
          console.warn('SSE message parse error:', error);
        }
      };
    } catch (error) {
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    sseConnectedRef.current = false;
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [disconnect]);

  return { data, setData, status, connect, disconnect };
};