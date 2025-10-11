const { createProxyMiddleware } = require('http-proxy-middleware');

const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://0.0.0.0:5001';

const aiProxyMiddleware = createProxyMiddleware({
  target: aiServiceUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api/ai': '/api/ai' // Keep the API path structure
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 [AI Proxy] ${req.method} ${req.originalUrl} -> ${aiServiceUrl}${req.originalUrl}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ [AI Proxy] Response: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
  },
  onError: (err, req, res) => {
    console.error(`❌ [AI Proxy] Error for ${req.method} ${req.originalUrl}:`, err.message);
    res.status(503).json({
      error: 'AI Service Unavailable',
      message: 'The AI microservice is currently unavailable. Please try again later.',
      timestamp: new Date().toISOString(),
      originalPath: req.originalUrl
    });
  },
  timeout: 30000,
  proxyTimeout: 30000
});

module.exports = aiProxyMiddleware;