const { WebSocketServer } = require('ws');

/**
 * Configure lightweight WebSocket support for Gurulo real-time features.
 * Provides a minimal publish/subscribe channel that keeps the frontend's
 * development widgets happy without requiring the full AI stack.
 *
 * @param {import('http').Server} server - HTTP server instance.
 * @param {object} options
 * @param {string} [options.path='/api/gurulo/ws'] - Upgrade path.
 * @param {string[]} [options.allowOrigins] - Origins allowed to connect.
 * @param {number} [options.heartbeatInterval=30000] - Interval in ms for heartbeat events.
 * @param {{ info?: Function, warn?: Function, error?: Function }} [options.logger]
 */
function setupGuruloWebSocket(server, options = {}) {
  const {
    path = '/api/gurulo/ws',
    allowOrigins = [],
    heartbeatInterval = 30000,
    logger = console,
  } = options;

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  const isOriginAllowed = (origin, requestHost) => {
    if (!origin) return true;

    try {
      const originUrl = new URL(origin);

      // Allow same-host connections (e.g. production deployments)
      if (originUrl.host === requestHost) {
        return true;
      }

      return allowOrigins.some((allowed) => {
        if (!allowed) return false;
        try {
          const allowedUrl = new URL(allowed);
          return allowedUrl.host === originUrl.host;
        } catch {
          // Fallback to direct string comparison when URL parsing fails
          return allowed === origin;
        }
      });
    } catch {
      return false;
    }
  };

  server.on('upgrade', (request, socket, head) => {
    try {
      const upgradeUrl = new URL(request.url, `http://${request.headers.host}`);

      if (upgradeUrl.pathname !== path) {
        socket.destroy();
        return;
      }

      if (!isOriginAllowed(request.headers.origin, request.headers.host)) {
        logger?.warn?.('🚫 [GURULO-WS] Upgrade blocked by origin policy', {
          origin: request.headers.origin,
        });
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      logger?.error?.('❌ [GURULO-WS] Failed to handle upgrade', {
        message: error.message,
      });
      socket.destroy();
    }
  });

  const broadcast = (event) => {
    if (!event || typeof event !== 'object') return;
    const payload = JSON.stringify(event);

    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        try {
          client.send(payload);
        } catch (error) {
          logger?.warn?.('⚠️ [GURULO-WS] Failed to deliver payload', {
            message: error.message,
          });
        }
      }
    }
  };

  wss.on('connection', (ws, request) => {
    clients.add(ws);

    logger?.info?.('✅ [GURULO-WS] Client connected', {
      totalClients: clients.size,
      origin: request.headers.origin,
    });

    ws.send(
      JSON.stringify({
        type: 'connected',
        message: 'Gurulo realtime channel ready',
        timestamp: new Date().toISOString(),
      }),
    );

    ws.on('close', () => {
      clients.delete(ws);
      logger?.info?.('👋 [GURULO-WS] Client disconnected', {
        totalClients: clients.size,
      });
    });

    ws.on('error', (error) => {
      logger?.warn?.('⚠️ [GURULO-WS] Client error', {
        message: error.message,
      });
    });
  });

  const heartbeatTimer = setInterval(() => {
    broadcast({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
    });
  }, heartbeatInterval);

  const shutdown = () => {
    clearInterval(heartbeatTimer);
    for (const client of clients) {
      try {
        client.terminate();
      } catch (error) {
        logger?.warn?.('⚠️ [GURULO-WS] Failed to terminate client cleanly', {
          message: error.message,
        });
      }
    }
    wss.close();
  };

  return {
    broadcast,
    close: shutdown,
    stats: () => ({
      clients: clients.size,
    }),
  };
}

module.exports = {
  setupGuruloWebSocket,
};
