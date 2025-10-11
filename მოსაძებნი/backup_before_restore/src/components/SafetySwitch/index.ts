/**
 * Phase 3: Safety Switch - Main Exports
 * 
 * Centralized exports for the complete Safety Switch system,
 * providing clean imports for all components and utilities.
 */

// Main Components
export { default as SafetySwitch } from './SafetySwitch';
export { default as ActionPreviewModal } from './ActionPreviewModal';
export { default as ProgressTracker } from './ProgressTracker';

// Hooks
export { useSafetySwitch } from '../../hooks/useSafetySwitch';

// Types and Utilities
export type {
  ActionType,
  ActionSeverity,
  ActionStatus,
  ActionParameter,
  SecurityWarning,
  ActionImpact,
  PendingAction,
  ActionResult,
  ActionConfirmationCallbacks,
  SafetySwitchState
} from './types';

export {
  determineActionSeverity,
  getActionImpact,
  getSecurityWarnings
} from './types';