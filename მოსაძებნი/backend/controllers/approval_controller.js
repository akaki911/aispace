
const fs = require('fs');
const path = require('path');

// Safe Firebase initialization
let db = null;
let admin = null;

try {
  admin = require('../firebase');
  if (admin && admin.apps && admin.apps.length > 0) {
    const { getFirestore } = require('firebase-admin/firestore');
    db = getFirestore();
    console.log('✅ Firebase initialized in approval_controller');
  } else {
    console.warn('⚠️ Firebase not available in approval_controller - using fallback mode');
  }
} catch (error) {
  console.warn('⚠️ Firebase initialization failed in approval_controller:', error.message);
}

const PENDING_CHANGES_COLLECTION = 'pending_changes';

class ApprovalController {

  // Submit change for approval
  static async submitForApproval(req, res) {
    try {
      const { filePath, newContent, changeDescription, userId } = req.body;

      if (!filePath || !newContent || !userId) {
        return res.status(400).json({
          success: false,
          error: 'filePath, newContent და userId სავალდებულოა'
        });
      }

      // Check if Firebase is available
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firebase service არ არის ხელმისაწვდომი',
          details: 'Approval system requires Firebase connection'
        });
      }

      // Create pending change document
      const changeData = {
        filePath,
        newContent,
        changeDescription: changeDescription || 'AI Assistant-ის მიერ შემოთავაზებული ცვლილება',
        userId,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        submittedBy: 'AI_Assistant',
        timestamp: Date.now()
      };

      const docRef = await db.collection(PENDING_CHANGES_COLLECTION).add(changeData);

      res.json({
        success: true,
        changeId: docRef.id,
        message: '✅ ცვლილება გაიგზავნა დამტკიცებისთვის',
        pendingChangeId: docRef.id
      });

    } catch (error) {
      console.error('📝 Submit Approval Error:', error);
      res.status(500).json({
        success: false,
        error: 'დამტკიცების მოთხოვნის გაგზავნის შეცდომა'
      });
    }
  }

  // Get pending changes (for super admin)
  static async getPendingChanges(req, res) {
    try {
      const { userId } = req.query;

      // Only super admin can view pending changes
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'მხოლოდ სუპერ ადმინს შეუძლია დამტკიცების განყოფილების ნახვა'
        });
      }

      // Check if Firebase is available
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firebase service არ არის ხელმისაწვდომი',
          details: 'Cannot retrieve pending changes without Firebase'
        });
      }

      const snapshot = await db.collection(PENDING_CHANGES_COLLECTION)
        .where('status', '==', 'pending')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

      const pendingChanges = [];
      snapshot.forEach(doc => {
        pendingChanges.push({
          id: doc.id,
          ...doc.data()
        });
      });

      res.json({
        success: true,
        pendingChanges,
        count: pendingChanges.length
      });

    } catch (error) {
      console.error('📋 Get Pending Changes Error:', error);
      res.status(500).json({
        success: false,
        error: 'ცვლილებების სიის წაკითხვის შეცდომა'
      });
    }
  }

  // Approve change (only after successful dry-run)
  static async approveChange(req, res) {
    try {
      const { changeId } = req.params;
      const { userId, dryRunPassed } = req.body;

      // Only super admin can approve
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'მხოლოდ სუპერ ადმინს შეუძლია ცვლილების დამტკიცება'
        });
      }

      // Require successful dry-run before approval
      if (!dryRunPassed) {
        return res.status(400).json({
          success: false,
          error: 'დამტკიცება შესაძლებელია მხოლოდ წარმატებული Dry-Run-ის შემდეგ',
          requiresDryRun: true
        });
      }

      // Check if Firebase is available
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firebase service არ არის ხელმისაწვდომი',
          details: 'Cannot approve changes without Firebase'
        });
      }

      const changeRef = db.collection(PENDING_CHANGES_COLLECTION).doc(changeId);
      const changeDoc = await changeRef.get();

      if (!changeDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'ცვლილება არ მოიძებნა'
        });
      }

      const { filePath, newContent } = changeDoc.data();
      const fullPath = path.join(process.cwd(), filePath);

      // Create backup before applying changes
      if (fs.existsSync(fullPath)) {
        const backupPath = `${fullPath}.bak.${Date.now()}`;
        fs.copyFileSync(fullPath, backupPath);
        console.log(`📁 Backup created: ${backupPath}`);
      }

      // Apply the change
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, newContent, 'utf8');

      // Update status
      await changeRef.update({
        status: 'applied',
        approvedAt: new Date().toISOString(),
        approvedBy: userId,
        appliedAt: new Date().toISOString()
      });

      // Start service verification
      const verificationId = `verify_${Date.now()}`;
      setTimeout(async () => {
        await ApprovalController.performServiceVerification(changeId, verificationId);
      }, 1000);

      res.json({
        success: true,
        message: '✅ ცვლილება გამოყენებულია, სერვისის შემოწმება იწყება...',
        filePath,
        verificationId,
        needsVerification: true
      });

    } catch (error) {
      console.error('✅ Approve Change Error:', error);
      res.status(500).json({
        success: false,
        error: 'ცვლილების დამტკიცების შეცდომა'
      });
    }
  }

  // Reject change
  static async rejectChange(req, res) {
    try {
      const { changeId } = req.params;
      const { userId, reason } = req.body;

      // Only super admin can reject
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'მხოლოდ სუპერ ადმინს შეუძლია ცვლილების უარყოფა'
        });
      }

      // Check if Firebase is available
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Firebase service არ არის ხელმისაწვდომი',
          details: 'Cannot reject changes without Firebase'
        });
      }

      const changeRef = db.collection(PENDING_CHANGES_COLLECTION).doc(changeId);
      await changeRef.update({
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: userId,
        rejectionReason: reason || 'უარყვება ადმინისტრატორის მიერ'
      });

      res.json({
        success: true,
        message: '❌ ცვლილება უარყვილია'
      });

    } catch (error) {
      console.error('❌ Reject Change Error:', error);
      res.status(500).json({
        success: false,
        error: 'ცვლილების უარყოფის შეცდომა'
      });
    }
  }

  // Perform service health verification after apply
  static async performServiceVerification(changeId, verificationId) {
    const services = [
      { name: 'Backend', url: 'http://localhost:5002/api/health', port: 5002 },
      
      { name: 'Frontend', url: 'http://localhost:5000', port: 5000 }
    ];

    const results = [];
    
    for (const service of services) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(service.url, { timeout: 5000 });
        
        results.push({
          name: service.name,
          status: response.ok ? 'მუშაობს' : 'არ მუშაობს',
          statusCode: response.status,
          healthy: response.ok
        });
        
        console.log(`🏥 [VERIFY] ${service.name}: ${response.ok ? '✅ მუშაობს' : '❌ არ მუშაობს'}`);
      } catch (error) {
        results.push({
          name: service.name,
          status: 'არ მუშაობს',
          error: error.message,
          healthy: false
        });
        console.log(`🏥 [VERIFY] ${service.name}: ❌ კავშირის შეცდომა - ${error.message}`);
      }
    }

    // Store verification results (in real implementation, use cache/database)
    console.log(`🔍 [VERIFY] სერვისის შემოწმება დასრულებული:`, results);
    
    return results;
  }

  // Get service verification status
  static async getServiceVerification(req, res) {
    try {
      const { verificationId } = req.params;
      
      // Perform real-time health check
      const results = await ApprovalController.performServiceVerification(null, verificationId);
      
      const allHealthy = results.every(r => r.healthy);
      
      res.json({
        success: true,
        verificationId,
        services: results,
        overallStatus: allHealthy ? 'ყველა სერვისი მუშაობს' : 'ზოგიერთ სერვისში პრობლემაა',
        healthy: allHealthy,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('🏥 [VERIFY] სერვისის შემოწმების შეცდომა:', error);
      res.status(500).json({
        success: false,
        error: 'სერვისის შემოწმების შეცდომა'
      });
    }
  }

  // Get verification logs
  static async getVerificationLogs(req, res) {
    try {
      const { verificationId } = req.params;
      
      // Mock logs for demonstration
      const logs = [
        { time: new Date().toISOString(), level: 'info', message: 'სერვისის შემოწმება დაიწყო' },
        { time: new Date().toISOString(), level: 'success', message: 'Backend სერვისი მუშაობს' },
        { time: new Date().toISOString(), level: 'success', message: 'AI Service მუშაობს' },
        { time: new Date().toISOString(), level: 'success', message: 'Frontend მუშაობს' },
        { time: new Date().toISOString(), level: 'info', message: 'შემოწმება დასრულებული' }
      ];
      
      res.json({
        success: true,
        verificationId,
        logs,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'ლოგების ჩამოტვირთვის შეცდომა'
      });
    }
  }
}

module.exports = ApprovalController;
