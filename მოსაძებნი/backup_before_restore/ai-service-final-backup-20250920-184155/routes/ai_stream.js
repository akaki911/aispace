const express = require('express');
const router = express.Router();

// Import AI services with fallback
let groqService;
try {
  groqService = require('../services/groq_service');
} catch (error) {
  console.warn('⚠️ Groq service not available for streaming:', error.message);
}

// SOL-203: POST /api/ai/stream - Server-Sent Events streaming endpoint
router.post('/stream', async (req, res) => {
  console.log('🌊 AI Stream endpoint accessed');
  
  try {
    const { message, personalId = '01019062020', params = {} } = req.body;
    
    console.log('🔍 Stream Request:', { 
      message: message?.substring(0, 50), 
      personalId,
      streaming: true
    });

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message is required for streaming',
        timestamp: new Date().toISOString()
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 10000);

    // Send initial event
    res.write(`event: start\n`);
    res.write(`data: {"status":"streaming","timestamp":"${new Date().toISOString()}"}\n\n`);

    if (!groqService) {
      res.write(`event: error\n`);
      res.write(`data: {"error":"AI services not available","timestamp":"${new Date().toISOString()}"}\n\n`);
      clearInterval(heartbeat);
      return res.end();
    }

    // Georgian system prompt for streaming
    const systemPrompt = `გამარჯობა! თქვენ ხართ გურულო AI - Bakhmaro Cottages პლატფორმის ოფიციალური Developer Assistant.

**STREAMING MODE ACTIVE** - You are responding with real-time chunks.

Language: ყველა პასუხი ქართულ ენაზე 🇬🇪
Response style: პირდაპირი, ტექნიკური, კონკრეტული

Role: Senior Full-Stack Engineer for ouranos/Bakhmaro platform`;

    try {
      // Use streaming mode from Groq service
      const streamResponse = await groqService.askGroq([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ], personalId, true); // Enable streaming

      if (typeof streamResponse === 'string') {
        // Simple string response - chunk it
        const chunks = streamResponse.match(/.{1,50}/g) || [streamResponse];
        
        for (let i = 0; i < chunks.length; i++) {
          res.write(`event: chunk\n`);
          res.write(`data: {"content":"${chunks[i].replace(/"/g, '\\"')}","index":${i}}\n\n`);
          
          // Small delay for natural streaming effect
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // Full response fallback
        res.write(`event: chunk\n`);
        res.write(`data: {"content":"${(streamResponse.content || 'No response').replace(/"/g, '\\"')}","final":true}\n\n`);
      }

      // Send completion event
      res.write(`event: end\n`);
      res.write(`data: {"status":"complete","timestamp":"${new Date().toISOString()}"}\n\n`);
      
    } catch (streamError) {
      console.error('🌊 Streaming error:', streamError.message);
      res.write(`event: error\n`);
      res.write(`data: {"error":"Streaming failed: ${streamError.message}","timestamp":"${new Date().toISOString()}"}\n\n`);
    }

    clearInterval(heartbeat);
    res.end();

  } catch (error) {
    console.error('❌ Stream endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Stream endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;