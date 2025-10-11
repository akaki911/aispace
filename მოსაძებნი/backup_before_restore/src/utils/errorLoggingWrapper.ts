
import { ComponentType, createElement, forwardRef } from 'react';
import { globalErrorHandler } from '../services/globalErrorHandler';

// Higher-order component to wrap any component with error logging
export function withErrorLogging<P extends Record<string, any>>(
  WrappedComponent: ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ErrorLoggedComponent = forwardRef<any, P>((props, ref) => {
    // Wrap all function props with error logging
    const wrappedProps = { ...props };
    
    Object.keys(props).forEach(key => {
      const value = props[key];
      if (typeof value === 'function' && key.startsWith('on')) {
        // This is likely an event handler
        const actionName = key.replace(/^on/, '').toLowerCase();
        wrappedProps[key] = globalErrorHandler.wrapUIAction(
          value,
          displayName,
          actionName
        );
      }
    });

    return createElement(WrappedComponent, { ...wrappedProps, ref });
  });

  ErrorLoggedComponent.displayName = `withErrorLogging(${displayName})`;
  
  return ErrorLoggedComponent;
}

// Utility to wrap async operations with error logging
export function logAsyncErrors<T extends (...args: any[]) => Promise<any>>(
  asyncFn: T,
  componentName: string,
  operationName: string
): T {
  return (async (...args: any[]) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      await globalErrorHandler.logError(error as Error, `${componentName}.${operationName}`);
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
}

// Utility to wrap synchronous operations with error logging
export function logSyncErrors<T extends (...args: any[]) => any>(
  syncFn: T,
  componentName: string,
  operationName: string
): T {
  return ((...args: any[]) => {
    try {
      return syncFn(...args);
    } catch (error) {
      globalErrorHandler.logError(error as Error, `${componentName}.${operationName}`);
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
}

// Decorator for class methods (if you use class components)
export function logErrors(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    try {
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          globalErrorHandler.logError(error, `${target.constructor.name}.${propertyName}`);
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      globalErrorHandler.logError(error as Error, `${target.constructor.name}.${propertyName}`);
      throw error;
    }
  };
}
