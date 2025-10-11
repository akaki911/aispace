const express = require("express");
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get memory for a user
router.get('/memory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 [Memory API] Loading memory for user: ${userId}`);

    // Load memory data from file system first (fallback)
    const memoryFilePath = path.join(__dirname, '../memory_data', `${userId}.json`);

    let memoryData = {};

    try {
      const fileExists = await fs.access(memoryFilePath).then(() => true).catch(() => false);

      if (fileExists) {
        const fileContent = await fs.readFile(memoryFilePath, 'utf8');
        memoryData = JSON.parse(fileContent);
        console.log(`✅ [Memory API] Loaded memory from file for user: ${userId}`);
      } else {
        console.log(`⚠️ [Memory API] No memory file found for user: ${userId}, using default`);
        // Create default memory structure
        memoryData = {
          personalInfo: {
            name: "გიორგი",
            age: "25",
            interests: "AI, Web Development, UI/UX",
            notes: "AI Developer specializing in React and TypeScript",
            preferredLanguage: "ka",
            role: "developer",
            programmingLanguages: ["TypeScript", "React", "Node.js"],
            codeStyle: "strict, typed",
            currentProject: "GPT-პანელი",
            openFiles: ["AIDeveloperPanel.tsx", "Layout.tsx"]
          },
          savedRules: [
            {
              id: "1",
              title: "არ დამალო ფაილები ფაილის ხედში",
              description: "ფაილების ხილვადობა უზრუნველყოფილი უნდა იყოს ყოველთვის",
              technicalTip: "გამოიყენე visible: true props FileTree კომპონენტში",
              isActive: true,
              category: "ui",
              createdAt: new Date().toISOString(),
              usageCount: 5
            }
          ],
          errorLogs: [],
          contextActions: [],
          codePreferences: [],
          stats: {
            totalRules: 1,
            activeRules: 1,
            resolvedErrors: 0,
            totalActions: 0,
            accuracyRate: 100,
            memoryUsage: 0.001
          }
        };

        // Ensure memory_data directory exists
        const memoryDir = path.dirname(memoryFilePath);
        await fs.mkdir(memoryDir, { recursive: true });

        // Save default memory data
        await fs.writeFile(memoryFilePath, JSON.stringify(memoryData, null, 2));
        console.log(`✅ [Memory API] Created default memory file for user: ${userId}`);
      }
    } catch (fileError) {
      console.error(`❌ [Memory API] File system error for user ${userId}:`, fileError);
      throw new Error(`Memory file system error: ${fileError.message}`);
    }

    res.status(200).json({
      success: true,
      data: memoryData,
      timestamp: new Date().toISOString(),
      source: 'file_system'
    });

  } catch (error) {
    console.error(`❌ [Memory API] Error loading memory for user ${req.params.userId}:`, error);

    // Return comprehensive error response
    res.status(500).json({
      type: "MEMORY_LOAD_ERROR",
      code: 500,
      message: "Error loading memory data",
      details: {
        originalError: {
          message: error.message,
          stack: error.stack
        },
        userId: req.params.userId
      },
      timestamp: new Date().toISOString(),
      language: "en",
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      context: {
        service: "ai-service",
        version: "2.0",
        endpoint: "/memory/:userId"
      },
      suggestions: [
        "Check if memory file exists for user",
        "Verify file system permissions",
        "Try creating default memory structure"
      ],
      recovery: {
        retry: true,
        retryDelay: 2000,
        fallback: "Use default memory data",
        contact: null
      }
    });
  }
});

// Remember a fact
router.post('/remember', async (req, res) => {
  try {
    const { userId, fact } = req.body;

    if (!userId || !fact) {
      return res.status(400).json({
        success: false,
        error: 'userId და fact აუცილებელია'
      });
    }

    // Placeholder for actual addToMemory logic, e.g., calling a service
    // await addToMemory(userId, fact);

    // For demonstration, we'll just log and return success
    console.log(`📝 [Memory API] Fact to remember for user ${userId}: "${fact}"`);
    // Simulate saving to memory (e.g., to a database or file)
    // In a real scenario, this would involve updating the memory structure for the user.

    res.json({
      success: true,
      message: 'ფაქტი დამახსოვრებულია',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Remember fact error:', error);
    res.status(500).json({
      success: false,
      error: 'ფაქტის დამახსოვრება ვერ მოხერხდა'
    });
  }
});

module.exports = router;