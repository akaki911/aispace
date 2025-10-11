
const express = require('express');
const { syncMemoryToFirebase, periodicSyncCheck } = require('../memory_controller');
const router = express.Router();

// Memory sync recovery endpoint
router.post('/sync', async (req, res) => {
  try {
    const { personalId } = req.body;

    if (personalId !== '01019062020') {
      return res.status(403).json({ 
        error: 'არ გაქვთ ამ ფუნქციის გამოყენების უფლება',
        success: false 
      });
    }

    console.log('🔄 Manual sync recovery requested for user:', personalId);
    
    let syncResult = { success: false, error: null };

    try {
      // Check memory file existence first
      const fs = require('fs').promises;
      const path = require('path');
      const memoryPath = path.join(__dirname, '../memory_data', `${personalId}.json`);
      
      try {
        await fs.access(memoryPath);
        console.log('✅ Memory file exists, proceeding with sync');
      } catch (fileError) {
        console.warn('⚠️ Memory file missing, creating fallback');
        const fallbackData = {
          personalInfo: { name: 'აკაკი ცინცაძე', role: 'developer' },
          savedRules: [],
          stats: { accuracyRate: 85 }
        };
        await fs.mkdir(path.dirname(memoryPath), { recursive: true });
        await fs.writeFile(memoryPath, JSON.stringify(fallbackData, null, 2));
      }
      
      // Attempt periodic sync check
      const checkResult = await periodicSyncCheck(personalId);
      if (checkResult && checkResult.success) {
        return res.json({
          success: true,
          message: 'Firebase სინქრონიზაცია წარმატებით დასრულდა',
          synced: true,
          timestamp: new Date().toISOString(),
          recovered: true
        });
      }
    } catch (checkError) {
      console.warn('Periodic sync check failed:', checkError.message);
    }

    try {
      // If periodic check fails, try direct sync
      syncResult = await syncMemoryToFirebase(personalId);
    } catch (syncError) {
      console.error('Direct sync failed:', syncError.message);
      syncResult = { 
        success: false, 
        error: `სინქრონიზაციის შეცდომა: ${syncError.message}` 
      };
    }
    
    // Always return success response to prevent UI crashes
    res.json({
      success: syncResult.success,
      message: syncResult.success 
        ? 'მეხსიერება წარმატებით სინქრონიზდა Firebase-თან' 
        : `სინქრონიზაცია ვერ მოხერხდა: ${syncResult.error || 'Firebase მიუწვდომელია'}`,
      synced: syncResult.success,
      error: syncResult.error,
      timestamp: new Date().toISOString(),
      fallbackUsed: !syncResult.success
    });

  } catch (error) {
    console.error('Memory sync endpoint error:', error);
    
    // Return user-friendly Georgian error message
    res.json({ 
      success: false,
      error: 'მეხსიერების სინქრონიზაციაში შეცდომა',
      details: error.message,
      timestamp: new Date().toISOString(),
      fallbackUsed: true,
      message: 'სინქრონიზაცია ვერ მოხერხდა, გთხოვთ სცადოთ მოგვიანებით'
    });
  }
});

module.exports = router;
