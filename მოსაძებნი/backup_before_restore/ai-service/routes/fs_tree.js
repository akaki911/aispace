const express = require('express');
const router = express.Router();
const fetch = require('node-fetch').default || require('node-fetch');

console.log('📁 [AI-FS] File tree route loaded');

// Proxy file tree requests to backend /api/files/tree
router.get('/tree', async (req, res) => {
  try {
    console.log('📁 [AI-FS] File tree request - proxying to backend');
    
    // Proxy to backend service
    const backendUrl = 'http://127.0.0.1:5002/api/files/tree';
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      }
    });
    
    if (!response.ok) {
      console.error('❌ [AI-FS] Backend file tree request failed:', response.status);
      return res.status(response.status).json({
        error: 'File tree service unavailable',
        status: response.status
      });
    }
    
    const data = await response.json();
    console.log('✅ [AI-FS] File tree loaded successfully');
    res.json(data);
    
  } catch (error) {
    console.error('❌ [AI-FS] File tree error:', error);
    res.status(500).json({
      error: 'File tree service error',
      message: error.message
    });
  }
});

module.exports = router;