
const fs = require('fs');
const path = require('path');
const { createPatch } = require('diff');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DryRunController {

  // Run comprehensive validation checklist
  static async runValidationChecklist(req, res) {
    try {
      const { filePath, newContent } = req.body;

      console.log('🔍 [DRY-RUN] დაწყებულია სრული ვალიდაციის checklist');

      const checklist = {
        typescript: { status: 'running', message: 'TypeScript კომპილაცია...' },
        eslint: { status: 'running', message: 'ESLint შემოწმება...' },
        build: { status: 'running', message: 'Build ტესტი...' },
        tests: { status: 'running', message: 'ტესტების გაშვება...' }
      };

      res.json({
        success: true,
        checklistId: `checklist_${Date.now()}`,
        checklist,
        message: 'ვალიდაციის checklist დაიწყო'
      });

      // Run validations in background
      setTimeout(async () => {
        await DryRunController.performValidations(filePath, newContent, checklist);
      }, 100);

    } catch (error) {
      console.error('❌ [DRY-RUN] Checklist შეცდომა:', error);
      res.status(500).json({
        success: false,
        error: 'ვალიდაციის checklist-ის შეცდომა',
        details: error.message
      });
    }
  }

  // Perform actual validations
  static async performValidations(filePath, newContent, checklist) {
    // TypeScript Check
    try {
      await execAsync('npx tsc --noEmit --skipLibCheck');
      checklist.typescript = { status: 'pass', message: '✅ TypeScript კომპილაცია წარმატებული' };
    } catch (error) {
      checklist.typescript = { status: 'fail', message: '❌ TypeScript შეცდომები', details: error.stdout };
    }

    // ESLint Check
    try {
      await execAsync('npx eslint src/ --ext .ts,.tsx,.js,.jsx --max-warnings 0');
      checklist.eslint = { status: 'pass', message: '✅ ESLint შემოწმება წარმატებული' };
    } catch (error) {
      checklist.eslint = { status: 'fail', message: '❌ ESLint შეცდომები', details: error.stdout };
    }

    // Build Test
    try {
      await execAsync('npm run build');
      checklist.build = { status: 'pass', message: '✅ Build წარმატებული' };
    } catch (error) {
      checklist.build = { status: 'fail', message: '❌ Build შეცდომა', details: error.stdout };
    }

    // Tests
    try {
      await execAsync('npm test -- --passWithNoTests');
      checklist.tests = { status: 'pass', message: '✅ ტესტები წარმატებული' };
    } catch (error) {
      checklist.tests = { status: 'fail', message: '❌ ტესტების შეცდომები', details: error.stdout };
    }

    console.log('🏁 [DRY-RUN] ვალიდაციის checklist დასრულდა:', checklist);
  }

  // Get checklist status
  static async getChecklistStatus(req, res) {
    try {
      const { checklistId } = req.params;
      
      // In real implementation, this would be stored in memory/cache
      res.json({
        success: true,
        checklistId,
        status: 'completed',
        message: 'ვალიდაციის checklist მზადაა'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'checklist-ის სტატუსის შეცდომა'
      });
    }
  }
  
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
