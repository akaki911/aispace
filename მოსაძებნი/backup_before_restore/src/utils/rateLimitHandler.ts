
import { useState, useRef } from 'react';

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // milliseconds
  retryDelay: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 5, // შევამცირდთ მოთხოვნების რაოდენობა
  timeWindow: 60000, // 1 minute
  retryDelay: 5000 // 5 second delay
};

class RateLimitManager {
  private requestCounts = new Map<string, number[]>();
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private pendingRequests = new Map<string, Promise<any>>();

  async execute<T>(
    key: string,
    apiCall: () => Promise<T>,
    config: Partial<RateLimitConfig> = {},
    cacheTTL: number = 30000
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Check cache first
    const cached = this.getFromCache(key, cacheTTL);
    if (cached) {
      console.log(`🔄 Using cached data for ${key}`);
      return cached;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      if (import.meta.env.DEV && !key.includes('checkUserRole')) {
      console.log(`⏳ Request already pending for ${key}, waiting...`);
    }
      return this.pendingRequests.get(key)!;
    }

    // Check rate limit
    if (this.isRateLimited(key, finalConfig)) {
      console.warn(`🚫 Rate limited for ${key}, using cached data or throwing error`);
      const fallback = this.getFromCache(key, Infinity); // Get any cached data
      if (fallback) return fallback;
      throw new Error(`Rate limited for ${key}. Please wait ${finalConfig.retryDelay}ms`);
    }

    // Execute request
    const promise = this.executeWithTracking(key, apiCall, finalConfig, cacheTTL);
    this.pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  private async executeWithTracking<T>(
    key: string,
    apiCall: () => Promise<T>,
    config: RateLimitConfig,
    cacheTTL: number
  ): Promise<T> {
    this.trackRequest(key);
    
    try {
      const result = await apiCall();
      this.setCache(key, result, cacheTTL);
      return result;
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        console.error(`🚫 Rate limit hit for ${key}:`, error.message);
        // Exponentially increase delay for this endpoint
        await new Promise(resolve => setTimeout(resolve, config.retryDelay * 2));
      }
      throw error;
    }
  }

  private isRateLimited(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const requests = this.requestCounts.get(key) || [];
    
    // Clean old requests
    const validRequests = requests.filter(time => now - time < config.timeWindow);
    this.requestCounts.set(key, validRequests);
    
    return validRequests.length >= config.maxRequests;
  }

  private trackRequest(key: string): void {
    const now = Date.now();
    const requests = this.requestCounts.get(key) || [];
    requests.push(now);
    this.requestCounts.set(key, requests);
  }

  private getFromCache(key: string, maxAge: number): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > Math.min(cached.ttl, maxAge)) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

export const rateLimitManager = new RateLimitManager();

export const useRateLimitedAPI = (key: string, config?: Partial<RateLimitConfig>) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const execute = async <T>(apiCall: () => Promise<T>, cacheTTL = 30000): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await rateLimitManager.execute(key, apiCall, config, cacheTTL);
      setData(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, data };
};
