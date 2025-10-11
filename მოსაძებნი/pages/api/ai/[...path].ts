
import { NextApiRequest, NextApiResponse } from 'next';
import { bootstrapEnv } from '../../../scripts/bootstrapEnv';

bootstrapEnv({ silent: true });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';

// Rate limiting
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // Increased from 5

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || 0;
  
  // Reset if window expired
  if (requests === 0 || now - requests > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, 1);
    return false;
  }
  
  if (requests >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  rateLimitMap.set(ip, requests + 1);
  return false;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  
  // Get client IP
  const clientIp = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.connection.remoteAddress || 
                   'unknown';

  // Apply rate limiting for GitHub endpoints
  if (apiPath?.includes('github') && isRateLimited(clientIp)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Please wait before making more GitHub API requests',
      retryAfter: 60
    });
  }

  try {
    const targetUrl = `${AI_SERVICE_URL}/api/ai/${apiPath}`;
    console.log(`🔄 [API Proxy] ${req.method} ${req.url} -> ${targetUrl}`);

    const requestOptions: RequestInit = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Gurulo-AI-Proxy/2.0',
        ...(req.headers.authorization && { authorization: req.headers.authorization as string }),
      },
      ...(req.method !== 'GET' && req.body && { body: JSON.stringify(req.body) }),
    };

    const response = await fetch(targetUrl, requestOptions);
    
    if (!response.ok) {
      console.error(`❌ AI Service error ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'AI Service Error',
        message: errorText || 'Service unavailable',
        status: response.status
      });
    }

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error('❌ API Proxy error:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI service is currently unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
