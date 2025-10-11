const fetch = require('node-fetch');
const { URL } = require('url');

/**
 * SOL-212 Gurulo Safe Web Access Tools
 * Server-side internet access with security controls
 */

// Security constants
const TIMEOUT_MS = 8000; // 8 second timeout
const MAX_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB limit
const USER_AGENT = 'Gurulo-Assistant/1.0 (+https://bakhmaro.co)';

// Blocked IP ranges (private networks, localhost, etc.)
const BLOCKED_IP_PATTERNS = [
  /^127\./, // localhost
  /^10\./, // private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private class B
  /^192\.168\./, // private class C
  /^169\.254\./, // link-local
  /^::1$/, // IPv6 localhost
  /^fc00:/, // IPv6 private
  /^fe80:/, // IPv6 link-local
];

/**
 * Validate URL for safety
 * @param {string} urlString - URL to validate
 * @returns {boolean} - Whether URL is safe
 */
function isUrlSafe(urlString) {
  try {
    const url = new URL(urlString);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }
    
    // Block blocked hostnames
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      return false;
    }
    
    // Check IP patterns (basic check)
    if (BLOCKED_IP_PATTERNS.some(pattern => pattern.test(hostname))) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean HTML content for safe display
 * @param {string} html - HTML content
 * @returns {string} - Cleaned text
 */
function cleanHtmlText(html) {
  if (!html) return '';
  
  // Remove scripts, styles, and other dangerous elements
  const cleaned = html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ') // Strip all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
    
  return cleaned.length > 2000 ? cleaned.substring(0, 2000) + '...' : cleaned;
}

/**
 * Search the web for information
 * @param {string} query - Search query
 * @param {Object} opts - Search options
 * @returns {Promise<Object>} - Search results
 */
async function webSearch(query, opts = {}) {
  try {
    if (!query || query.length > 256) {
      throw new Error('Invalid query length (1-256 chars)');
    }
    
    console.log(`🔍 [Web Search] Query: "${query}"`);
    
    // Use a safe search approach (DuckDuckGo instant answers or similar)
    // This is a simplified implementation - in production you'd use proper search APIs
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=en-us`;
    
    if (!isUrlSafe(searchUrl)) {
      throw new Error('Unsafe search URL');
    }
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1'
      },
      timeout: TIMEOUT_MS,
      size: MAX_SIZE_BYTES
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const html = await response.text();
    const preview = cleanHtmlText(html);
    
    return {
      success: true,
      query,
      results: [
        {
          title: `Search results for: ${query}`,
          url: searchUrl,
          preview: preview.substring(0, 500)
        }
      ],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('🚨 [Web Search] Error:', error.message);
    return {
      success: false,
      error: error.message,
      query
    };
  }
}

/**
 * Fetch and analyze a web page
 * @param {string} url - URL to fetch
 * @returns {Promise<Object>} - Page analysis
 */
async function webGet(url) {
  try {
    if (!url || !isUrlSafe(url)) {
      throw new Error('Invalid or unsafe URL');
    }
    
    console.log(`🌐 [Web Get] Fetching: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1'
      },
      timeout: TIMEOUT_MS,
      size: MAX_SIZE_BYTES,
      redirect: 'follow'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract basic metadata
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Extract headings (simplified)
    const headings = [];
    const h1Matches = html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi);
    if (h1Matches) {
      headings.push(...h1Matches.slice(0, 5).map(h => cleanHtmlText(h)));
    }
    
    // Clean text preview
    const preview = cleanHtmlText(html);
    
    return {
      success: true,
      url,
      title,
      headings,
      preview: preview.substring(0, 1500),
      size: html.length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('🚨 [Web Get] Error:', error.message);
    return {
      success: false,
      error: error.message,
      url
    };
  }
}

module.exports = {
  webSearch,
  webGet,
  isUrlSafe
};