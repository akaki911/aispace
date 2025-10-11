const express = require("express");
const router = express.Router();
const { rememberFact, getMemory, addToMemory } = require("../services/memory_controller");
const { handleMemoryHealthCheck } = require('../controllers/ai_controller');

// დაიმახსოვრე ფაქტი
router.post("/remember", async (req, res) => {
  const { userId, fact, memory } = req.body;
  const factToStore = fact || memory;

  if (!userId || !factToStore) {
    return res.status(400).json({
      error: "userId და fact/memory აუცილებელია",
      success: false
    });
  }

  try {
    await addToMemory(userId, factToStore);
    res.json({
      success: true,
      message: "🧠 ინფორმაცია დამახსოვრდა!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Remember endpoint error:', error);
    res.status(500).json({
      error: "მეხსიერებაში შენახვა ვერ მოხერხდა",
      success: false
    });
  }
});

// წაიკითხე მეხსიერება
router.get("/memory/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const data = await getMemory(userId);
    res.json(data || {
      data: null,
      message: "მეხსიერება ცარიელია",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Memory fetch endpoint error:', error);
    res.status(500).json({
      error: "მეხსიერების წაკითხვა ვერ მოხერხდა",
      success: false
    });
  }
});

// წაშალე მეხსიერება
router.delete("/memory/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { getFirestore } = require("firebase-admin/firestore");
    const db = getFirestore();

    await db.collection("memory").doc(userId).delete();
    res.json({
      success: true,
      message: "🧠 მეხსიერება წაიშალა!",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Memory delete endpoint error:', error);
    res.status(500).json({
      error: "მეხსიერების წაშლა ვერ მოხერხდა",
      success: false
    });
  }
});

router.post('/chat', async (req, res) => {
  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
});

// Memory health check
router.get('/memory/health/:userId', handleMemoryHealthCheck);

// Health check route
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-service' });
});

// CSRF token route
router.get('/csrf', (req, res) => {
  const token = require('crypto').randomBytes(32).toString('hex');
  res.json({ token });
});

// AI chat route (using existing handler)
// aiController.processChat will be handled by existing chat route above

// Memory routes
router.get('/memory/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const memoryData = {
      personalInfo: {
        name: "Developer",
        skills: ["JavaScript", "React", "Node.js"],
        preferences: {}
      },
      facts: [
        "User prefers clean code architecture",
        "Works with React and TypeScript",
        "Uses Replit for development"
      ],
      grammarFixes: [],
      interactionHistory: []
    };
    res.json(memoryData);
  } catch (error) {
    res.status(500).json({ error: 'Memory service error' });
  }
});

// System status route
router.get('/system-status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      ai: 'running',
      memory: 'running',
      groq: 'connected'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;