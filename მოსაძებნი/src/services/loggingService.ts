
import { collection, addDoc, query, orderBy, limit, where, getDocs, Timestamp, doc, updateDoc, writeBatch, startAfter as startAfterConstraint, QueryConstraint } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CorrelationId } from '../utils/correlationId';

export interface LogEntry {
  id?: string;
  timestamp: Date;
  createdAt?: Date;
  type: 'ERROR' | 'ACTION' | 'API' | 'DEBUG' | 'UI_ERROR' | 'CONSOLE_ERROR';
  component: string;
  message: string;
  userId?: string;
  userEmail?: string;
  details?: any;
  stackTrace?: string;
  action?: string; // For UI_ERROR type
  source?: string; // File or function source
  isAcknowledged?: boolean;
  isSeen?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  correlationId?: string; // Added correlationId field
}

type TestsChannel = 'tests:list' | 'tests:run';
type TestsListStatus = 'ok' | 'empty' | 'error';

// AbortError detection helper - enhanced
export function isAbortLike(e: any): boolean {
  return e?.name === 'AbortError' || 
         e?.code === 20 || 
         /aborted|abort|AbortError|signal is aborted/i.test(String(e?.message)) ||
         String(e).includes('user aborted');
}

// Network-aware logger that filters AbortErrors
export const NetworkLogger = {
  warn(msg: string, meta?: any) {
    if (meta && isAbortLike(meta)) return; // swallow abort-as-warning
    console.warn(msg, meta);
  },
  error(msg: string, meta?: any) {
    if (meta && isAbortLike(meta)) return; // optional: treat abort as non-error
    console.error(msg, meta);
  },
  debug(msg: string, meta?: any) {
    if (console.debug) console.debug(msg, meta);
  }
};

class LoggingService {
  private static instance: LoggingService;

  private sanitizeForFirestore<T>(value: T): T {
    if (value === undefined) {
      return null as T;
    }

    if (value === null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForFirestore(item)) as unknown as T;
    }

    if (value instanceof Date || value instanceof Timestamp) {
      return value;
    }

    if (typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype && prototype !== Object.prototype && prototype !== null) {
        return value;
      }

      const entries = Object.entries(value as Record<string, unknown>);
      const sanitized: Record<string, unknown> = {};

      for (const [key, nestedValue] of entries) {
        sanitized[key] = this.sanitizeForFirestore(nestedValue);
      }

      return sanitized as unknown as T;
    }

    return value;
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  // Log an error
  async logError(component: string, message: string, error?: Error, userId?: string, userEmail?: string, correlationId?: string) {
    // Enhanced AbortError filtering - complete silence using helper
    if (error && isAbortLike(error)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      type: 'ERROR',
      component,
      message,
      ...(userId && { userId }),
      ...(userEmail && { userEmail }),
      ...(error?.stack && { stackTrace: this.truncateStackTrace(error.stack) }),
      ...(error && { details: { name: error.name, message: error.message } }),
      correlationId: correlationId || CorrelationId.get()
    };

    await this.saveLog(logEntry);

    // Structured console logging
    if (error?.name !== 'AbortError') {
      const structuredLog = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: 'frontend',
        correlationId: logEntry.correlationId,
        component,
        message,
        error: error?.message,
        stack: error?.stack?.substring(0, 500),
        userId,
        userEmail
      };
      console.error(JSON.stringify(structuredLog));
    }
  }

  // Log user actions
  async logAction(component: string, message: string, userId?: string, userEmail?: string, details?: any, correlationId?: string) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      type: 'ACTION',
      component,
      message,
      ...(userId && { userId }),
      ...(userEmail && { userEmail }),
      ...(details && { details }),
      correlationId: correlationId || CorrelationId.get()
    };

    await this.saveLog(logEntry);
    
    // Structured console logging
    const structuredLog = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'frontend',
      correlationId: logEntry.correlationId,
      component,
      message,
      event: 'user_action',
      userId,
      userEmail,
      details
    };
    console.log(JSON.stringify(structuredLog));
  }

  // Log API calls
  async logAPI(method: string, url: string, status: number, responseTime?: number, userId?: string, userEmail?: string, correlationId?: string) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      type: 'API',
      component: 'API',
      message: `${method} ${url} - ${status}${responseTime ? ` (${responseTime}ms)` : ''}`,
      ...(userId && { userId }),
      ...(userEmail && { userEmail }),
      details: {
        method,
        url,
        status,
        ...(responseTime && { responseTime })
      },
      correlationId: correlationId || CorrelationId.get()
    };

    await this.saveLog(logEntry);
    const cid = logEntry.correlationId;
    console.log(`[🔌 API] [${cid}] ${method} ${url} - ${status}${responseTime ? ` (${responseTime}ms)` : ''}`);
  }

  // Log UI interaction failures
  async logUIError(component: string, action: string, details?: any, userId?: string, userEmail?: string, correlationId?: string) {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      type: 'UI_ERROR',
      component,
      message: `UI interaction failed: ${action}`,
      action,
      ...(userId && { userId }),
      ...(userEmail && { userEmail }),
      isAcknowledged: false,
      isSeen: false,
      details: {
        ...details,
        url: typeof window !== 'undefined' ? window.location.href : '',
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString(),
        viewport: typeof window !== 'undefined' ? {
          width: window.innerWidth,
          height: window.innerHeight
        } : { width: 0, height: 0 },
        errorType: 'ui_interaction'
      },
      correlationId: correlationId || CorrelationId.get()
    };

    await this.saveLog(logEntry);
    const cid = logEntry.correlationId;
    console.log(`[🚨 UI_ERROR] [${cid}] [${component}] ${action}`, details);
  }

  // Log console errors (global error handler)
  async logConsoleError(message: string, source?: string, stackTrace?: string, userId?: string, userEmail?: string, correlationId?: string) {
    // Extract component name from stack trace or source
    const component = this.extractComponentFromSource(source || stackTrace || '');

    // Extract line and column information
    const lineInfo = this.extractLineInfo(stackTrace || source || '');

    const logEntry: LogEntry = {
      timestamp: new Date(),
      type: 'CONSOLE_ERROR',
      component,
      message: `Console error: ${message}${lineInfo ? ` ${lineInfo}` : ''}`,
      source,
      ...(userId && { userId }),
      ...(userEmail && { userEmail }),
      ...(stackTrace && { stackTrace: this.truncateStackTrace(stackTrace) }),
      isAcknowledged: false,
      isSeen: false,
      details: {
        originalMessage: message,
        ...(lineInfo && { lineInfo }),
        errorType: 'console',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString()
      },
      correlationId: correlationId || CorrelationId.get()
    };

    await this.saveLog(logEntry);
    const cid = logEntry.correlationId;
    console.log(`[💥 CONSOLE_ERROR] [${cid}] [${component}] ${message}`);
  }

  // Extract component name from source file path or stack trace
  private extractComponentFromSource(sourceInfo: string): string {
    if (!sourceInfo) return 'Unknown';

    // Try to extract React component name from stack trace
    const componentMatch = sourceInfo.match(/(\w+)\.tsx?/);
    if (componentMatch) {
      return componentMatch[1];
    }

    // Try to extract from file path
    const pathMatch = sourceInfo.match(/src\/(\w+)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Try to extract from URL
    const urlMatch = sourceInfo.match(/\/([^\/]+)\.(tsx?|jsx?)$/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return 'BrowserError';
  }

  // Truncate stack trace to avoid Firestore document size limits
  private truncateStackTrace(stackTrace: string): string {
    const maxLength = 8000; // Keep under Firestore's 1MB limit
    if (stackTrace.length <= maxLength) {
      return stackTrace;
    }

    const lines = stackTrace.split('\n');
    let truncated = '';

    for (const line of lines) {
      if (truncated.length + line.length + 1 > maxLength) {
        truncated += '\n... [Stack trace truncated]';
        break;
      }
      truncated += (truncated ? '\n' : '') + line;
    }

    return truncated;
  }

  // Extract line and column information from stack trace or source
  private extractLineInfo(sourceInfo: string): string | null {
    if (!sourceInfo) return null;

    // Try to extract line:column from various stack trace formats
    const patterns = [
      /(\w+\.(tsx?|jsx?)):(\d+):(\d+)/,  // filename.tsx:123:45
      /:(\d+):(\d+)\)?\s*$/m,            // :123:45) at end of line
      /line (\d+), column (\d+)/i,       // line 123, column 45
      /at line (\d+)/i                   // at line 123
    ];

    for (const pattern of patterns) {
      const match = sourceInfo.match(pattern);
      if (match) {
        if (match[3] && match[4]) {
          return `(line ${match[3]}, col ${match[4]})`;
        } else if (match[1] && match[2]) {
          return `(line ${match[1]}, col ${match[2]})`;
        } else if (match[1]) {
          return `(line ${match[1]})`;
        }
      }
    }

    return null;
  }

  // Mark errors as seen
  async markErrorsAsSeen(errorIds: string[], userId: string) {
    try {
      const batch = writeBatch(db);

      for (const errorId of errorIds) {
        const errorRef = doc(db, 'logs', errorId);
        batch.update(errorRef, {
          isSeen: true,
          seenAt: Timestamp.now(),
          seenBy: userId
        });
      }

      await batch.commit();
      console.info(`✅ Marked ${errorIds.length} errors as seen`);
    } catch (error) {
      console.error('Failed to mark errors as seen:', error);
    }
  }

  // Acknowledge an error
  async acknowledgeError(errorId: string, userId: string, userEmail: string) {
    try {
      const errorRef = doc(db, 'logs', errorId);
      await updateDoc(errorRef, {
        isAcknowledged: true,
        acknowledgedBy: userEmail,
        acknowledgedAt: Timestamp.now(),
        acknowledgedById: userId
      });

      console.info(`✅ Error ${errorId} acknowledged by ${userEmail}`);
    } catch (error) {
      console.error('Failed to acknowledge error:', error);
    }
  }

  // Log debug information (dev mode only)
  async logDebug(component: string, message: string, data?: any, saveToFirestore: boolean = false, correlationId?: string) {
    if (import.meta.env.MODE === 'development') {
      const cid = correlationId || CorrelationId.get();
      console.log(`[🔍 DEBUG] [${cid}] [${component}] ${message}`, data);

      if (saveToFirestore) {
        await this.saveLog({
          timestamp: new Date(),
          type: 'DEBUG',
          component,
          message,
          details: data,
          correlationId: cid
        });
      }
    }
  }

  // Save log to Firestore with timeout and retry
  private async saveLog(logEntry: LogEntry, retryCount = 0): Promise<void> {
    const maxRetries = 2;
    try {
      const firestorePayload: Record<string, unknown> = {
        ...logEntry,
      };

      if (typeof firestorePayload.stackTrace === 'string') {
        firestorePayload.stackTrace = this.truncateStackTrace(firestorePayload.stackTrace);
      }

      firestorePayload.timestamp = Timestamp.fromDate(logEntry.timestamp);

      if (logEntry.createdAt) {
        firestorePayload.createdAt = Timestamp.fromDate(logEntry.createdAt);
      } else {
        delete firestorePayload.createdAt;
      }

      const sanitizedPayload = this.sanitizeForFirestore(firestorePayload) as Record<string, unknown>;

      // Add timeout for Firestore operation
      const saveOperation = addDoc(collection(db, 'logs'), sanitizedPayload);

      // Race with timeout
      await Promise.race([
        saveOperation,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore write timeout')), 10000)
        )
      ]);
    } catch (error) {
      console.error(`Failed to save log to Firestore (attempt ${retryCount + 1}):`, error);

      const message = error instanceof Error ? error.message : String(error ?? '');

      // Retry for transient errors
      if (
        retryCount < maxRetries &&
        (message.includes('timeout') || message.includes('network'))
      ) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`🔄 Retrying log save in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.saveLog(logEntry, retryCount + 1);
      }
    }
  }

  // Retrieve logs with filters and pagination
  async getLogs(
    logType?: 'ERROR' | 'ACTION' | 'API' | 'DEBUG' | 'UI_ERROR',
    limitCount: number = 50, // Reduced default limit
    startAfterDoc?: any
  ): Promise<LogEntry[]> {
    try {
      const filters: QueryConstraint[] = [orderBy('timestamp', 'desc'), limit(Math.min(limitCount, 100))]; // Max 100 at once

      if (logType) {
        filters.unshift(where('type', '==', logType));
      }

      if (startAfterDoc) {
        filters.push(startAfterConstraint(startAfterDoc));
      }

      const q = query(collection(db, 'logs'), ...filters);

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        ...(doc.data().createdAt && { createdAt: doc.data().createdAt.toDate() })
      })) as LogEntry[];
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  // Search logs by correlation ID
  async getLogsByCorrelationId(correlationId: string): Promise<LogEntry[]> {
    try {
      const q = query(
        collection(db, 'logs'),
        where('correlationId', '==', correlationId),
        orderBy('timestamp', 'asc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        ...(doc.data().createdAt && { createdAt: doc.data().createdAt.toDate() })
      })) as LogEntry[];
    } catch (error) {
      console.error('Failed to retrieve logs by correlation ID:', error);
      return [];
    }
  }

  // Search logs by message content
  async searchLogs(searchTerm: string, limitCount: number = 100): Promise<LogEntry[]> {
    try {
      // Basic optimization: if search term is short, try component search first
      let q;
      if (searchTerm.length >= 3) {
        // Try to optimize with basic Firestore filtering for component names
        const componentTerms = ['ERROR', 'ACTION', 'API', 'DEBUG', 'UI_ERROR', 'CONSOLE_ERROR'];
        const matchingType = componentTerms.find(type => 
          type.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matchingType) {
          q = query(
            collection(db, 'logs'),
            where('type', '==', matchingType),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
          );
        } else {
          q = query(
            collection(db, 'logs'),
            orderBy('timestamp', 'desc'),
            limit(limitCount * 2) // Get more docs for local filtering
          );
        }
      } else {
        q = query(
          collection(db, 'logs'),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const allLogs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
        ...(doc.data().createdAt && { createdAt: doc.data().createdAt.toDate() })
      })) as LogEntry[];

      // Filter locally for text search
      const filtered = allLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.component.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.type && log.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return filtered.slice(0, limitCount);
    } catch (error) {
      console.error('Failed to search logs:', error);
      return [];
    }
  }

  // Mask sensitive data
  static maskSensitiveData(text: string): string {
    // Mask IBANs (keep first 4 and last 4 characters)
    text = text.replace(/([A-Z]{2}\d{2}[A-Z0-9]{4})([A-Z0-9]{8,})(\d{4})/g, '$1••••••••••••$3');

    // Mask email addresses (keep first letter and domain)
    text = text.replace(/([a-zA-Z])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1•••@$2');

    // Mask phone numbers
    text = text.replace(/(\+?\d{1,3})\d{6,}(\d{2})/g, '$1••••••$2');

    return text;
  }

  private async logTestsChannel(channel: TestsChannel, event: string, details: Record<string, unknown> = {}) {
    const timestamp = new Date();
    const correlationId = CorrelationId.get();
    const logEntry: LogEntry = {
      timestamp,
      type: 'DEBUG',
      component: channel,
      message: `${channel} ${event}`,
      details: { ...details, channel, event },
      correlationId,
    };

    await this.saveLog(logEntry);
    console.log(`[🧪 ${channel}] ${event}`, { ...details, correlationId });
  }

  async logTestsListStatus(status: TestsListStatus, details: Record<string, unknown> = {}) {
    await this.logTestsChannel('tests:list', `status=${status}`, { status, ...details });
  }

  async logTestsListRetry(count: number, details: Record<string, unknown> = {}) {
    await this.logTestsChannel('tests:list', 'retry', { count, ...details });
  }

  async logTestsRun(event: string, details: Record<string, unknown> = {}) {
    await this.logTestsChannel('tests:run', event, details);
  }
}

export const logger = LoggingService.getInstance();
export default LoggingService;
