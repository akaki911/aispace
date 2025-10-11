import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface WarningToastProps {
  isVisible: boolean;
  onClose: () => void;
  messages: string[];
  title?: string;
  type?: 'warning' | 'error' | 'success' | 'info';
  position?: 'top' | 'center' | 'bottom';
  autoClose?: boolean;
  duration?: number;
}

const WarningToast: React.FC<WarningToastProps> = ({
  isVisible,
  onClose,
  messages,
  title = "შეტყობინება",
  type = "warning",
  position = "top",
  autoClose = true,
  duration = 5000
}) => {
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    if (isVisible && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
    }
  };

  if (!isVisible || messages.length === 0) {
    return null;
  }

  const visibleMessages = showAll ? messages : messages.slice(0, 3);
  const hasMore = messages.length > 3;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -50 }}
            className={`max-w-lg w-full mx-4 rounded-2xl border-2 shadow-2xl ${getColors()}`}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  {getIcon()}
                  <h3 className="ml-3 text-xl font-bold">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {visibleMessages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
                  >
                    <div className="w-2 h-2 bg-current rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p className="text-sm font-medium">{message}</p>
                  </motion.div>
                ))}

                {hasMore && (
                  <motion.button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full flex items-center justify-center p-3 text-sm font-semibold bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-300 dark:border-gray-600"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        ნაკლების ნახვა
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        + {messages.length - 3} მეტი შეცდომა
                      </>
                    )}
                  </motion.button>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <motion.button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-600 dark:bg-gray-700 text-white rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-semibold shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  გასაგები
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WarningToast;