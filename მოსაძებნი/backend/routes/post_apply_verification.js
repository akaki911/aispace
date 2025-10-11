
const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
// Dynamic import for node-fetch v3+ ES module compatibility
let fetch;
(async () => {
  try {
    const { default: nodeFetch } = await import('node-fetch');
    fetch = nodeFetch;
  } catch (err) {
    console.warn('⚠️ node-fetch not available, fetch calls will fail:', err.message);
  }
})();

// POST /api/ai/autoimprove/post-apply/verify
router.post('/verify', async (req, res) => {
  const { proposalId } = req.body;
  
  console.log(`🔍 [POST-APPLY] Starting verification for proposal: ${proposalId}`);
  
  try {
    const verificationId = `verify_${Date.now()}`;
    
    // Start verification process (async)
    performVerification(verificationId, proposalId).catch(err => {
      console.error(`❌ [POST-APPLY] Verification failed for ${proposalId}:`, err);
    });
    
    res.json({
      success: true,
      verificationId,
      status: 'started',
      message: 'Post-apply verification started',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [POST-APPLY] Verification start failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start verification',
      details: error.message
    });
  }
});

// GET /api/ai/autoimprove/post-apply/status/:verificationId
router.get('/status/:verificationId', async (req, res) => {
  const { verificationId } = req.params;
  
  try {
    // In production, this would read from a database/cache
    // For now, we'll use mock data structure
    const status = getVerificationStatus(verificationId);
    
    res.json({
      success: true,
      verificationId,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [POST-APPLY] Status check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification status',
      details: error.message
    });
  }
});

// In-memory storage for verification results (in production use Redis/Database)
const verificationResults = new Map();

async function performVerification(verificationId, proposalId) {
  const startTime = Date.now();
  
  // Initialize status
  verificationResults.set(verificationId, {
    status: 'running',
    progress: 0,
    totalChecks: 6,
    completedChecks: 0,
    results: {
      healthChecks: { status: 'pending', details: {} },
      smokeRoutes: { status: 'pending', details: {} },
      typeScriptCheck: { status: 'pending', details: {} },
      eslintCheck: { status: 'pending', details: {} },
      buildCheck: { status: 'pending', details: {} },
      frontendPing: { status: 'pending', details: {} }
    },
    overallStatus: 'running',
    startTime,
    duration: 0
  });

  try {
    // 1. Health Checks
    console.log('🔍 [POST-APPLY] Running health checks...');
    await updateProgress(verificationId, 'healthChecks', await runHealthChecks());

    // 2. Smoke Routes
    console.log('🔍 [POST-APPLY] Testing smoke routes...');
    await updateProgress(verificationId, 'smokeRoutes', await runSmokeRoutes());

    // 3. TypeScript Check
    console.log('🔍 [POST-APPLY] Running TypeScript check...');
    await updateProgress(verificationId, 'typeScriptCheck', await runTypeScriptCheck());

    // 4. ESLint Check
    console.log('🔍 [POST-APPLY] Running ESLint check...');
    await updateProgress(verificationId, 'eslintCheck', await runESLintCheck());

    // 5. Build Check
    console.log('🔍 [POST-APPLY] Running build check...');
    await updateProgress(verificationId, 'buildCheck', await runBuildCheck());

    // 6. Frontend Ping
    console.log('🔍 [POST-APPLY] Testing frontend...');
    await updateProgress(verificationId, 'frontendPing', await runFrontendPing());

    // Finalize results
    const results = verificationResults.get(verificationId);
    const allPassed = Object.values(results.results).every(r => r.status === 'pass');
    
    results.overallStatus = allPassed ? 'success' : 'failed';
    results.status = 'completed';
    results.duration = Date.now() - startTime;
    
    console.log(`✅ [POST-APPLY] Verification completed: ${results.overallStatus}`);
    
  } catch (error) {
    console.error('❌ [POST-APPLY] Verification error:', error);
    const results = verificationResults.get(verificationId);
    results.overallStatus = 'error';
    results.status = 'error';
    results.error = error.message;
    results.duration = Date.now() - startTime;
  }
}

async function updateProgress(verificationId, checkName, result) {
  const results = verificationResults.get(verificationId);
  results.results[checkName] = result;
  results.completedChecks++;
  results.progress = Math.round((results.completedChecks / results.totalChecks) * 100);
}

function getVerificationStatus(verificationId) {
  return verificationResults.get(verificationId) || {
    status: 'not_found',
    error: 'Verification not found'
  };
}

// Individual check implementations
async function runHealthChecks() {
  const checks = {
    backend: { url: 'http://127.0.0.1:5002/api/health', status: 'unknown' },
    aiService: { url: 'http://127.0.0.1:5001/health', status: 'unknown' }
  };

  for (const [service, check] of Object.entries(checks)) {
    try {
      const response = await fetch(check.url, { timeout: 5000 });
      check.status = response.ok ? 'healthy' : 'unhealthy';
      check.statusCode = response.status;
    } catch (error) {
      check.status = 'unreachable';
      check.error = error.message;
    }
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  
  return {
    status: allHealthy ? 'pass' : 'fail',
    details: checks,
    message: allHealthy ? 'All services healthy' : 'Some services unhealthy'
  };
}

async function runSmokeRoutes() {
  const routes = [
    { name: 'AutoImprove Proposals', url: 'http://127.0.0.1:5002/api/ai/autoimprove/_debug/ping' },
    { name: 'Health Status', url: 'http://127.0.0.1:5002/api/health' },
    { name: 'AI Models', url: 'http://127.0.0.1:5002/api/ai/models' }
  ];

  const results = {};
  let passCount = 0;

  for (const route of routes) {
    try {
      const response = await fetch(route.url, { timeout: 5000 });
      const success = response.ok;
      results[route.name] = {
        status: success ? 'pass' : 'fail',
        statusCode: response.status,
        url: route.url
      };
      if (success) passCount++;
    } catch (error) {
      results[route.name] = {
        status: 'fail',
        error: error.message,
        url: route.url
      };
    }
  }

  return {
    status: passCount === routes.length ? 'pass' : 'fail',
    details: results,
    message: `${passCount}/${routes.length} routes passed`
  };
}

async function runTypeScriptCheck() {
  return new Promise((resolve) => {
    exec('npx tsc --noEmit', { timeout: 30000 }, (error, stdout, stderr) => {
      const success = !error;
      resolve({
        status: success ? 'pass' : 'fail',
        details: {
          stdout: stdout?.substring(0, 500) || '',
          stderr: stderr?.substring(0, 500) || '',
          exitCode: error?.code || 0
        },
        message: success ? 'TypeScript check passed' : 'TypeScript errors found'
      });
    });
  });
}

async function runESLintCheck() {
  return new Promise((resolve) => {
    exec('npx eslint . --max-warnings 0', { timeout: 30000 }, (error, stdout, stderr) => {
      const success = !error;
      resolve({
        status: success ? 'pass' : 'fail',
        details: {
          stdout: stdout?.substring(0, 500) || '',
          stderr: stderr?.substring(0, 500) || '',
          exitCode: error?.code || 0
        },
        message: success ? 'ESLint check passed' : 'ESLint errors found'
      });
    });
  });
}

async function runBuildCheck() {
  return new Promise((resolve) => {
    exec('npm run build', { timeout: 60000 }, (error, stdout, stderr) => {
      const success = !error;
      resolve({
        status: success ? 'pass' : 'fail',
        details: {
          stdout: stdout?.substring(0, 500) || '',
          stderr: stderr?.substring(0, 500) || '',
          exitCode: error?.code || 0
        },
        message: success ? 'Build completed successfully' : 'Build failed'
      });
    });
  });
}

async function runFrontendPing() {
  try {
    const response = await fetch('http://127.0.0.1:5000/', { timeout: 5000 });
    const success = response.ok;
    
    return {
      status: success ? 'pass' : 'fail',
      details: {
        statusCode: response.status,
        viteDevServer: success
      },
      message: success ? 'Frontend responding' : 'Frontend unreachable'
    };
  } catch (error) {
    return {
      status: 'fail',
      details: {
        error: error.message
      },
      message: 'Frontend ping failed'
    };
  }
}

module.exports = router;
