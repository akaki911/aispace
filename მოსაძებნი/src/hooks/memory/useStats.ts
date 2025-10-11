import { useMemo } from 'react';
import { ErrorLog } from '../../types/aimemory';

interface MemoryStats {
  totalRules: number;
  activeRules: number;
  resolvedErrors: number;
  totalActions: number;
  accuracyRate: number;
  memoryUsage: number;
}

interface SavedRule {
  isActive: boolean;
}

interface ContextAction {
  id: string;
}

interface StatsInput {
  savedRules: SavedRule[];
  errorLogs: ErrorLog[];
  contextActions: ContextAction[];
  memoryData: any;
}

export const useStats = (input: StatsInput): MemoryStats => {
  const stats = useMemo(() => {
    const { savedRules, errorLogs, contextActions, memoryData } = input;
    
    const totalRules = savedRules.length;
    const activeRules = savedRules.filter(r => r.isActive).length;
    const totalErrors = errorLogs.length;
    const resolvedErrors = errorLogs.filter((e: any) => e.resolved).length;
    const totalActions = contextActions.length;
    
    // Calculate accuracy rate
    const resolutionRate = totalErrors === 0 ? 100 : (resolvedErrors / totalErrors) * 100;
    const ruleEfficiency = Math.min(activeRules * 10, 50);
    const accuracyRate = Math.round(resolutionRate * 0.7 + ruleEfficiency * 0.3);
    
    // Calculate memory usage in MB
    const memoryUsage = JSON.stringify(memoryData).length / 1024 / 1024;
    
    return {
      totalRules,
      activeRules,
      resolvedErrors,
      totalActions,
      accuracyRate,
      memoryUsage: Math.round(memoryUsage * 100) / 100 // Round to 2 decimal places
    };
  }, [input]);

  return stats;
};