import React, { useState, useEffect } from 'react';
import { Play, Square, AlertCircle, Activity, Cpu, HardDrive, ExternalLink, Server, CheckCircle, AlertTriangle, XCircle, MemoryStick } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  port: number;
  url: string;
  pid?: number;
  cpu: number;
  memory: number;
  uptime: string;
  errors: Array<{
    id: string;
    message: string;
    timestamp: Date;
    stack?: string;
  }>;
  lastCheck: Date;
}

// This interface is not used in the provided code but was present in the original changes.
// It's kept here for context but is not integrated into the final ServicePanel logic.
// interface Service {
//   status: 'healthy' | 'warning' | 'error';
//   cpu: number;
//   memory: number;
// }

// interface ServicePanelProps {
//   services: {
//     frontend: Service;
//     backend: Service;
//     ai: Service;
//   };
// }

export const ServicePanel: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'AI Service',
      status: 'running',
      port: 5001,
      url: 'https://bakhmaro.replit.dev:5001',
      pid: 1234,
      cpu: 25,
      memory: 180,
      uptime: '2h 15m',
      errors: [],
      lastCheck: new Date()
    },
    {
      name: 'Backend',
      status: 'running',
      port: 5002,
      url: 'https://bakhmaro.replit.dev:5002',
      pid: 1235,
      cpu: 15,
      memory: 120,
      uptime: '2h 15m',
      errors: [],
      lastCheck: new Date()
    },
    {
      name: 'Frontend',
      status: 'running',
      port: 3000,
      url: 'https://bakhmaro.replit.dev:3000',
      pid: 1236,
      cpu: 10,
      memory: 95,
      uptime: '2h 15m',
      errors: [],
      lastCheck: new Date()
    }
  ]);

  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setServices(prev => prev.map(service => ({
        ...service,
        cpu: Math.max(5, Math.min(80, service.cpu + (Math.random() - 0.5) * 10)),
        memory: Math.max(50, Math.min(300, service.memory + (Math.random() - 0.5) * 20)),
        lastCheck: new Date()
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    const service = services.find(s => s.name === serviceName);
    if (!service) return;

    // Update status optimistically
    setServices(prev => prev.map(s => 
      s.name === serviceName 
        ? { ...s, status: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'starting' }
        : s
    ));

    try {
      const response = await fetch('/api/dev/commands/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          service: serviceName.toLowerCase().replace(' ', '-'),
          action 
        })
      });

      if (response.ok) {
        // Simulate successful action
        setTimeout(() => {
          setServices(prev => prev.map(s => 
            s.name === serviceName 
              ? { 
                  ...s, 
                  status: action === 'stop' ? 'stopped' : 'running',
                  uptime: action === 'stop' ? '0s' : '0s',
                  pid: action === 'stop' ? undefined : Math.floor(Math.random() * 9000) + 1000
                }
              : s
          ));
        }, 2000);
      }
    } catch (error) {
      console.error(`Failed to ${action} ${serviceName}:`, error);
      setServices(prev => prev.map(s => 
        s.name === serviceName 
          ? { ...s, status: 'error' }
          : s
      ));
    }
  };

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'stopped': return 'text-gray-500';
      case 'error': return 'text-red-500';
      case 'starting': case 'stopping': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'stopped': return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
      case 'error': return <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />;
      default: return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
    }
  };

  const getStatusDot = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'running': return 'bg-green-400';
      case 'stopped': return 'bg-gray-400';
      case 'error': return 'bg-red-400';
      case 'starting': case 'stopping': return 'bg-yellow-400';
      default: return 'bg-gray-400';
    }
  };

  const renderResourceBar = (value: number, type: 'cpu' | 'memory') => {
    const color = value > 80 ? 'bg-red-400' : value > 60 ? 'bg-yellow-400' : 'bg-green-400';
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    );
  };

  return (
    <div className="h-1/2 flex flex-col border-b border-gray-300 dark:border-gray-600">
      <div className="p-3 border-b border-gray-300 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Server size={16} className="mr-2" />
            Services
          </h3>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {services.map((service) => (
          <div key={service.name} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            {/* Service Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getStatusDot(service.status)} ${service.status === 'running' || service.status === 'error' ? 'animate-pulse' : ''}`}></div>
                <span className="font-medium capitalize text-gray-900 dark:text-gray-100">
                  {service.name}
                </span>
                <span className="text-xs text-gray-500">:{service.port}</span>
              </div>

              <div className="flex items-center space-x-1">
                {service.errors.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedService(service);
                      setShowErrorDetails(true);
                    }}
                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    title={`${service.errors.length} შეცდომა`}
                  >
                    <AlertCircle size={14} />
                  </button>
                )}

                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-400 hover:text-blue-500 rounded"
                  title="Open Service"
                >
                  <ExternalLink size={12} />
                </a>

                {/* Control Buttons */}
                {service.status === 'running' ? (
                  <button
                    onClick={() => handleServiceAction(service.name, 'stop')}
                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                    title="Stop"
                    disabled={service.status === 'stopping'}
                  >
                    <Square size={12} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleServiceAction(service.name, 'start')}
                    className="p-1 text-green-500 hover:bg-green-100 dark:hover:bg-green-900 rounded"
                    title="Start"
                    disabled={service.status === 'starting'}
                  >
                    <Play size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Service Metrics */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Cpu size={10} />
                <span>{service.cpu.toFixed(1)}%</span>
              </div>
              <div className="flex items-center space-x-1">
                <HardDrive size={10} />
                <span>{service.memory}MB</span>
              </div>
              <div className="flex items-center space-x-1">
                <Activity size={10} />
                <span>{service.uptime}</span>
              </div>
              {service.pid && (
                <div>
                  PID: {service.pid}
                </div>
              )}
            </div>

            {/* Status */}
            <div className={`text-xs mt-1 ${getStatusColor(service.status)}`}>
              {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
              {service.status === 'running' && (
                <span className="ml-2 text-gray-400">
                  • Last check: {service.lastCheck.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Overall System Health */}
        <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium text-center">
            🔧 System Health: Good
          </div>
        </div>
      </div>

      {/* Error Details Modal */}
      {showErrorDetails && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedService.name} - შეცდომები ({selectedService.errors.length})
              </h3>
              <button
                onClick={() => setShowErrorDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {selectedService.errors.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-green-500 text-4xl mb-2">✓</div>
                  <p className="text-gray-500">შეცდომები არ არის!</p>
                </div>
              ) : (
                selectedService.errors.map((error) => (
                  <div key={error.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-red-800 dark:text-red-300 font-medium text-sm">
                        Error #{error.id}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(error.message + (error.stack ? '\n\n' + error.stack : ''))}
                          className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded"
                        >
                          Copy
                        </button>
                        <div className="text-xs text-gray-500">
                          {error.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-red-700 dark:text-red-200 text-sm mb-2">
                      {error.message}
                    </div>

                    {error.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                          Stack Trace
                        </summary>
                        <pre className="text-xs text-gray-500 mt-2 bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => {
                  setServices(prev => prev.map(s => 
                    s.name === selectedService.name ? { ...s, errors: [] } : s
                  ));
                  setShowErrorDetails(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
              >
                Clear All Errors
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};