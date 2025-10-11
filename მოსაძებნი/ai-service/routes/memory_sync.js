const express = require('express');
const { syncMemoryToFirebase, periodicSyncCheck } = require('../services/memory_controller');
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
      // First, try to sync local memory data
      const memorySyncService = require('../services/memory_sync_service');
      
      // Check if there's pending sync data
      const syncStats = memorySyncService.getSyncStats();
      console.log('📊 Current sync queue status:', syncStats);
      
      // Force process sync queue
      await memorySyncService.processSyncQueue();
      
      // Attempt periodic sync check
      console.log('🔍 Attempting periodic sync check...');
      const checkResult = await periodicSyncCheck(personalId);
      if (checkResult && checkResult.success) {
        console.log('✅ Periodic sync successful');
        return res.json({
          success: true,
          message: 'Firebase სინქრონიზაცია წარმატებით დასრულდა',
          synced: true,
          timestamp: new Date().toISOString(),
          queueProcessed: true
        });
      }
    } catch (checkError) {
      console.warn('⚠️ Periodic sync check failed:', checkError.message);
    }

    try {
      // If periodic check fails, try direct sync
      console.log('🔄 Attempting direct sync to Firebase...');
      syncResult = await syncMemoryToFirebase(personalId);
      console.log('✅ Direct sync completed:', syncResult.success);
    } catch (syncError) {
      console.error('❌ Direct sync failed:', syncError.message);
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