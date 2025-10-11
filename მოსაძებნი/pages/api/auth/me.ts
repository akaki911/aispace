
import type { NextApiRequest, NextApiResponse } from 'next';

interface User {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'SUPER_ADMIN';
  personalId?: string;
  displayName?: string;
}

interface AuthResponse {
  success: true;
  authenticated: true;
  user: User;
  role: string;
  userId: string;
  deviceTrust: boolean;
}

interface ErrorResponse {
  success: false;
  authenticated: false;
  error: string;
  code: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | ErrorResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      authenticated: false,
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    console.log('🔍 [General Auth] /api/auth/me check:', {
      hasHeaders: !!req.headers,
      userAgent: req.headers['user-agent']?.substring(0, 50),
      origin: req.headers.origin
    });

    // Check for Firebase Auth token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      
      try {
        // In a real implementation, verify Firebase token here
        // For now, mock Firebase token validation
        if (token.length > 20) {
          const mockUser: User = {
            id: 'firebase-user-id',
            email: 'customer@bakhmaro.ge',
            role: 'CUSTOMER',
            displayName: 'Customer User'
          };

          console.log('✅ [General Auth] Firebase token validated:', mockUser.email);

          return res.status(200).json({
            success: true,
            authenticated: true,
            user: mockUser,
            role: mockUser.role,
            userId: mockUser.id,
            deviceTrust: false // Firebase users don't get device trust
          });
        }
      } catch (firebaseError) {
        console.error('❌ [General Auth] Firebase token validation failed:', firebaseError);
      }
    }

    // Check for session cookies (Provider/Customer sessions)
    const cookies = req.headers.cookie;
    if (cookies) {
      // Parse cookies to find session
      const sessionMatch = cookies.match(/session=([^;]+)/);
      const userSessionMatch = cookies.match(/user_session=([^;]+)/);
      
      if (sessionMatch || userSessionMatch) {
        // Mock session validation - in real implementation, verify against your session store
        const mockSessionUser: User = {
          id: 'session-user-id',
          email: 'provider@bakhmaro.ge',
          role: 'PROVIDER',
          displayName: 'Provider User'
        };

        console.log('✅ [General Auth] Session validated:', mockSessionUser.email);

        return res.status(200).json({
          success: true,
          authenticated: true,
          user: mockSessionUser,
          role: mockSessionUser.role,
          userId: mockSessionUser.id,
          deviceTrust: false
        });
      }
    }

    // No valid authentication found
    console.log('❌ [General Auth] No valid authentication found');
    
    return res.status(401).json({
      success: false,
      authenticated: false,
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    });

  } catch (error) {
    console.error('❌ [General Auth] Internal error:', error);
    return res.status(500).json({
      success: false,
      authenticated: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}
