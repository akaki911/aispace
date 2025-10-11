
import { useCallback, useMemo } from 'react';

export interface ValidationRule {
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning';
}

const DEFAULT_SECURITY_RULES: ValidationRule[] = [
  {
    pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    message: 'Script tags არ დაიშვება',
    severity: 'error'
  },
  {
    pattern: /javascript:/i,
    message: 'JavaScript URL-ები არ დაიშვება',
    severity: 'error'
  },
  {
    pattern: /on\w+\s*=/i,
    message: 'Event handlers არ დაიშვება',
    severity: 'error'
  },
  {
    pattern: /\beval\s*\(/i,
    message: 'eval() ფუნქცია არ დაიშვება',
    severity: 'error'
  },
  {
    pattern: /\b(rm\s+-rf|del\s+\/|format\s+c:)/i,
    message: 'სახიფათო ბრძანებები არ დაიშვება',
    severity: 'error'
  }
];

export interface UseSecureInputOptions {
  maxLength?: number;
  customRules?: ValidationRule[];
  allowedCommands?: string[];
  sanitize?: boolean;
}

export const useSecureInput = (options: UseSecureInputOptions = {}) => {
  const {
    maxLength = 2000,
    customRules = [],
    allowedCommands = [],
    sanitize = true
  } = options;

  const allRules = useMemo(() => [
    ...DEFAULT_SECURITY_RULES,
    ...customRules
  ], [customRules]);

  const sanitizeInput = useCallback((input: string): string => {
    if (!sanitize) return input;

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }, [sanitize]);

  const validateInput = useCallback((input: string) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length validation
    if (input.length > maxLength) {
      errors.push(`ტექსტი ძალიან გრძელია (მაქს: ${maxLength} სიმბოლო)`);
    }

    // Security rule validation
    allRules.forEach(rule => {
      if (rule.pattern.test(input)) {
        if (rule.severity === 'error') {
          errors.push(rule.message);
        } else {
          warnings.push(rule.message);
        }
      }
    });

    // Command validation for slash commands
    if (input.startsWith('/')) {
      const command = input.split(' ')[0].toLowerCase();
      if (allowedCommands.length > 0 && !allowedCommands.includes(command)) {
        errors.push(`ბრძანება "${command}" არ არის ნებადართული`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedInput: sanitizeInput(input)
    };
  }, [maxLength, allRules, allowedCommands, sanitizeInput]);

  const createSecureHandler = useCallback((
    onValid: (sanitizedInput: string) => void,
    onInvalid?: (errors: string[], warnings: string[]) => void
  ) => {
    return (input: string) => {
      const validation = validateInput(input);
      
      if (validation.isValid) {
        onValid(validation.sanitizedInput);
      } else if (onInvalid) {
        onInvalid(validation.errors, validation.warnings);
      }
    };
  }, [validateInput]);

  return {
    validateInput,
    sanitizeInput,
    createSecureHandler
  };
};

export default useSecureInput;
