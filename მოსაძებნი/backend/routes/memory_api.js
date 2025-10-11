const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const admin = require('../firebase');

const {
  saveMemory,
  retrieveMemories,
  toggleMemoryUsage,
  DEFAULT_MEMORY_CONTROLS,
  MemoryServiceError
} = require('../../ai-service/context/user_preferences');

// Memory data directory
const MEMORY_DATA_DIR = path.join(__dirname, '../memory_data');

const firestore = (() => {
  try {
    return admin.firestore();
  } catch (error) {
    console.warn('⚠️ Firestore unavailable in memory_api:', error.message);
    return null;
  }
})();

// Define a counter for API versions, to be incremented for each new version.
let versionCounter = 1;

router.get('/list', async (req, res) => {
  const userId = String(
    req.query.userId ||
      req.headers['x-user-id'] ||
      req.user?.id ||
      req.session?.userId ||
      ''
  );

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const payload = await retrieveMemories(userId, query, { firestore });
    const responseBody = {
      success: true,
      userId,
      query: query || null,
      memories: Array.isArray(payload?.memories) ? payload.memories : [],
      controls: payload?.controls || { ...DEFAULT_MEMORY_CONTROLS, lastUpdated: new Date().toISOString() }
    };

    if (payload?.degraded) {
      responseBody.degraded = true;
      responseBody.error = payload?.error;
    }

    res.json(responseBody);
  } catch (error) {
    const status = error instanceof MemoryServiceError ? error.status : 200;
    const fallback = {
      success: false,
      userId,
      query: req.query.q || null,
      memories: [],
      controls: {
        ...DEFAULT_MEMORY_CONTROLS,
        lastUpdated: new Date().toISOString()
      },
      degraded: true,
      error: {
        code: error instanceof MemoryServiceError ? error.code : 'MEMORY_FETCH_FAILED',
        message: error instanceof MemoryServiceError
          ? error.publicMessage
          : 'მეხსიერების მონაცემები დროებით მიუწვდომელია.'
      }
    };

    if (!(error instanceof MemoryServiceError)) {
      console.error('❌ Memory list unexpected error:', error);
    }

    res.status(status).json(fallback);
  }
});

router.post('/save', async (req, res) => {
  const { userId: bodyUserId, memory } = req.body || {};
  const userId = String(
    bodyUserId ||
      req.headers['x-user-id'] ||
      req.user?.id ||
      req.session?.userId ||
      ''
  );

  if (!userId || !memory) {
    return res.status(400).json({ success: false, error: 'userId and memory payload are required' });
  }

  try {
    const saved = await saveMemory(userId, memory, { firestore });
    res.json({ success: true, memory: saved });
  } catch (error) {
    console.error('❌ Memory save error:', error);
    res.status(500).json({ success: false, error: 'Failed to save memory entry', details: error.message });
  }
});

router.post('/toggle', async (req, res) => {
  const { userId: bodyUserId, feature, enabled } = req.body || {};
  const userId = String(
    bodyUserId ||
      req.headers['x-user-id'] ||
      req.user?.id ||
      req.session?.userId ||
      ''
  );

  if (!userId || !feature) {
    return res.status(400).json({ success: false, error: 'userId and feature are required' });
  }

  try {
    const controls = await toggleMemoryUsage(userId, feature, Boolean(enabled), { firestore });
    res.json({ success: true, controls });
  } catch (error) {
    const isKnown = error instanceof MemoryServiceError;
    const status = isKnown ? error.status : 503;

    if (!isKnown) {
      console.error('❌ Memory toggle unexpected error:', error);
    }

    res.status(status).json({
      success: false,
      error: isKnown ? error.publicMessage : 'მეხსიერების სერვისი დროებით მიუწვდომელია.',
      code: isKnown ? error.code : 'MEMORY_TOGGLE_FAILED'
    });
  }
});

// Helper function to load user memory
async function loadUserMemory(userId) {
  const memoryFilePath = path.join(MEMORY_DATA_DIR, `${userId}.json`);

  try {
    await fs.access(memoryFilePath);
    const memoryData = await fs.readFile(memoryFilePath, 'utf8');
    const parsedData = JSON.parse(memoryData);

    console.log(`📖 Memory data retrieved for user: ${userId}`);
    return {
      success: true,
      data: parsedData,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    // Return empty memory structure if file doesn't exist
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📝 Creating new memory structure for user: ${userId}`);
    }
    const defaultMemory = {
      schemaVersion: 2,
      lastSyncedAt: new Date().toISOString(),
      exportSource: "Backend API v1.0",
      personalInfo: {},
      systemRole: "USER",
      personaRole: "user",
      memoryKey: userId,
      savedRules: [],
      errorLogs: [],
      contextActions: [],
      codePreferences: [],
      stats: {
        memoryUsage: { value: 0, unit: "MB" },
        lastUpdate: new Date().toISOString(),
        itemsCount: {
          savedRules: 0,
          errorLogs: 0,
          contextActions: 0,
          codePreferences: 0
        }
      }
    };

    return {
      success: true,
      data: defaultMemory,
      created: true
    };
  }
}

// Helper function to merge and persist memory data
async function mergeAndPersist(userId, localData, timestamp) {
  const memoryDir = path.join(__dirname, '../memory_data');
  const memoryFile = path.join(memoryDir, `${userId}.json`);

  // Ensure directory exists
  await fs.mkdir(memoryDir, { recursive: true });

  // Read existing data for merge strategy
  let existingData = {};
  try {
    const existingContent = await fs.readFile(memoryFile, 'utf8');
    existingData = JSON.parse(existingContent);
  } catch (error) {
    console.log('No existing memory file, creating new one');
  }

  // Smart merge strategy - prefer local data but preserve server additions
  const mergedData = {
    ...existingData,
    ...localData,
    personalInfo: {
      ...existingData.personalInfo,
      ...localData.personalInfo // Priority to user edits
    },
    lastSync: timestamp || new Date().toISOString(),
    syncSource: 'memory_api'
  };

  // Save merged data
  await fs.writeFile(memoryFile, JSON.stringify(mergedData, null, 2));

  console.log(`✅ [Memory API] Memory synced successfully for user ${userId}`);
  return mergedData;
}

// GET /api/memory/view - Get memory for a user (legacy endpoint)
router.get('/view', async (req, res) => {
  const userId = String(req.query.userId || "");
  const result = await loadUserMemory(userId);
  const envelope = {
    data: {
      userId,
      personalInfo: result?.data?.personalInfo ?? {},
      savedRules: result?.data?.savedRules ?? [],
      contextActions: result?.data?.contextActions ?? [],
      codePreferences: result?.data?.codePreferences ?? [],
      stats: result?.data?.stats ?? {},
      updatedAt: result?.data?.updatedAt ?? new Date().toISOString(),
    },
    meta: { source: "server", version: versionCounter++ },
  };
  return res.json(envelope);
});

// POST /api/memory/update - Update memory endpoint (legacy)
router.post('/update', async (req, res) => {
  try {
    const { userId, personalInfo, mainMemory } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Update memory data
    const memoryDataPath = path.join(__dirname, '../memory_data', `${userId}.json`);

    let existingData = {};
    try {
      const content = await fs.readFile(memoryDataPath, 'utf8');
      existingData = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, start with empty object
    }

    const updatedData = {
      ...existingData,
      ...(personalInfo && { personalInfo }),
      ...(mainMemory !== undefined && { mainMemory }),
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(memoryDataPath, JSON.stringify(updatedData, null, 2));

    res.json({
      success: true,
      message: 'Memory updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Memory update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory data'
    });
  }
});

// GET /api/memory/:userId - Get user memory data
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await loadUserMemory(userId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error retrieving memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve memory data',
      details: error.message
    });
  }
});

// POST /api/memory/:userId - Update user memory data
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const memoryData = req.body;

    // Ensure memory data directory exists
    await fs.mkdir(MEMORY_DATA_DIR, { recursive: true });

    const memoryFilePath = path.join(MEMORY_DATA_DIR, `${userId}.json`);

    // Add metadata
    const enhancedData = {
      ...memoryData,
      lastSyncedAt: new Date().toISOString(),
      exportSource: "Backend API v1.0"
    };

    await fs.writeFile(memoryFilePath, JSON.stringify(enhancedData, null, 2));

    console.log(`💾 Memory data saved for user: ${userId}`);
    res.json({
      success: true,
      message: 'Memory data saved successfully',
      lastUpdated: enhancedData.lastSyncedAt
    });
  } catch (error) {
    console.error('❌ Error saving memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save memory data',
      details: error.message
    });
  }
});

// GET /api/memory/sync - Memory sync endpoint
router.get('/sync', async (req, res) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');

  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'User ID required' });
    }

    // Check if memory file exists
    const memoryPath = path.join(__dirname, '../memory_data', `${userId}.json`);
    let memoryData = {};

    try {
      const rawData = await fs.readFile(memoryPath, 'utf8');
      memoryData = JSON.parse(rawData);
    } catch (parseError) {
      console.warn(`Memory parse error for ${userId}:`, parseError.message);
      memoryData = { error: 'Invalid memory data format' };
    }

    res.json({ ok: true, data: memoryData, userId });
  } catch (error) {
    console.error('Memory sync error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// POST /api/memory/sync - Memory sync endpoint (for system sync)
router.post('/sync', express.json(), async (req, res) => {
  const { userId, localData, timestamp } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId required" });
  const merged = await mergeAndPersist(userId, localData, timestamp);
  const envelope = {
    data: {
      userId,
      personalInfo: merged?.personalInfo ?? {},
      savedRules: merged?.savedRules ?? [],
      contextActions: merged?.contextActions ?? [],
      codePreferences: merged?.codePreferences ?? [],
      stats: merged?.stats ?? {},
      updatedAt: merged?.updatedAt ?? new Date().toISOString(),
    },
    meta: { source: "server", version: versionCounter++ },
  };
  return res.json(envelope);
});

// Health check for memory API
router.get('/health/check', (req, res) => {
  res.json({
    success: true,
    service: 'Memory API',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;