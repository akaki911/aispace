
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../services/loggingService';

export const useLogging = () => {
  const { user } = useAuth();

  const logError = async (component: string, message: string, error?: Error) => {
    await logger.logError(component, message, error, user?.id, user?.email);
  };

  const logAction = async (component: string, message: string, details?: any) => {
    await logger.logAction(component, message, user?.id, user?.email, details);
  };

  const logAPI = async (method: string, url: string, status: number, responseTime?: number) => {
    await logger.logAPI(method, url, status, responseTime, user?.id, user?.email);
  };

  const logUIError = async (component: string, action: string, details?: any) => {
    await logger.logUIError(component, action, details, user?.id, user?.email);
  };

  const logDebug = (component: string, message: string, data?: any) => {
    logger.logDebug(component, message, data);
  };

  const logConsoleError = async (message: string, source?: string, stackTrace?: string) => {
    await logger.logConsoleError(message, source, stackTrace, user?.id, user?.email);
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

  return {
    logError,
    logAction,
    logAPI,
    logUIError,
    logDebug,
    logConsoleError,
    markErrorsAsSeen,
    acknowledgeError
  };
};
