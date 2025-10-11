import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
  Globe,
  Bell,
  BellOff,
  Settings,
  Trash2
} from 'lucide-react';
import { useRealTimeErrors } from '../hooks/useRealTimeErrors';

interface RealTimeErrorMonitorProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ka' | 'en';
  onLanguageChange: (language: 'ka' | 'en') => void;
  position?: 'topRight' | 'topLeft' | 'bottomRight' | 'bottomLeft';
  showToasts?: boolean;
}

const RealTimeErrorMonitor: React.FC<RealTimeErrorMonitorProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
  position = 'topRight',
  showToasts = true
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastsEnabled] = useState(showToasts);
  const [severity, setSeverity] = useState<'critical' | 'error' | 'warning' | 'info' | 'all'>('all');
  
  const {
    errors,
    recentErrors,
    connectionStatus,
    errorCount,
    criticalErrors,
    dismissError,
    clearErrors,
    reconnect,
    emitTestError
  } = useRealTimeErrors({ language, severity, autoConnect: true });

  const getSeverityIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSeverityBgColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-900/20 border-red-500/20';
      case 'error':
        return 'bg-red-900/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-500/20';
      case 'info':
        return 'bg-blue-900/20 border-blue-500/20';
      default:
        return 'bg-gray-800/20 border-gray-500/20';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return language === 'ka' ? 'ახლახანს' : 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return language === 'ka' ? `${minutes} წუთის წინ` : `${minutes}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // Play sound for critical errors
  useEffect(() => {
    if (soundEnabled && criticalErrors.length > 0) {
      // Simple beep sound (could be enhanced with actual audio files)
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
          console.warn('Could not play error sound:', error);
        }
      }
    }
  }, [criticalErrors.length, soundEnabled]);

  if (!isOpen) {
    return null;
  }

  const positionClasses = {
    topRight: 'top-4 right-4',
    topLeft: 'top-4 left-4',
    bottomRight: 'bottom-4 right-4',
    bottomLeft: 'bottom-4 left-4'
  };

  return (
    <>
      {/* Error Monitor Panel */}
      <div className={`fixed ${positionClasses[position]} z-50 w-96 max-h-[80vh] bg-gray-900 border border-gray-700 rounded-lg shadow-xl`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.status === 'connected' ? 'bg-green-400' : connectionStatus.status === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />
            <h3 className="text-white font-semibold">
              {language === 'ka' ? 'შეცდომების მონიტორინგი' : 'Error Monitor'}
            </h3>
            <span className="text-xs text-gray-400">
              ({errorCount.total})
            </span>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Language Toggle */}
            <button
              onClick={() => onLanguageChange(language === 'ka' ? 'en' : 'ka')}
              className="p-1 text-gray-400 hover:text-white rounded transition-colors"
              title={language === 'ka' ? 'Switch to English' : 'ქართულზე გადართვა'}
            >
              <Globe className="w-4 h-4" />
            </button>
            
            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 text-gray-400 hover:text-white rounded transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {/* Reconnect */}
            <button
              onClick={reconnect}
              className="p-1 text-gray-400 hover:text-white rounded transition-colors"
              disabled={connectionStatus.status === 'connecting'}
            >
              <RefreshCw className={`w-4 h-4 ${connectionStatus.status === 'connecting' ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Close */}
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">
                  {language === 'ka' ? 'ხმის შეტყობინებები' : 'Sound Notifications'}
                </span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">
                  {language === 'ka' ? 'სიმძიმის ფილტრი' : 'Severity Filter'}
                </span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="bg-gray-700 text-white text-xs border border-gray-600 rounded px-2 py-1"
                >
                  <option value="all">{language === 'ka' ? 'ყველა' : 'All'}</option>
                  <option value="critical">{language === 'ka' ? 'კრიტიკული' : 'Critical'}</option>
                  <option value="error">{language === 'ka' ? 'შეცდომები' : 'Errors'}</option>
                  <option value="warning">{language === 'ka' ? 'გაფრთხილებები' : 'Warnings'}</option>
                  <option value="info">{language === 'ka' ? 'ინფორმაცია' : 'Info'}</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => emitTestError()}
                  className="flex-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded transition-colors"
                >
                  {language === 'ka' ? 'ტესტი' : 'Test'}
                </button>
                <button
                  onClick={clearErrors}
                  className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  {language === 'ka' ? 'გაწმენდა' : 'Clear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className={`flex items-center space-x-1 ${getConnectionStatusColor()}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus.status === 'connected' ? 'bg-green-400' : connectionStatus.status === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span>
                {connectionStatus.status === 'connected'
                  ? (language === 'ka' ? 'დაკავშირებულია' : 'Connected')
                  : connectionStatus.status === 'connecting'
                  ? (language === 'ka' ? 'კავშირი...' : 'Connecting...')
                  : (language === 'ka' ? 'კავშირი გაწყვეტილია' : 'Disconnected')
                }
              </span>
            </span>
            
            <div className="text-gray-400">
              <span className="text-red-400 font-mono">{errorCount.critical + errorCount.error}</span>
              <span className="mx-1">/</span>
              <span className="text-yellow-400 font-mono">{errorCount.warning}</span>
              <span className="mx-1">/</span>
              <span className="text-blue-400 font-mono">{errorCount.info}</span>
            </div>
          </div>
        </div>

        {/* Errors List */}
        <div className="max-h-96 overflow-y-auto">
          {errors.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {language === 'ka' 
                ? 'შეცდომები არ მოიძებნა' 
                : 'No errors found'
              }
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className={`p-3 rounded border ${getSeverityBgColor(error.level)} hover:bg-opacity-80 transition-all`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-2 flex-1">
                      {getSeverityIcon(error.level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-white text-sm font-medium">
                            {error.emoji} {error.type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTimestamp(error.timestamp)}
                          </span>
                        </div>
                        
                        <p className="text-gray-200 text-sm mb-2">
                          {error.message}
                        </p>

                        {error.suggestions && error.suggestions.length > 0 && (
                          <div className="bg-gray-800/50 rounded p-2 mb-2">
                            <p className="text-xs text-gray-400 mb-1">
                              {language === 'ka' ? 'რეკომენდაციები:' : 'Suggestions:'}
                            </p>
                            <ul className="text-xs text-gray-300 space-y-1">
                              {error.suggestions.map((suggestion, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-400 mr-2">•</span>
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {error.recovery?.contact && (
                          <div className="text-xs text-blue-400 mt-1">
                            {error.recovery.contact}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => dismissError(error.id)}
                      className="p-1 text-gray-500 hover:text-white rounded transition-colors ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notifications for Critical Errors */}
      {toastsEnabled && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {recentErrors
            .filter(error => error.level === 'critical')
            .slice(0, 3) // Show only latest 3 critical errors as toasts
            .map((error) => (
              <div
                key={`toast-${error.id}`}
                className="bg-red-900 border border-red-500 rounded-lg p-4 shadow-lg animate-slide-in-right max-w-sm"
              >
                <div className="flex items-start space-x-2">
                  <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-white font-medium text-sm">
                        {language === 'ka' ? 'კრიტიკული შეცდომა!' : 'Critical Error!'}
                      </h4>
                      <button
                        onClick={() => dismissError(error.id)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-red-200 text-sm">
                      {error.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  );
};

export default RealTimeErrorMonitor;