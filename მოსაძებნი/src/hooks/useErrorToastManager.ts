
import { useState, useCallback, useEffect } from 'react';

interface ErrorToast {
  id: string;
  type: 'error' | 'warning' | 'network' | 'validation';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  timestamp: number;
  dismissed?: boolean;
}

interface UseErrorToastManagerReturn {
  toasts: ErrorToast[];
  showToast: (type: ErrorToast['type'], message: string, severity?: ErrorToast['severity'], component?: string) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useErrorToastManager = (): UseErrorToastManagerReturn => {
  const [toasts, setToasts] = useState<ErrorToast[]>([]);

  const showToast = useCallback((
    type: ErrorToast['type'], 
    message: string, 
    severity: ErrorToast['severity'] = 'medium',
    component?: string
  ) => {
    // დუბლირების თავიდან აცილება - ვამოწმებთ იგივე შეტყობინება იყო ბოლო 5 წამში
    const recentDuplicate = toasts.find(toast => 
      toast.message === message && 
      Date.now() - toast.timestamp < 5000 && 
      !toast.dismissed
    );

    if (recentDuplicate) {
      console.log('🔇 Duplicate toast suppressed:', message);
      return;
    }

    const newToast: ErrorToast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      severity,
      component,
      timestamp: Date.now()
    };

    console.log('🍞 Showing toast:', newToast);

    setToasts(prev => [...prev.slice(-4), newToast]); // Keep only last 5 toasts

    // Auto-dismiss non-critical toasts
    if (severity !== 'critical') {
      const duration = severity === 'high' ? 8000 : severity === 'medium' ? 5000 : 3000;
      setTimeout(() => {
        dismissToast(newToast.id);
      }, duration);
    }
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, dismissed: true } : toast
    ));

    // Remove dismissed toasts after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Listen for custom UI error events
  useEffect(() => {
    const handleUIError = (event: CustomEvent) => {
      const { type, message, severity, component } = event.detail;
      showToast(type, message, severity, component);
    };

    window.addEventListener('ui-error', handleUIError as EventListener);

    return () => {
      window.removeEventListener('ui-error', handleUIError as EventListener);
    };
  }, [showToast]);

  return {
    toasts: toasts.filter(toast => !toast.dismissed),
    showToast,
    dismissToast,
    clearAllToasts
  };
};
