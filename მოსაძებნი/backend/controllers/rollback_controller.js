
const fs = require('fs');
const path = require('path');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

class RollbackController {

  // Get available backups for a file
  static async getFileBackups(req, res) {
    try {
      const { filePath } = req.params;
      const fullPath = path.join(process.cwd(), filePath);
      const dir = path.dirname(fullPath);
      const fileName = path.basename(fullPath);

      if (!fs.existsSync(dir)) {
        return res.json({
          success: true,
          backups: []
        });
      }

      // Find all backup files
      const files = fs.readdirSync(dir);
      const backups = files
        .filter(file => file.startsWith(`${fileName}.bak`))
        .map(backupFile => {
          const backupPath = path.join(dir, backupFile);
          const stats = fs.statSync(backupPath);
          
          // Extract timestamp from filename if available
          const timestampMatch = backupFile.match(/\.bak\.(\d+)$/);
          const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : stats.mtime.getTime();

          return {
            fileName: backupFile,
            fullPath: path.join(filePath, '..', backupFile),
            created: new Date(timestamp).toISOString(),
            size: stats.size,
            timestamp
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // Newest first

      res.json({
        success: true,
        filePath,
        backups,
        count: backups.length
      });

    } catch (error) {
      console.error('📁 Get Backups Error:', error);
      res.status(500).json({
        success: false,
        error: 'სარეზერვო ფაილების სიის მიღების შეცდომა'
      });
    }
  }

  // Rollback file to previous version
  static async rollbackFile(req, res) {
    try {
      const { filePath } = req.params;
      const { backupFileName, userId } = req.body;

      // Only super admin can rollback
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'მხოლოდ სუპერ ადმინს შეუძლია ფაილის აღდგენა'
        });
      }

      const fullPath = path.join(process.cwd(), filePath);
      const backupPath = path.join(path.dirname(fullPath), backupFileName);

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({
          success: false,
          error: 'სარეზერვო ფაილი არ მოიძებნა'
        });
      }

      // Create backup of current file before rollback
      if (fs.existsSync(fullPath)) {
        const rollbackBackupPath = `${fullPath}.bak.before_rollback.${Date.now()}`;
        fs.copyFileSync(fullPath, rollbackBackupPath);
      }

      // Restore from backup
      fs.copyFileSync(backupPath, fullPath);

      // Log rollback action
      await db.collection('rollback_history').add({
        filePath,
        backupFileName,
        userId,
        rolledBackAt: new Date().toISOString(),
        timestamp: Date.now()
      });

      res.json({
        success: true,
        message: `✅ ფაილი ${filePath} აღდგენილია სარეზერვო ვერსიიდან`,
        restoredFrom: backupFileName
      });

    } catch (error) {
      console.error('🔄 Rollback Error:', error);
      res.status(500).json({
        success: false,
        error: 'ფაილის აღდგენის შეცდომა'
      });
    }
  }

  // Get rollback history
  static async getRollbackHistory(req, res) {
    try {
      const { userId } = req.query;

      // Only super admin can view history
      if (userId !== '01019062020') {
        return res.status(403).json({
          success: false,
          error: 'წვდომა აკრძალულია'
        });
      }

      const snapshot = await db.collection('rollback_history')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      const history = [];
      snapshot.forEach(doc => {
        history.push({
          id: doc.id,
          ...doc.data()
        });
      });

      res.json({
        success: true,
        history,
        count: history.length
      });

    } catch (error) {
      console.error('📜 Rollback History Error:', error);
      res.status(500).json({
        success: false,
        error: 'აღდგენის ისტორიის წაკითხვის შეცდომა'
      });
    }
  }
}

module.exports = RollbackController;
