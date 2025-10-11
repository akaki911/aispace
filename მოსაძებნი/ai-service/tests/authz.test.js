
/**
 * Authorization Middleware Tests
 * SOL-211 Security Hardening
 */

const request = require('supertest');
const express = require('express');
const { 
  requireAssistantAuth, 
  requireRole, 
  requirePermission,
  assistantRateLimit,
  auditLog 
} = require('../middleware/authz');

// Mock JWT utilities
jest.mock('../../backend/utils/jwt', () => ({
  verifyToken: jest.fn(),
  extractTokenFromRequest: jest.fn()
}));

const { verifyToken, extractTokenFromRequest } = require('../../backend/utils/jwt');

// Mock fetch for backend session checks
global.fetch = jest.fn();

describe('Authorization Middleware Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    jest.clearAllMocks();
  });

  describe('requireAssistantAuth', () => {
    test('should authenticate with valid JWT token', async () => {
      extractTokenFromRequest.mockReturnValue('valid-jwt-token');
      verifyToken.mockReturnValue({
        userId: 'user123',
        role: 'SUPER_ADMIN',
        permissions: ['assistant:read'],
        type: 'api_access'
      });

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ user: req.user });
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer valid-jwt-token');

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe('user123');
      expect(response.body.user.authMethod).toBe('jwt');
    });

    test('should authenticate with valid session', async () => {
      extractTokenFromRequest.mockReturnValue(null);
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ok: true,
          user: {
            id: 'session-user',
            role: 'SUPER_ADMIN'
          }
        })
      });

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ user: req.user });
      });

      const response = await request(app)
        .get('/test')
        .set('Cookie', 'session=valid-session');

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe('session-user');
      expect(response.body.user.authMethod).toBe('session');
    });

    test('should reject invalid JWT token', async () => {
      extractTokenFromRequest.mockReturnValue('invalid-token');
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      fetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject when no authentication provided', async () => {
      extractTokenFromRequest.mockReturnValue(null);
      fetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');

      expect(response.status).toBe(401);
      expect(response.body.supportedMethods).toContain('JWT Bearer token');
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      app.use((req, res, next) => {
        req.user = {
          id: 'test-user',
          role: 'ADMIN',
          authenticated: true
        };
        next();
      });
    });

    test('should allow access with correct role', async () => {
      app.get('/admin', requireRole(['ADMIN', 'SUPER_ADMIN']), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/admin');
      expect(response.status).toBe(200);
    });

    test('should deny access with insufficient role', async () => {
      app.use((req, res, next) => {
        req.user.role = 'CUSTOMER';
        next();
      });

      app.get('/admin', requireRole(['ADMIN', 'SUPER_ADMIN']), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/admin');
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    test('should deny access when not authenticated', async () => {
      app.use((req, res, next) => {
        req.user = null;
        next();
      });

      app.get('/admin', requireRole(['ADMIN']), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/admin');
      expect(response.status).toBe(401);
    });
  });

  describe('requirePermission', () => {
    beforeEach(() => {
      app.use((req, res, next) => {
        req.user = {
          id: 'test-user',
          permissions: ['assistant:read', 'assistant:write'],
          authenticated: true
        };
        next();
      });
    });

    test('should allow access with correct permission', async () => {
      app.get('/read', requirePermission('assistant:read'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/read');
      expect(response.status).toBe(200);
    });

    test('should deny access without required permission', async () => {
      app.get('/admin', requirePermission('assistant:admin'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/admin');
      expect(response.status).toBe(403);
      expect(response.body.requiredPermission).toBe('assistant:admin');
    });
  });

  describe('assistantRateLimit', () => {
    beforeEach(() => {
      app.use((req, res, next) => {
        req.user = { id: 'test-user' };
        next();
      });
    });

    test('should allow requests within rate limit', async () => {
      app.get('/test', assistantRateLimit(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    test('should reject requests exceeding rate limit', async () => {
      app.get('/test', assistantRateLimit(), (req, res) => {
        res.json({ success: true });
      });

      // Make 31 requests (limit is 30)
      for (let i = 0; i < 31; i++) {
        const response = await request(app).get('/test');
        if (i === 30) {
          expect(response.status).toBe(429);
          expect(response.body.error).toBe('Too Many Requests');
        }
      }
    });
  });

  describe('auditLog', () => {
    test('should log requests and responses', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      app.use((req, res, next) => {
        req.user = { id: 'test-user', role: 'ADMIN', authMethod: 'jwt' };
        next();
      });

      app.get('/test', auditLog, (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔐 [AUDIT] GET /test - User: test-user - Role: ADMIN')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle JWT verification errors gracefully', async () => {
      extractTokenFromRequest.mockReturnValue('token');
      verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });
      fetch.mockRejectedValue(new Error('Network error'));

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
    });

    test('should handle session check network errors', async () => {
      extractTokenFromRequest.mockReturnValue(null);
      fetch.mockRejectedValue(new Error('Network error'));

      app.get('/test', requireAssistantAuth, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(401);
    });
  });
});
