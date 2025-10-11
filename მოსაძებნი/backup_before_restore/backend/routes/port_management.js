const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const router = express.Router();

const execAsync = util.promisify(exec);

// Firebase connection diagnostic
router.get('/firebase-diagnostic', async (req, res) => {
  try {
    const FirebaseChecker = require('../../ai-service/services/firebase_connection_checker');
    const diagnostic = await FirebaseChecker.checkConnection();

    res.json({
      success: true,
      diagnostic,
      recommendations: diagnostic.recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      diagnostic: 'Failed to run Firebase diagnostic'
    });
  }
});

// 🔍 Check port status
router.get('/port-check/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port);

    // Check if port is in use using lsof
    const { stdout, stderr } = await execAsync(`lsof -ti:${port}`);

    if (stdout.trim()) {
      const pid = stdout.trim().split('\n')[0];

      // Get process details
      try {
        const { stdout: psOut } = await execAsync(`ps -p ${pid} -o comm=`);
        const processName = psOut.trim();

        res.json({
          port,
          status: 'in_use',
          pid: parseInt(pid),
          service: processName
        });
      } catch (psError) {
        res.json({
          port,
          status: 'in_use',
          pid: parseInt(pid),
          service: 'unknown'
        });
      }
    } else {
      res.json({
        port,
        status: 'available'
      });
    }
  } catch (error) {
    // If lsof fails, port is likely available
    res.json({
      port: parseInt(req.params.port),
      status: 'available'
    });
  }
});

// 🔧 Kill process on port
router.post('/port-kill/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port);

    console.log(`🔧 [PORT MANAGER] Killing processes on port ${port}`);

    // Graceful kill first
    await execAsync(`kill -TERM $(lsof -ti:${port}) 2>/dev/null || true`);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Force kill if still running
    await execAsync(`kill -9 $(lsof -ti:${port}) 2>/dev/null || true`);

    console.log(`✅ [PORT MANAGER] Port ${port} cleaned successfully`);

    res.json({
      success: true,
      message: `Port ${port} cleaned successfully`,
      port
    });

  } catch (error) {
    console.error(`❌ [PORT MANAGER] Error killing port ${req.params.port}:`, error);

    res.status(500).json({
      success: false,
      message: `Failed to kill processes on port ${req.params.port}`,
      error: error.message
    });
  }
});

// 🧹 Clean all common development ports
router.post('/port-cleanup', async (req, res) => {
  try {
    const devPorts = [3000, 5000, 5001, 5002, 8000, 8080];
    const results = [];

    console.log('🧹 [PORT MANAGER] გურულო Port Cleanup დაიწყო...');

    for (const port of devPorts) {
      try {
        // First try graceful termination
        await execAsync(`kill -TERM $(lsof -ti:${port}) 2>/dev/null || true`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Then force kill if needed
        await execAsync(`kill -9 $(lsof -ti:${port}) 2>/dev/null || true`);

        results.push({ port, status: 'cleaned' });
        console.log(`✅ [PORT MANAGER] Port ${port} გაწმენდა წარმატებით`);
      } catch (error) {
        results.push({ port, status: 'error', error: error.message });
        console.log(`⚠️ [PORT MANAGER] Port ${port} cleanup შეფერხება:`, error.message);
      }
    }

    // Wait a bit then restart services
    setTimeout(() => {
      console.log('🚀 [PORT MANAGER] Services restart ინიციირება...');
      // Trigger service restart
      const { exec } = require('child_process');
      exec('npm run dev', { cwd: '/home/runner/workspace' });
    }, 3000);

    res.json({
      success: true,
      message: 'გურულო Port cleanup დასრულებული - services იქმება restart',
      results
    });

  } catch (error) {
    console.error('❌ [PORT MANAGER] გენერალი cleanup შეცდომა:', error);

    res.status(500).json({
      success: false,
      message: 'Port cleanup ვერ მოხერხდა',
      error: error.message
    });
  }
});

router.post('/cleanup-dev-ports', async (req, res) => {
  try {
    const devPorts = [3000, 5000, 5001, 5002, 8000, 8080];
    const results = [];

    console.log('🧹 [PORT MANAGER] Cleaning all development ports...');

    for (const port of devPorts) {
      try {
        await execAsync(`kill -9 $(lsof -ti:${port}) 2>/dev/null || true`);
        results.push({ port, status: 'cleaned' });
        console.log(`✅ [PORT MANAGER] Port ${port} cleaned`);
      } catch (error) {
        results.push({ port, status: 'error', error: error.message });
        console.log(`⚠️ [PORT MANAGER] Port ${port} cleanup failed:`, error.message);
      }
    }

    res.json({
      success: true,
      message: 'Development ports cleanup completed',
      results
    });

  } catch (error) {
    console.error('❌ [PORT MANAGER] Cleanup failed:', error);

    res.status(500).json({
      success: false,
      message: 'Port cleanup failed',
      error: error.message
    });
  }
});

module.exports = router;