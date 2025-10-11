
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useErrorToastManager } from '../hooks/useErrorToastManager';
import WarningToast from './WarningToast';

const ErrorToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useErrorToastManager();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
          >
            <WarningToast
              isVisible={true}
              onClose={() => dismissToast(toast.id)}
              messages={[toast.message]}
              title={getToastTitle(toast.type, toast.severity)}
              type={toast.type}
              severity={toast.severity}
              component={toast.component}
              autoClose={toast.severity !== 'critical'}
              duration={getToastDuration(toast.severity)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const getToastTitle = (type: string, severity?: string): string => {
  const severityMap = {
    'low': '📝',
    'medium': '⚠️',
    'high': '🔴',
    'critical': '🚨'
  };

  const typeMap = {
    'error': 'შეცდომა',
    'warning': 'გაფრთხილება', 
    'network': 'ქსელის პრობლემა',
    'validation': 'ვალიდაციის შეცდომა',
    'info': 'ინფორმაცია'
  };

  const severityIcon = severityMap[severity as keyof typeof severityMap] || '⚠️';
  const typeText = typeMap[type as keyof typeof typeMap] || 'შეტყობინება';

  return `${severityIcon} ${typeText}`;
};

const getToastDuration = (severity?: string): number => {
  switch (severity) {
    case 'low': return 3000;
    case 'medium': return 5000;
    case 'high': return 8000;
    case 'critical': return 0; // Manual dismiss only
    default: return 5000;
  }
};

export default ErrorToastContainer;
