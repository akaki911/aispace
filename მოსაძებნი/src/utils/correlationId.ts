import { getAdminAuthHeaders } from './adminToken';
import { mergeHeaders } from './httpHeaders';

/**
 * Correlation ID utility for request tracking and observability
 */

export class CorrelationId {
  private static current: string | null = null;
  private static traceId: string | null = null;
  private static spanId: string | null = null;

  private static ensureTraceContext(): void {
    if (!this.traceId || !this.spanId) {
      this.setTraceContext();
    }
  }

  static getTraceIdValue(): string {
    this.ensureTraceContext();
    return this.traceId as string;
  }

  static getSpanIdValue(): string {
    this.ensureTraceContext();
    return this.spanId as string;
  }
  
  static generate(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const sessionId = this.getSessionId();
    
    return `fe-${sessionId}-${timestamp}-${random}`;
  }
  
  static generateTraceId(): string {
    return Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  static generateSpanId(): string {
    return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  
  static setTraceContext(traceId?: string, spanId?: string): void {
    this.traceId = traceId || this.generateTraceId();
    this.spanId = spanId || this.generateSpanId();
  }
  
  static getTraceParent(): string {
    this.ensureTraceContext();
    return `00-${this.traceId}-${this.spanId}-01`;
  }
  
  static set(id: string): void {
    this.current = id;
  }
  
  static get(): string {
    if (!this.current) {
      this.current = this.generate();
    }
    return this.current;
  }
  
  static clear(): void {
    this.current = null;
  }
  
  static getHeaders(): Record<string, string> {
    return {
      'X-Correlation-ID': this.get(),
      'traceparent': this.getTraceParent()
    };
  }
  
  private static getSessionId(): string {
    let sessionId = sessionStorage.getItem('session-id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('session-id', sessionId);
    }
    return sessionId;
  }
}

export const withCorrelationId = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  actionName?: string
): T => {
  return (async (...args: any[]) => {
    const correlationId = CorrelationId.generate();
    CorrelationId.set(correlationId);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'frontend',
      correlationId,
      traceId: CorrelationId.getTraceIdValue(),
      spanId: CorrelationId.getSpanIdValue(),
      operation: actionName || fn.name,
      event: 'operation_start',
      args: args.length > 0 ? 'present' : 'none'
    };
    console.log(JSON.stringify(logEntry));
    
    try {
      const result = await fn(...args);
      const successLog = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: 'frontend',
        correlationId,
        traceId: CorrelationId.getTraceIdValue(),
        spanId: CorrelationId.getSpanIdValue(),
        operation: actionName || fn.name,
        event: 'operation_success',
        success: true
      };
      console.log(JSON.stringify(successLog));
      return result;
    } catch (error) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: 'frontend',
        correlationId,
        traceId: CorrelationId.getTraceIdValue(),
        spanId: CorrelationId.getSpanIdValue(),
        operation: actionName || fn.name,
        event: 'operation_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
      console.error(JSON.stringify(errorLog));
      throw error;
    } finally {
      CorrelationId.clear();
    }
  }) as T;
};

// HTTP client wrapper with correlation ID
export const fetchWithCorrelationId = async (url: string, options: RequestInit = {}) => {
  const correlationId = CorrelationId.generate();
  CorrelationId.set(correlationId);

  const headers = mergeHeaders(
    { 'Content-Type': 'application/json' },
    CorrelationId.getHeaders(),
    getAdminAuthHeaders(),
    options.headers,
  );

  const requestInit: RequestInit = {
    ...options,
    headers,
  };

  if (!requestInit.credentials) {
    requestInit.credentials = 'include';
  }

  const requestLog = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service: 'frontend',
    correlationId,
    traceId: CorrelationId.getTraceIdValue(),
    spanId: CorrelationId.getSpanIdValue(),
    event: 'http_request_start',
    method: requestInit.method || 'GET',
    url,
    headers: Object.keys(headers)
  };
  console.log(JSON.stringify(requestLog));

  try {
    const response = await fetch(url, requestInit);

    const responseCorrelationId = response.headers.get('X-Correlation-ID');
    
    const responseLog = {
      timestamp: new Date().toISOString(),
      level: response.status >= 400 ? 'ERROR' : 'INFO',
      service: 'frontend',
      correlationId,
      responseCorrelationId,
      traceId: CorrelationId.getTraceIdValue(),
      spanId: CorrelationId.getSpanIdValue(),
      event: 'http_response',
      method: requestInit.method || 'GET',
      url,
      status: response.status,
      statusText: response.statusText
    };
    console.log(JSON.stringify(responseLog));

    return response;
  } catch (error) {
    console.error(`❌ [${correlationId}] HTTP Error ${url}`, {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};
