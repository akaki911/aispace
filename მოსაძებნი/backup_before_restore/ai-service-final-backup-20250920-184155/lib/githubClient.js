/**
 * Safe GitHub Client with Retries, Rate Limiting, and Pagination
 * STRICT PATCH MODE: Server-side only implementation
 * Implements exponential backoff, proper error handling, and RFC5988 Link header pagination
 */

const axios = require('axios');
const { requireEnv } = require('./requireEnv');

class GitHubClient {
  constructor() {
    this.cfg = requireEnv(); // Validates required env vars
    this.client = this.createClient();
  }

  createClient() {
    const client = axios.create({
      baseURL: this.cfg.GITHUB_API_URL,
      timeout: 15000, // 15s timeout
      headers: {
        'Authorization': `token ${this.cfg.GITHUB_TOKEN}`,
        'User-Agent': 'Bakhmaro-AI-Service',
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    // Request interceptor for rate limit monitoring
    client.interceptors.request.use((config) => {
      console.log(`🔗 [GitHub API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Response interceptor for error handling and retries
    client.interceptors.response.use(
      (response) => {
        // Log rate limit info
        const rateLimit = {
          limit: response.headers['x-ratelimit-limit'],
          remaining: response.headers['x-ratelimit-remaining'],
          reset: response.headers['x-ratelimit-reset']
        };
        
        if (rateLimit.remaining) {
          console.log(`📊 [GitHub API] Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
          
          // Warn if running low
          if (parseInt(rateLimit.remaining) < 100) {
            console.warn(`⚠️ [GitHub API] Rate limit running low: ${rateLimit.remaining} requests remaining`);
          }
        }
        
        return response;
      },
      async (error) => {
        return this.handleError(error);
      }
    );

    return client;
  }

  async handleError(error, attempt = 0) {
    const maxRetries = 5;
    const config = error.config;
    const response = error.response;

    // Normalize error structure
    const normalizedError = {
      status: response?.status || 500,
      code: response?.status || 'UNKNOWN',
      message: response?.data?.message || error.message || 'Unknown GitHub API error',
      endpoint: config?.url || 'unknown'
    };

    // Handle rate limiting (429) and temporary failures (5xx)
    if (response?.status === 429 || (response?.status >= 500 && response?.status < 600)) {
      if (attempt < maxRetries) {
        let delay;
        
        if (response.status === 429) {
          // Respect Retry-After header
          const retryAfter = response.headers['retry-after'];
          const resetTime = response.headers['x-ratelimit-reset'];
          
          if (retryAfter) {
            delay = parseInt(retryAfter) * 1000;
          } else if (resetTime) {
            delay = (parseInt(resetTime) * 1000) - Date.now();
          } else {
            delay = Math.min(250 * Math.pow(2, attempt), 2000); // Exponential backoff: 250ms -> 2s max
          }
          
          console.warn(`🔄 [GitHub API] Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        } else {
          // Exponential backoff for 5xx errors
          delay = Math.min(250 * Math.pow(2, attempt), 2000);
          console.warn(`🔄 [GitHub API] Server error ${response.status}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          const retryResponse = await this.client.request(config);
          return retryResponse;
        } catch (retryError) {
          return this.handleError(retryError, attempt + 1);
        }
      }
    }

    // Handle 403 rate limit differently from auth errors
    if (response?.status === 403) {
      const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
      if (rateLimitRemaining === '0' && attempt < maxRetries) {
        const resetTime = response.headers['x-ratelimit-reset'];
        const delay = resetTime ? (parseInt(resetTime) * 1000) - Date.now() : 60000;
        
        console.warn(`🔄 [GitHub API] Rate limit reached. Waiting until reset: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, Math.max(delay, 1000)));
        
        try {
          const retryResponse = await this.client.request(config);
          return retryResponse;
        } catch (retryError) {
          return this.handleError(retryError, attempt + 1);
        }
      }
    }

    // Throw normalized error
    const finalError = new Error(normalizedError.message);
    finalError.status = normalizedError.status;
    finalError.code = normalizedError.code;
    finalError.endpoint = normalizedError.endpoint;
    throw finalError;
  }

  // Helper methods
  async get(path, params = {}) {
    try {
      const response = await this.client.get(path, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async post(path, body = {}) {
    try {
      const response = await this.client.post(path, body);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async put(path, body = {}) {
    try {
      const response = await this.client.put(path, body);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async patch(path, body = {}) {
    try {
      const response = await this.client.patch(path, body);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async del(path) {
    try {
      const response = await this.client.delete(path);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // RFC5988 Link header pagination implementation
  async getAllPaginated(path, params = {}) {
    const results = [];
    let nextUrl = null;
    let page = 1;
    
    // Set default per_page if not specified
    const paginationParams = {
      per_page: 100, // GitHub max
      page: 1,
      ...params
    };

    try {
      do {
        const response = await this.client.get(path, { 
          params: { ...paginationParams, page }
        });
        
        // Add current page results
        const data = response.data;
        if (Array.isArray(data)) {
          results.push(...data);
        } else {
          // Single item response, wrap in array
          results.push(data);
        }

        // Parse Link header for next page
        const linkHeader = response.headers.link;
        nextUrl = this.parseLinkHeader(linkHeader, 'next');
        
        // Extract page number from next URL if it exists
        if (nextUrl) {
          const nextPageMatch = nextUrl.match(/[?&]page=(\d+)/);
          page = nextPageMatch ? parseInt(nextPageMatch[1]) : page + 1;
        }

        console.log(`📄 [GitHub API] Fetched page ${page - 1}, got ${Array.isArray(data) ? data.length : 1} items. Next: ${nextUrl ? 'Yes' : 'No'}`);
        
      } while (nextUrl);

      console.log(`✅ [GitHub API] Pagination complete. Total items: ${results.length}`);
      return results;
      
    } catch (error) {
      console.error(`❌ [GitHub API] Pagination failed at page ${page}:`, error.message);
      throw error;
    }
  }

  // Parse RFC5988 Link header to extract specific relation URL
  parseLinkHeader(linkHeader, relation) {
    if (!linkHeader) return null;
    
    const links = linkHeader.split(',');
    for (const link of links) {
      const [url, rel] = link.split(';');
      if (rel && rel.trim().includes(`rel="${relation}"`)) {
        return url.trim().slice(1, -1); // Remove < and >
      }
    }
    return null;
  }

  // Legacy compatibility methods
  async githubRequest(path, init = {}) {
    const method = init.method || 'GET';
    const body = init.body;
    
    try {
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await this.get(path, init.params);
          break;
        case 'POST':
          response = await this.post(path, body);
          break;
        case 'PUT':
          response = await this.put(path, body);
          break;
        case 'PATCH':
          response = await this.patch(path, body);
          break;
        case 'DELETE':
          response = await this.del(path);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Configuration getters
  get OWNER() { return this.cfg.GITHUB_OWNER; }
  get REPO() { return this.cfg.GITHUB_REPO; }
  get API_URL() { return this.cfg.GITHUB_API_URL; }

  isConfigured() {
    return Boolean(this.cfg.GITHUB_OWNER && this.cfg.GITHUB_REPO && this.cfg.GITHUB_TOKEN);
  }

  async checkToken() {
    try {
      const user = await this.get('/user');
      return { ok: true, login: user.login };
    } catch (error) {
      return { ok: false, reason: 'TOKEN_INVALID_OR_SCOPE', detail: error.message };
    }
  }

  async checkRepoAccess() {
    if (!this.isConfigured()) return { ok: false, reason: 'NOT_CONFIGURED' };
    
    try {
      const repo = await this.get(`/repos/${this.OWNER}/${this.REPO}`);
      return { ok: true, private: !!repo.private, default_branch: repo.default_branch };
    } catch (error) {
      if (error.status === 404) return { ok: false, reason: 'REPO_NOT_FOUND_OR_PRIVATE_NO_ACCESS' };
      return { ok: false, reason: 'UNKNOWN', detail: error.message };
    }
  }
}

// Export singleton instance
const githubClient = new GitHubClient();

module.exports = {
  // New API
  get: (path, params) => githubClient.get(path, params),
  post: (path, body) => githubClient.post(path, body),
  put: (path, body) => githubClient.put(path, body),
  patch: (path, body) => githubClient.patch(path, body),
  del: (path) => githubClient.del(path),
  getAllPaginated: (path, params) => githubClient.getAllPaginated(path, params),
  
  // Legacy compatibility
  githubRequest: (path, init) => githubClient.githubRequest(path, init),
  checkToken: () => githubClient.checkToken(),
  checkRepoAccess: () => githubClient.checkRepoAccess(),
  isConfigured: () => githubClient.isConfigured(),
  
  // Configuration
  API_URL: githubClient.API_URL,
  OWNER: githubClient.OWNER,
  REPO: githubClient.REPO
};