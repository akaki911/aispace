
const fs = require('fs').promises;
const path = require('path');

class MemoryRecovery {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../..');
  }

  async recoverContextActions(userId) {
    console.log(`🔧 Starting contextActions recovery for user: ${userId}`);
    
    const aiServicePath = path.join(this.projectRoot, 'ai-service/memory_data', `${userId}.json`);
    const backendPath = path.join(this.projectRoot, 'backend/memory_data', `${userId}.json`);
    
    try {
      // Read AI service memory
      const aiMemory = JSON.parse(await fs.readFile(aiServicePath, 'utf8'));
      
      // Fix corrupted contextActions
      if (aiMemory.contextActions) {
        aiMemory.contextActions = aiMemory.contextActions.map(action => {
          return {
            id: action.id || Date.now().toString(),
            action: action.action || 'უცნობი ქმედება',
            description: this.reconstructDescription(action.description),
            timestamp: action.timestamp || new Date().toISOString(),
            category: action.category || 'general',
            priority: action.priority || 'medium',
            status: action.status || 'pending'
          };
        });
      }
      
      // Write corrected data back
      await fs.writeFile(aiServicePath, JSON.stringify(aiMemory, null, 2));
      console.log(`✅ AI service memory corrected for user: ${userId}`);
      
      // Sync to backend
      try {
        const backendMemory = JSON.parse(await fs.readFile(backendPath, 'utf8'));
        backendMemory.contextActions = aiMemory.contextActions;
        await fs.writeFile(backendPath, JSON.stringify(backendMemory, null, 2));
        console.log(`✅ Backend memory synced for user: ${userId}`);
      } catch (backendError) {
        console.warn(`⚠️ Backend sync failed: ${backendError.message}`);
      }
      
      return { success: true, recovered: aiMemory.contextActions.length };
    } catch (error) {
      console.error(`❌ Memory recovery failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  reconstructDescription(originalDescription) {
    if (!originalDescription) return 'აღსადგენი აღწერა';
    
    // Handle truncated descriptions
    const truncatedMap = {
      'რეალურ': 'რეალური დროის მონიტორინგი და სისტემის ანალიზი',
      'სისტ': 'სისტემის მონიტორინგი და კონტროლი',
      'შეცდ': 'შეცდომის გამოვლენა და მოგვარება',
      'ფაილ': 'ფაილის მუშაობა და მენეჯმენტი'
    };
    
    for (const [key, value] of Object.entries(truncatedMap)) {
      if (originalDescription.startsWith(key)) {
        return value;
      }
    }
    
    return originalDescription.length < 10 ? 
      `${originalDescription} - გაფართოებული აღწერა` : 
      originalDescription;
  }
}

module.exports = new MemoryRecovery();
