
import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, AlertCircle, XCircle, Zap } from 'lucide-react';

interface ProgressStep {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'error';
  timestamp?: string;
  details?: string;
}

interface ProgressEvent {
  id: string;
  type: 'scan' | 'generate' | 'dry-run' | 'test' | 'apply' | 'verify' | 'complete' | 'rollback';
  message: string;
  timestamp: string;
  data?: any;
}

interface LiveProgressPanelProps {
  className?: string;
}

const LiveProgressPanel: React.FC<LiveProgressPanelProps> = ({ className = '' }) => {
  const [currentStep, setCurrentStep] = useState<string>('waiting');
  const [progressData, setProgressData] = useState({
    totalFiles: 0,
    processedFiles: 0,
    currentTask: 'მზადება...',
    percentage: 0
  });
  const [recentEvents, setRecentEvents] = useState<ProgressEvent[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

  const steps: ProgressStep[] = [
    { id: 'scanning', name: 'SCANNING', status: 'waiting' },
    { id: 'generating', name: 'GENERATING', status: 'waiting' },
    { id: 'dry-run', name: 'DRY-RUN', status: 'waiting' },
    { id: 'tests', name: 'TESTS', status: 'waiting' },
    { id: 'apply', name: 'APPLY', status: 'waiting' },
    { id: 'verify', name: 'VERIFY', status: 'waiting' },
    { id: 'done', name: 'DONE', status: 'waiting' }
  ];

  const [currentSteps, setCurrentSteps] = useState<ProgressStep[]>(steps);

  // Mock progress simulation for demonstration
  useEffect(() => {
    if (!isActive) return;

    const stepOrder = ['scanning', 'generating', 'dry-run', 'tests', 'apply', 'verify', 'done'];
    let currentStepIndex = 0;

    const progressInterval = setInterval(() => {
      if (currentStepIndex < stepOrder.length) {
        const stepId = stepOrder[currentStepIndex];
        
        setCurrentSteps(prev => prev.map(step => ({
          ...step,
          status: step.id === stepId ? 'active' : 
                 stepOrder.indexOf(step.id) < currentStepIndex ? 'completed' : 'waiting'
        })));

        setCurrentStep(stepId);
        
        // Add progress event
        const event: ProgressEvent = {
          id: `event_${Date.now()}`,
          type: stepId as any,
          message: getStepMessage(stepId),
          timestamp: new Date().toISOString()
        };

        setRecentEvents(prev => [event, ...prev].slice(0, 20));

        // Update progress data
        setProgressData(prev => ({
          ...prev,
          percentage: ((currentStepIndex + 1) / stepOrder.length) * 100,
          currentTask: getStepMessage(stepId),
          processedFiles: Math.min(prev.processedFiles + Math.floor(Math.random() * 3), prev.totalFiles)
        }));

        currentStepIndex++;
      } else {
        setIsActive(false);
        clearInterval(progressInterval);
      }
    }, 2000);

    return () => clearInterval(progressInterval);
  }, [isActive]);

  const getStepMessage = (stepId: string): string => {
    const messages: Record<string, string> = {
      scanning: '📁 ფაილების სკანირება...',
      generating: '✨ AI წინადადებების გენერირება...',
      'dry-run': '🔍 წინასწარი ვალიდაცია...',
      tests: '🧪 ტესტების გაშვება...',
      apply: '⚡ ცვლილებების გამოყენება...',
      verify: '✅ შედეგების ვერიფიკაცია...',
      done: '🎉 წარმატებით დასრულდა!'
    };
    return messages[stepId] || stepId;
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'active': return <Zap className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const startDemo = () => {
    setIsActive(true);
    setProgressData({
      totalFiles: 15,
      processedFiles: 0,
      currentTask: 'მზადება...',
      percentage: 0
    });
    setRecentEvents([]);
    setCurrentSteps(steps);
  };

  return (
    <div className={`bg-[#2C313A] border border-[#3E4450] rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' :
            connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400'
          }`}></div>
          <span className="text-white font-medium">
            {connectionStatus === 'connected' ? '🟢 კავშირი აქტიურია' :
             connectionStatus === 'connecting' ? '🟡 ერთდება...' :
             '🔴 კავშირი გაწყვეტილია'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isActive && (
            <button
              onClick={startDemo}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
            >
              დემო გაშვება
            </button>
          )}
          <div className="text-xs text-gray-400">
            ბოლო განახლება: {new Date().toLocaleTimeString('ka-GE')}
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">სტატუსის ზოლი</span>
          <span className="text-sm text-gray-400">{progressData.percentage.toFixed(0)}%</span>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          {currentSteps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                px-2 py-1 rounded text-xs font-medium transition-all
                ${step.status === 'active' ? 'bg-blue-600 text-white' :
                  step.status === 'completed' ? 'bg-green-600 text-white' :
                  step.status === 'error' ? 'bg-red-600 text-white' :
                  'bg-gray-700 text-gray-300'}
              `}>
                {step.name}
              </div>
              {index < currentSteps.length - 1 && (
                <div className={`w-4 h-0.5 mx-1 ${
                  step.status === 'completed' ? 'bg-green-400' : 'bg-gray-600'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressData.percentage}%` }}
          />
        </div>
      </div>

      {/* Current Task */}
      <div className="mb-4 p-3 bg-[#21252B] rounded border border-[#3E4450]">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-400">რაოდენობრივი პროგრესი</span>
        </div>
        <div className="text-white font-medium">{progressData.processedFiles}/{progressData.totalFiles} ფაილი</div>
        <div className="text-sm text-gray-300">{progressData.currentTask}</div>
      </div>

      {/* Recent Events */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">ბოლო მოვლენები</span>
          <span className="text-xs text-gray-500">ბოლო 20</span>
        </div>
        
        <div className="max-h-40 overflow-y-auto space-y-1 console-scrollbar">
          {recentEvents.length === 0 ? (
            <div className="text-center text-gray-500 py-4 text-sm">
              მოვლენების მონაცემები მალე გამოჩნდება...
            </div>
          ) : (
            recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-2 p-2 bg-[#21252B] rounded text-xs">
                <div className="flex-shrink-0 mt-0.5">
                  {getStepIcon('completed')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300">{event.message}</div>
                  <div className="text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString('ka-GE')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-[#3E4450]">
        <button 
          className="w-full px-3 py-2 bg-[#3E4450] hover:bg-[#4A5568] text-gray-300 hover:text-white text-sm rounded transition-all flex items-center justify-center gap-2"
          onClick={() => {/* TODO: Implement full logs */}}
        >
          <Activity className="w-4 h-4" />
          ნახე სრული ლოგი
        </button>
      </div>
    </div>
  );
};

export default LiveProgressPanel;
