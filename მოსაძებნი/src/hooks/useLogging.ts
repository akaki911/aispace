
import { useAuth } from '../contexts/useAuth';
import { logger } from '../services/loggingService';
import { CorrelationId } from '../utils/correlationId';

export const useLogging = () => {
  const { user } = useAuth();

  const logError = async (component: string, message: string, error?: Error, correlationId?: string) => {
    await logger.logError(component, message, error, user?.id, user?.email, correlationId || CorrelationId.get());
  };

  const logAction = async (component: string, message: string, details?: any, correlationId?: string) => {
    await logger.logAction(component, message, user?.id, user?.email, details, correlationId || CorrelationId.get());
  };

  const logAPI = async (method: string, url: string, status: number, responseTime?: number, correlationId?: string) => {
    await logger.logAPI(method, url, status, responseTime, user?.id, user?.email, correlationId || CorrelationId.get());
  };

  const logUIError = async (component: string, action: string, details?: any, correlationId?: string) => {
    await logger.logUIError(component, action, details, user?.id, user?.email, correlationId || CorrelationId.get());
  };

  const logDebug = (component: string, message: string, data?: any, correlationId?: string) => {
    logger.logDebug(component, message, data, false, correlationId || CorrelationId.get());
  };

  const logConsoleError = async (message: string, source?: string, stackTrace?: string, correlationId?: string) => {
    await logger.logConsoleError(message, source, stackTrace, user?.id, user?.email, correlationId || CorrelationId.get());
  };

  const markErrorsAsSeen = async (errorIds: string[]) => {
    if (user?.id) {
      await logger.markErrorsAsSeen(errorIds, user.id);
    }
  };

  const acknowledgeError = async (errorId: string) => {
    if (user?.id && user?.email) {
      await logger.acknowledgeError(errorId, user.id, user.email);
    }
  };

  const getLogsByCorrelationId = async (correlationId: string) => {
    return await logger.getLogsByCorrelationId(correlationId);
  };

  return {
    logError,
    logAction,
    logAPI,
    logUIError,
    logDebug,
    logConsoleError,
    markErrorsAsSeen,
    acknowledgeError,
    getLogsByCorrelationId
  };
};
