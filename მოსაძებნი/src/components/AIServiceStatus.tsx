
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface AIServiceStatusProps {
  onStatusChange?: (status: 'healthy' | 'degraded' | 'offline') => void;
}

const AIServiceStatus: React.FC<AIServiceStatusProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'degraded' | 'offline'>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const checkAIServiceHealth = async () => {
    try {
      setStatus('checking');
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setStatus('healthy');
          setErrorDetails(null);
          onStatusChange?.('healthy');
        } else {
          setStatus('degraded');
          setErrorDetails(data.errors?.[0]?.error || 'სერვისში პრობლემები');
          onStatusChange?.('degraded');
        }
      } else {
        setStatus('offline');
        setErrorDetails(`HTTP ${response.status}: სერვისი მიუწვდომელია`);
        onStatusChange?.('offline');
      }
    } catch (error) {
      setStatus('offline');
      setErrorDetails(error instanceof Error ? error.message : 'კავშირის პრობლემა');
      onStatusChange?.('offline');
    }
    
    setLastChecked(new Date());
  };

  useEffect(() => {
    checkAIServiceHealth();
    
    // Check every 30 seconds - DISABLED to prevent spam causing 429 errors
    // const interval = setInterval(checkAIServiceHealth, 30000);
    
    return () => {
      // clearInterval(interval); // Disabled since interval is not created
    };
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'offline':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return 'სერვისის შემოწმება...';
      case 'healthy':
        return 'AI სერვისი აქტიურია';
      case 'degraded':
        return 'AI სერვისი ნაწილობრივ მუშაობს';
      case 'offline':
        return 'AI სერვისი მიუწვდომელია';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'healthy':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'offline':
        return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  if (status === 'healthy') {
    return null; // Don't show anything when service is healthy
  }

  return (
    <div className={`border rounded-lg p-3 mb-4 ${getStatusColor()}`}>
      <div className="flex items-center space-x-2">
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
        <button
          onClick={checkAIServiceHealth}
          className="ml-auto text-sm underline hover:no-underline"
          disabled={status === 'checking'}
        >
          განახლება
        </button>
      </div>
      
      {errorDetails && (
        <div className="mt-2 text-sm opacity-75">
          <strong>დეტალები:</strong> {errorDetails}
        </div>
      )}
      
      {status === 'offline' && (
        <div className="mt-2 text-sm space-y-1">
          <div><strong>რეკომენდაციები:</strong></div>
          <ul className="list-disc list-inside space-y-1">
            <li>შეამოწმეთ ინტერნეტ კავშირი</li>
            <li>დაელოდეთ რამდენიმე წუთს და სცადეთ კვლავ</li>
            <li>თუ პრობლემა მეორდება, დაუკავშირდით ტექნიკურ მხარდაჭერას</li>
          </ul>
        </div>
      )}
      
      {lastChecked && (
        <div className="mt-2 text-xs opacity-60">
          ბოლო შემოწმება: {lastChecked.toLocaleTimeString('ka-GE')}
        </div>
      )}
    </div>
  );
};

export default AIServiceStatus;
