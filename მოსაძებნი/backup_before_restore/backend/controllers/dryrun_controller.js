
const fs = require('fs');
const path = require('path');
const { createPatch } = require('diff');

class DryRunController {
  
  // Preview what changes would be made without applying them
  static async previewChanges(req, res) {
    try {
      const { filePath, newContent } = req.body;

      if (!filePath || !newContent) {
        return res.status(400).json({
          success: false,
          error: 'filePath და newContent სავალდებულოა'
        });
      }

      const fullPath = path.join(process.cwd(), filePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.json({
          success: true,
          isNewFile: true,
          preview: {
            type: 'new_file',
            filePath,
            content: newContent,
            lines: newContent.split('\n').length
          }
        });
      }

      // Read current content
      const currentContent = fs.readFileSync(fullPath, 'utf8');

      // Generate diff
      const diffPatch = createPatch(
        filePath,
        currentContent,
        newContent,
        'მიმდინარე ვერსია',
        'ახალი ვერსია'
      );

      // Parse diff for better UI display
      const diffLines = diffPatch.split('\n').slice(4); // Skip header lines
      const changes = {
        additions: 0,
        deletions: 0,
        modifications: 0
      };

      diffLines.forEach(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) changes.additions++;
        if (line.startsWith('-') && !line.startsWith('---')) changes.deletions++;
      });

      changes.modifications = Math.min(changes.additions, changes.deletions);

      res.json({
        success: true,
        isNewFile: false,
        preview: {
          type: 'modification',
          filePath,
          diff: diffPatch,
          diffLines,
          changes,
          currentLines: currentContent.split('\n').length,
          newLines: newContent.split('\n').length
        }
      });

    } catch (error) {
      console.error('🔍 Dry Run Error:', error);
      res.status(500).json({
        success: false,
        error: 'მშრალი გაშვების შეცდომა',
        details: error.message
      });
    }
  }

  // Get file structure for safe modification checks
  static async getFileInfo(req, res) {
    try {
      const { filePath } = req.params;
      const fullPath = path.join(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({
          success: false,
          error: 'ფაილი არ მოიძებნა'
        });
      }

      const stats = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf8');

      res.json({
        success: true,
        fileInfo: {
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          lines: content.split('\n').length,
          exists: true
        }
      });

    } catch (error) {
      console.error('📁 File Info Error:', error);
      res.status(500).json({
        success: false,
        error: 'ფაილის ინფორმაციის წაკითხვის შეცდომა'
      });
    }
  }
}

module.exports = DryRunController;
