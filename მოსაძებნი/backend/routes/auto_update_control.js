
const express = require('express');
const router = express.Router();
const { adminSetupGuard } = require('../middleware/admin_guards');

// Create requireSuperAdmin middleware function
const requireSuperAdmin = (req, res, next) => {
  // Check if user is SUPER_ADMIN
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  
  // Fallback to admin setup guard
  return adminSetupGuard(req, res, next);
};
const fs = require('fs').promises;
const path = require('path');

// Auto-update configuration file path
const CONFIG_FILE = path.join(__dirname, '../data/auto_update_config.json');
const PROPOSALS_FILE = path.join(__dirname, '../data/auto_update_proposals.json');
const USAGE_STATS_FILE = path.join(__dirname, '../data/auto_update_usage.json');

// Default configuration
const DEFAULT_CONFIG = {
  masterSwitch: 'off',
  scopes: {
    guruloCore: false,
    frontendUI: false,
    adminPanel: false,
    backend: false,
    aiService: false
  },
  limits: {
    maxChangesPerDay: 5,
    maxFilesPerCycle: 3,
    timeWindow: {
      start: '02:00',
      end: '06:00'
    }
  },
  guards: {
    highRiskProposalOnly: true,
    configSecretMigrationBlock: true
  }
};

// Helper functions
async function ensureFile(filePath, defaultContent) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
  }
}

async function readJsonFile(filePath, defaultContent) {
  try {
    await ensureFile(filePath, defaultContent);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return defaultContent;
  }
}

async function writeJsonFile(filePath, content) {
  try {
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Get current configuration
router.get('/config', async (req, res) => {
  try {
    const config = await readJsonFile(CONFIG_FILE, { config: DEFAULT_CONFIG });
    
    console.log('🔧 [AUTO-UPDATE] Configuration requested');
    
    res.json({
      success: true,
      config: config.config || DEFAULT_CONFIG
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error getting config:', error);
    res.status(500).json({
      success: false,
      error: 'კონფიგურაციის წაკითხვის შეცდომა'
    });
  }
});

// Update configuration (Super Admin only)
router.post('/config', requireSuperAdmin, async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'კონფიგურაცია არ არის მითითებული'
      });
    }

    // Validate configuration structure
    const requiredFields = ['masterSwitch', 'scopes', 'limits', 'guards'];
    for (const field of requiredFields) {
      if (!(field in config)) {
        return res.status(400).json({
          success: false,
          error: `არასწორი კონფიგურაცია: ${field} ველი აკლია`
        });
      }
    }

    // Validate master switch
    const validSwitchValues = ['off', 'propose-only', 'auto-apply-low-risk'];
    if (!validSwitchValues.includes(config.masterSwitch)) {
      return res.status(400).json({
        success: false,
        error: 'არასწორი master switch მნიშვნელობა'
      });
    }

    // Validate limits
    if (config.limits.maxChangesPerDay < 1 || config.limits.maxChangesPerDay > 20) {
      return res.status(400).json({
        success: false,
        error: 'დღიური ცვლილებების ლიმიტი უნდა იყოს 1-20 შორის'
      });
    }

    if (config.limits.maxFilesPerCycle < 1 || config.limits.maxFilesPerCycle > 10) {
      return res.status(400).json({
        success: false,
        error: 'ციკლის ფაილების ლიმიტი უნდა იყოს 1-10 შორის'
      });
    }

    // Save configuration with timestamp
    const configData = {
      config,
      lastUpdated: new Date().toISOString(),
      updatedBy: req.user?.id || 'unknown'
    };

    const success = await writeJsonFile(CONFIG_FILE, configData);
    
    if (success) {
      console.log('✅ [AUTO-UPDATE] Configuration updated:', {
        masterSwitch: config.masterSwitch,
        scopes: Object.keys(config.scopes).filter(key => config.scopes[key]),
        updatedBy: req.user?.id
      });
      
      res.json({
        success: true,
        message: 'კონფიგურაცია წარმატებით შენახულია'
      });
    } else {
      throw new Error('Failed to write config file');
    }
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error saving config:', error);
    res.status(500).json({
      success: false,
      error: 'კონფიგურაციის შენახვის შეცდომა'
    });
  }
});

// Get proposals
router.get('/proposals', async (req, res) => {
  try {
    const proposalsData = await readJsonFile(PROPOSALS_FILE, { proposals: [] });
    
    // Sort proposals by timestamp (newest first)
    const proposals = (proposalsData.proposals || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json({
      success: true,
      proposals
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error getting proposals:', error);
    res.status(500).json({
      success: false,
      error: 'წინადადებების წაკითხვის შეცდომა'
    });
  }
});

// Create new proposal (Internal API for AI systems)
router.post('/proposals', async (req, res) => {
  try {
    const { scope, riskLevel, title, description, filesAffected } = req.body;
    
    if (!scope || !riskLevel || !title || !description) {
      return res.status(400).json({
        success: false,
        error: 'სავალდებულო ველები აკლია'
      });
    }

    // Load current configuration to check if scope is enabled
    const configData = await readJsonFile(CONFIG_FILE, { config: DEFAULT_CONFIG });
    const config = configData.config || DEFAULT_CONFIG;

    // Check if auto-updates are enabled
    if (config.masterSwitch === 'off') {
      return res.status(400).json({
        success: false,
        error: 'ავტო-განახლებები გამორთულია'
      });
    }

    // Check if scope is enabled
    if (!config.scopes[scope]) {
      return res.status(400).json({
        success: false,
        error: `სკოპი ${scope} გამორთულია`
      });
    }

    // Load current proposals and usage stats
    const proposalsData = await readJsonFile(PROPOSALS_FILE, { proposals: [] });
    const usageData = await readJsonFile(USAGE_STATS_FILE, { 
      todayChanges: 0, 
      lastResetDate: new Date().toDateString(),
      dailyHistory: []
    });

    // Check daily limits
    const today = new Date().toDateString();
    if (usageData.lastResetDate !== today) {
      usageData.todayChanges = 0;
      usageData.lastResetDate = today;
    }

    if (usageData.todayChanges >= config.limits.maxChangesPerDay) {
      return res.status(400).json({
        success: false,
        error: 'დღიური ლიმიტი ამოწურულია'
      });
    }

    // Check file count limit
    const filesCount = Array.isArray(filesAffected) ? filesAffected.length : 0;
    if (filesCount > config.limits.maxFilesPerCycle) {
      return res.status(400).json({
        success: false,
        error: `ძალიან ბევრი ფაილი (${filesCount}/${config.limits.maxFilesPerCycle})`
      });
    }

    // Check time window
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const inTimeWindow = currentTime >= config.limits.timeWindow.start && currentTime <= config.limits.timeWindow.end;
    
    if (!inTimeWindow && config.masterSwitch === 'auto-apply-low-risk') {
      return res.status(400).json({
        success: false,
        error: 'ავტო-გამოყენება შესაძლებელია მხოლოდ მითითებულ დროის ფანჯარაში'
      });
    }

    // Apply guards
    const isHighRisk = ['high', 'critical'].includes(riskLevel);
    const isConfigOrSecret = title.toLowerCase().includes('config') || 
                           title.toLowerCase().includes('secret') || 
                           title.toLowerCase().includes('migration');

    let status = 'pending';
    let autoApplied = false;

    // Auto-apply logic for low-risk changes
    if (config.masterSwitch === 'auto-apply-low-risk' && 
        riskLevel === 'low' && 
        !isHighRisk && 
        !isConfigOrSecret && 
        inTimeWindow) {
      status = 'auto-applied';
      autoApplied = true;
      usageData.todayChanges++;
    } else if (isHighRisk && config.guards.highRiskProposalOnly) {
      status = 'pending';
    } else if (isConfigOrSecret && config.guards.configSecretMigrationBlock) {
      status = 'pending';
    }

    // Create proposal
    const proposal = {
      id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scope,
      riskLevel,
      title,
      description,
      filesAffected: filesAffected || [],
      timestamp: new Date().toISOString(),
      status,
      autoApplied
    };

    // Save proposal
    proposalsData.proposals = proposalsData.proposals || [];
    proposalsData.proposals.push(proposal);
    await writeJsonFile(PROPOSALS_FILE, proposalsData);

    // Update usage stats
    await writeJsonFile(USAGE_STATS_FILE, usageData);

    console.log(`📋 [AUTO-UPDATE] New proposal created:`, {
      id: proposal.id,
      scope,
      riskLevel,
      status,
      autoApplied
    });

    res.json({
      success: true,
      proposal,
      autoApplied
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error creating proposal:', error);
    res.status(500).json({
      success: false,
      error: 'წინადადების შექმნის შეცდომა'
    });
  }
});

// Approve proposal (Super Admin only)  
router.post('/proposals/:proposalId/approve', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    
    const proposalsData = await readJsonFile(PROPOSALS_FILE, { proposals: [] });
    const proposalIndex = proposalsData.proposals.findIndex(p => p.id === proposalId);
    
    if (proposalIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'წინადადება ვერ მოიძებნა'
      });
    }

    const proposal = proposalsData.proposals[proposalIndex];
    
    if (proposal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'წინადადება უკვე დამუშავებულია'
      });
    }

    // Update proposal status
    proposalsData.proposals[proposalIndex] = {
      ...proposal,
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: req.user?.id || 'unknown'
    };

    await writeJsonFile(PROPOSALS_FILE, proposalsData);

    console.log(`✅ [AUTO-UPDATE] Proposal approved:`, {
      id: proposalId,
      scope: proposal.scope,
      approvedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'წინადადება დამტკიცდა'
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error approving proposal:', error);
    res.status(500).json({
      success: false,
      error: 'წინადადების დამტკიცების შეცდომა'
    });
  }
});

// Reject proposal (Super Admin only)
router.post('/proposals/:proposalId/reject', requireSuperAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { reason } = req.body;
    
    const proposalsData = await readJsonFile(PROPOSALS_FILE, { proposals: [] });
    const proposalIndex = proposalsData.proposals.findIndex(p => p.id === proposalId);
    
    if (proposalIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'წინადადება ვერ მოიძებნა'
      });
    }

    const proposal = proposalsData.proposals[proposalIndex];
    
    if (proposal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'წინადადება უკვე დამუშავებულია'
      });
    }

    // Update proposal status
    proposalsData.proposals[proposalIndex] = {
      ...proposal,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user?.id || 'unknown',
      rejectionReason: reason || 'უარყოფილია ადმინისტრატორის მიერ'
    };

    await writeJsonFile(PROPOSALS_FILE, proposalsData);

    console.log(`❌ [AUTO-UPDATE] Proposal rejected:`, {
      id: proposalId,
      scope: proposal.scope,
      rejectedBy: req.user?.id,
      reason
    });

    res.json({
      success: true,
      message: 'წინადადება უარყვილია'
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error rejecting proposal:', error);
    res.status(500).json({
      success: false,
      error: 'წინადადების უარყოფის შეცდომა'
    });
  }
});

// Get usage statistics
router.get('/stats', async (req, res) => {
  try {
    const usageData = await readJsonFile(USAGE_STATS_FILE, { 
      todayChanges: 0, 
      lastResetDate: new Date().toDateString(),
      dailyHistory: []
    });

    // Reset daily counter if needed
    const today = new Date().toDateString();
    if (usageData.lastResetDate !== today) {
      usageData.todayChanges = 0;
      usageData.lastResetDate = today;
      await writeJsonFile(USAGE_STATS_FILE, usageData);
    }

    res.json({
      success: true,
      stats: {
        todayChanges: usageData.todayChanges,
        currentCycleFiles: 0, // This would be calculated from active operations
        lastUpdate: usageData.lastUpdate || null
      }
    });
  } catch (error) {
    console.error('❌ [AUTO-UPDATE] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'სტატისტიკის წაკითხვის შეცდომა'
    });
  }
});

module.exports = router;
