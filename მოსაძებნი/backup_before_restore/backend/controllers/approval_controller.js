
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const db = getFirestore();
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

  // Approve change
  static async approveChange(req, res) {
    try {
      const { changeId } = req.params;
      const { userId } = req.body;

      // Only super admin can approve
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'მხოლოდ სუპერ ადმინს შეუძლია ცვლილების დამტკიცება'
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
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: userId
      });

      res.json({
        success: true,
        message: '✅ ცვლილება დამტკიცდა და გამოიყენება',
        filePath
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
}

module.exports = ApprovalController;
