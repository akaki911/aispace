
import type { NextApiRequest, NextApiResponse } from 'next';

interface AuthResponse {
  name: string;
  role: string;
}

interface ErrorResponse {
  error: string;
  code: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authorization header missing',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: 'Token missing',
        code: 'TOKEN_MISSING'
      });
    }

    // Simple token validation - replace with your actual token validation logic
    // For now, checking against a hardcoded admin token
    const validAdminTokens = [
      'admin_token_01019062020',
      'super_admin_bakhmaro_2024',
      'dev_admin_token'
    ];

    if (!validAdminTokens.includes(token)) {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    // If token is valid, return admin user info
    return res.status(200).json({
      name: 'კაკი',
      role: 'admin'
    });

  } catch (error) {
    console.error('❌ Auth endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}
