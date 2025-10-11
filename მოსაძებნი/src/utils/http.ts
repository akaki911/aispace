
import { CorrelationId, fetchWithCorrelationId } from './correlationId';
import { mergeHeaders } from './httpHeaders';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class HttpClient {
  private baseURL: string;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const correlationId = CorrelationId.generate();
    
    try {
      const response = await fetchWithCorrelationId(url, {
        ...options,
        headers: mergeHeaders({ Accept: 'application/json' }, options.headers),
      });

      const responseCorrelationId = response.headers.get('X-Correlation-ID');
      
      if (!response.ok) {
        console.error(`[❌ ${correlationId}] HTTP ${response.status} ${url}`, {
          correlationId,
          responseCorrelationId,
          status: response.status,
          statusText: response.statusText
        });
        
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || response.statusText,
          message: errorData.message || `Request failed with status ${response.status}`,
        };
      }

      const data = await response.json();
      
      console.log(`[✅ ${correlationId}] HTTP ${response.status} ${url}`, {
        correlationId,
        responseCorrelationId,
        status: response.status
      });

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error(`[❌ ${correlationId}] HTTP Error ${url}`, {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        message: 'Request failed due to network error',
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Default HTTP client instance
export const httpClient = new HttpClient('/api');

// Backend-specific client
export const backendClient = new HttpClient('/api');

// Utility functions for quick access
export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => httpClient.get<T>(endpoint, options),
  post: <T>(endpoint: string, data?: any, options?: RequestInit) => httpClient.post<T>(endpoint, data, options),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) => httpClient.put<T>(endpoint, data, options),
  delete: <T>(endpoint: string, options?: RequestInit) => httpClient.delete<T>(endpoint, options),
  patch: <T>(endpoint: string, data?: any, options?: RequestInit) => httpClient.patch<T>(endpoint, data, options),
};

export default HttpClient;
