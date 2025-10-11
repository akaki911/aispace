
import { useCallback } from 'react';

// Standalone debug logging hook without DebugContext dependency
export const useDebugLogging = (componentName?: string) => {
  const logInfo = useCallback((message: string, metadata?: any) => {
    console.log(`[INFO][${componentName || 'Component'}] ${message}`, metadata);
  }, [componentName]);

  const logWarn = useCallback((message: string, metadata?: any) => {
    console.warn(`[WARN][${componentName || 'Component'}] ${message}`, metadata);
  }, [componentName]);

  const logError = useCallback((message: string, metadata?: any) => {
    console.error(`[ERROR][${componentName || 'Component'}] ${message}`, metadata);
  }, [componentName]);

  const logAPI = useCallback((method: string, url: string, status: number, responseTime?: number) => {
    console.log(`[API][${componentName || 'API'}] ${method} ${url} → ${status}${responseTime ? ` (${responseTime}ms)` : ''}`);
  }, [componentName]);

  const logModal = useCallback((action: 'opened' | 'closed', modalName: string, metadata?: any) => {
    console.log(`[MODAL][${componentName || 'Modal'}] ${modalName} modal ${action}`, metadata);
  }, [componentName]);

  const logValidation = useCallback((message: string, errors?: any) => {
    console.log(`[VALIDATION][${componentName || 'Validation'}] ${message}`, errors);
  }, [componentName]);

  return {
    logInfo,
    logWarn,
    logError,
    logAPI,
    logModal,
    logValidation
  };
};
