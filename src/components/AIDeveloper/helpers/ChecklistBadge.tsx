
import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'warning';
  description?: string;
  details?: string;
}

interface ChecklistBadgeProps {
  items: ChecklistItem[];
  className?: string;
}

export const ChecklistBadge: React.FC<ChecklistBadgeProps> = ({ items, className = "" }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'running':
        return <Clock size={16} className="text-blue-500 animate-pulse" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'failed':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      case 'running':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const completedItems = items.filter(item => item.status === 'success').length;
  const totalItems = items.length;
  const hasFailures = items.some(item => item.status === 'failed');
  const hasWarnings = items.some(item => item.status === 'warning');
  const isRunning = items.some(item => item.status === 'running');

  const overallStatus = hasFailures ? 'failed' : 
                       hasWarnings ? 'warning' : 
                       isRunning ? 'running' : 
                       completedItems === totalItems ? 'success' : 'pending';

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor(overallStatus)} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon(overallStatus)}
          <span className="font-medium">
            Checklist ({completedItems}/{totalItems})
          </span>
        </div>
        <div className="text-sm text-gray-600">
          {Math.round((completedItems / totalItems) * 100)}%
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            {getStatusIcon(item.status)}
            <div className="flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              {item.description && (
                <div className="text-xs text-gray-600">{item.description}</div>
              )}
              {item.details && item.status === 'failed' && (
                <div className="text-xs text-red-600 mt-1">{item.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
