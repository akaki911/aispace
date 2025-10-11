const express = require('express');
const router = express.Router();
const { subscribers, startHeartbeat, logActivity } = require('../services/activity_bus');
const store = require('../utils/activity_store');

router.get('/', (req, res) => {
  const lastEventId = req.header('Last-Event-ID') || req.query.lastEventId;

  // Set CORS headers before writeHead
  const origin = req.headers.origin || req.headers.host || '*';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Cache-Control, Accept, Content-Type, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  console.log('[SSE] client connected, Last-Event-ID=%s', lastEventId || '-');

  try {
    const replay = lastEventId ? store.getSince(lastEventId, 200) : store.query({ limit: 20 });
    for (const e of replay) {
      res.write(formatSSE(e));
    }

    const client = subscribers.add(res, lastEventId);
    res.write(`event: connected\ndata: {"ok":true,"timestamp":"${new Date().toISOString()}"}\n\n`);

    req.on('close', () => {
      console.log('[SSE] client disconnected');
      subscribers.remove(client);
    });

    req.on('error', (err) => {
      console.error('[SSE] client error:', err);
      subscribers.remove(client);
    });
  } catch (error) {
    console.error('[SSE] Error setting up client:', error);
    res.write(`event: error\ndata: {"error":"${error.message}"}\n\n`);
  }
});

// Manual activity generation endpoint (უშუალო გაშვება)
router.post('/seed', (req, res) => {
  console.log('🔥 POST /seed endpoint hit!');
  try {
    console.log('🔥 Manual activity seeding triggered');

    const testActivities = [
      {
        actionType: 'SYSTEM_STARTED',
        summary: '✅ SUPER_ADMIN Console ჩართული',
        author: { name: 'System', type: 'SYSTEM' },
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        details: { message: 'Admin კონსოლი ჩაირთო წარმატებით', component: 'Console' }
      },
      {
        actionType: 'CODE_REFACTOR',
        summary: '⚙️ ExplorerPanel.tsx კომპონენტი გამოყოფილია',
        author: { name: 'Replit Agent', type: 'AGENT' },
        timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        details: { file: 'src/components/ExplorerPanel.tsx', message: 'Component separation completed successfully' }
      },
      {
        actionType: 'AI_MODEL_UPDATE',
        summary: '🤖 Groq AI მოდელი განახლდა llama-3.1-8b-instant-ზე',
        author: { name: 'AI Assistant', type: 'AI' },
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        details: { model: 'llama-3.1-8b-instant', previousModel: 'llama3-8b-8192', status: 'updated' }
      },
      {
        actionType: 'AUTHENTICATION',
        summary: '🔐 SUPER_ADMIN ავთენტიფიკაცია აღდგენილია',
        author: { name: 'მომხმარებელი', type: 'USER' },
        timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        details: { userId: '01019062020', role: 'SUPER_ADMIN', action: 'restored' }
      }
    ];

    testActivities.forEach((activity, index) => {
      setTimeout(() => {
        console.log(`🔥 Logging activity: ${activity.summary}`);
        logActivity(activity);
      }, index * 100);
    });

    res.json({ ok: true, seeded: testActivities.length, message: 'Activities seeded successfully' });
  } catch (error) {
    console.error('❌ Manual seed error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

function formatSSE(evt){ return `id: ${evt.id}\nevent: activity\ndata: ${JSON.stringify(evt)}\n\n`; }
startHeartbeat(parseInt(process.env.ACTIVITY_HEARTBEAT_MS || '25000', 10));
module.exports = router;