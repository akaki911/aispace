
import React from 'react';
import { AlertTriangle, Shield, Info } from 'lucide-react';

interface RiskBadgeProps {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  label?: string;
  description?: string;
  className?: string;
  showIcon?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ 
  risk, 
  label, 
  description,
  className = "",
  showIcon = true 
}) => {
  const getRiskColor = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskIcon = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW':
        return <Shield size={12} />;
      case 'MEDIUM':
        return <Info size={12} />;
      case 'HIGH':
        return <AlertTriangle size={12} />;
      default:
        return <Info size={12} />;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(risk)} ${className}`}>
      {showIcon && getRiskIcon(risk)}
      <span>{label || risk}</span>
      {description && (
        <span className="ml-1 opacity-75">({description})</span>
      )}
    </div>
  );
};

interface RiskIndicatorProps {
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  items: string[];
  className?: string;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ 
  risk, 
  title, 
  items, 
  className = "" 
}) => {
  const getRiskColor = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'LOW':
        return 'border-green-200 bg-green-50';
      case 'MEDIUM':
        return 'border-yellow-200 bg-yellow-50';
      case 'HIGH':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getRiskColor(risk)} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <RiskBadge risk={risk} />
      </div>
      
      {items.length > 0 && (
        <ul className="text-xs space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-gray-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
