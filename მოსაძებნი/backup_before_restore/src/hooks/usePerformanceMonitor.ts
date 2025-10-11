
import { useState, useEffect, useCallback, useRef } from 'react';

interface PerformanceData {
  renderCount: number;
  averageRenderTime: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  } | null;
  networkSpeed: number;
  dataSource: string;
}

export const usePerformanceMonitor = (componentName: string): PerformanceData => {
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    renderCount: 0,
    averageRenderTime: 0,
    memoryUsage: null,
    networkSpeed: 0,
    dataSource: 'Mock Data (Fast Loading)'
  });

  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(performance.now());

  const updateMemoryUsage = useCallback(() => {
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryData = {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
        };
        
        setPerformanceData(prev => ({
          ...prev,
          memoryUsage: memoryData
        }));
      }
    } catch (error) {
      // Silent fail
    }
  }, []);

  const updateNetworkSpeed = useCallback(() => {
    try {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        setPerformanceData(prev => ({
          ...prev,
          networkSpeed: connection?.downlink || 0
        }));
      }
    } catch (error) {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    renderCountRef.current += 1;
    const now = performance.now();
    const renderTime = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    
    renderTimesRef.current.push(renderTime);
    if (renderTimesRef.current.length > 3) {
      renderTimesRef.current = renderTimesRef.current.slice(-3);
    }
    
    const avgRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
    
    // Update performance data much less frequently to reduce overhead
    if (renderCountRef.current % 5 === 0) {
      setPerformanceData(prev => ({
        ...prev,
        renderCount: renderCountRef.current,
        averageRenderTime: Math.round(avgRenderTime * 100) / 100
      }));
    }

    // Only update memory and network every 20 renders to reduce overhead
    if (renderCountRef.current % 20 === 0) {
      updateMemoryUsage();
      updateNetworkSpeed();
    }
  });

  return performanceData;
};
