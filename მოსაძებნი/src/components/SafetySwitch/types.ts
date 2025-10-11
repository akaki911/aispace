/**
 * Phase 3: Safety Switch - UI Confirmation System Types
 * 
 * TypeScript interfaces for the comprehensive action confirmation system
 * that ensures no development actions execute without explicit user consent.
 */

export type ActionType = 'writeFile' | 'installPackage' | 'executeShellCommand';

export type ActionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ActionStatus = 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface ActionParameter {
  name: string;
  value: any;
  type: string;
  description?: string;
  sensitive?: boolean;
}

export interface SecurityWarning {
  level: 'warning' | 'danger' | 'critical';
  message: string;
  recommendation?: string;
}

export interface ActionImpact {
  description: string;
  affects: string[];
  reversible: boolean;
  riskLevel: ActionSeverity;
}

export interface PendingAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  parameters: ActionParameter[];
  impact: ActionImpact;
  securityWarnings: SecurityWarning[];
  severity: ActionSeverity;
  status: ActionStatus;
  timestamp: string;
  requestId?: string;
  originalToolCall?: any;
}

export interface ActionResult {
  success: boolean;
  result?: string;
  error?: string;
  duration?: number;
  output?: {
    stdout?: string;
    stderr?: string;
    filePath?: string;
    packageName?: string;
  };
}

export interface ActionConfirmationCallbacks {
  onConfirm: (actionId: string) => Promise<void>;
  onCancel: (actionId: string) => Promise<void>;
  onViewDetails: (actionId: string) => void;
}

export interface SafetySwitchState {
  pendingActions: PendingAction[];
  executingActions: PendingAction[];
  completedActions: PendingAction[];
  isEnabled: boolean;
  showModal: boolean;
  currentActionId: string | null;
}

// Helper function to determine action severity
export function determineActionSeverity(type: ActionType, parameters: ActionParameter[]): ActionSeverity {
  switch (type) {
    case 'writeFile':
      const filePath = parameters.find(p => p.name === 'filePath')?.value as string;
      if (filePath?.includes('package.json') || filePath?.includes('.env') || filePath?.includes('config')) {
        return 'high';
      }
      if (filePath?.includes('.js') || filePath?.includes('.ts') || filePath?.includes('.tsx')) {
        return 'medium';
      }
      return 'low';
      
    case 'installPackage':
      return 'high'; // Package installation always high risk
      
    case 'executeShellCommand':
      const command = parameters.find(p => p.name === 'command')?.value as string;
      if (command?.includes('rm') || command?.includes('delete') || command?.includes('sudo')) {
        return 'critical';
      }
      if (command?.includes('git') || command?.includes('npm')) {
        return 'medium';
      }
      return 'low';
      
    default:
      return 'medium';
  }
}

// Helper function to get action impact
export function getActionImpact(type: ActionType, parameters: ActionParameter[]): ActionImpact {
  switch (type) {
    case 'writeFile':
      const filePath = parameters.find(p => p.name === 'filePath')?.value as string;
      return {
        description: `Create or overwrite file: ${filePath}`,
        affects: [filePath || 'Unknown file'],
        reversible: true,
        riskLevel: determineActionSeverity(type, parameters)
      };
      
    case 'installPackage':
      const packageName = parameters.find(p => p.name === 'packageName')?.value as string;
      return {
        description: `Install npm package: ${packageName}`,
        affects: ['package.json', 'node_modules/', 'package-lock.json'],
        reversible: true,
        riskLevel: 'high'
      };
      
    case 'executeShellCommand':
      const command = parameters.find(p => p.name === 'command')?.value as string;
      const args = parameters.find(p => p.name === 'args')?.value as string[];
      const fullCommand = `${command} ${args?.join(' ') || ''}`.trim();
      
      return {
        description: `Execute shell command: ${fullCommand}`,
        affects: ['File system', 'Project state'],
        reversible: false,
        riskLevel: determineActionSeverity(type, parameters)
      };
      
    default:
      return {
        description: 'Unknown action',
        affects: ['Unknown'],
        reversible: false,
        riskLevel: 'medium'
      };
  }
}

// Helper function to get security warnings
export function getSecurityWarnings(type: ActionType, parameters: ActionParameter[]): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];
  
  switch (type) {
    case 'writeFile':
      const filePath = parameters.find(p => p.name === 'filePath')?.value as string;
      if (filePath?.includes('package.json')) {
        warnings.push({
          level: 'warning',
          message: 'Modifying package.json may affect project dependencies',
          recommendation: 'Review the changes carefully before confirming'
        });
      }
      if (filePath?.includes('.env')) {
        warnings.push({
          level: 'critical',
          message: 'Writing to environment files can expose sensitive information',
          recommendation: 'Ensure no secrets are being written to this file'
        });
      }
      break;
      
    case 'installPackage':
      warnings.push({
        level: 'warning',
        message: 'Installing packages can introduce security vulnerabilities',
        recommendation: 'Verify the package is from a trusted source'
      });
      break;
      
    case 'executeShellCommand':
      const command = parameters.find(p => p.name === 'command')?.value as string;
      if (command?.includes('rm')) {
        warnings.push({
          level: 'critical',
          message: 'This command may delete files permanently',
          recommendation: 'Double-check the command before proceeding'
        });
      }
      warnings.push({
        level: 'warning',
        message: 'Shell commands can modify your system in unexpected ways',
        recommendation: 'Ensure you understand what this command does'
      });
      break;
  }
  
  return warnings;
}