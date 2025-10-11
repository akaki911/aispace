#!/usr/bin/env node

const path = require('path');
const { config } = require('dotenv');

const repoRoot = path.join(__dirname, '..');
config({ path: path.join(repoRoot, '.env') });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = '0';

const fetch = global.fetch || require('node-fetch');

async function waitForServer(server) {
  if (!server) {
    throw new Error('Server instance not available');
  }

  if (server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

async function closeServer(server) {
  if (!server || typeof server.close !== 'function') {
    return;
  }

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function main() {
  const token = process.env.CI_SECRETS_CHECK_TOKEN;
  if (!token) {
    console.error('❌ CI required secrets check aborted: CI_SECRETS_CHECK_TOKEN is not configured.');
    return 4;
  }

  let server;

  try {
    const app = require('../backend/index.js');
    server = app.server || (typeof app.listen === 'function' ? app.listen(0) : null);

    if (!server) {
      console.error('❌ Backend server did not expose a server instance for secrets check.');
      return 2;
    }

    await waitForServer(server);

    const address = server.address();
    const port =
      (address && typeof address === 'object' ? address.port : null) ||
      Number(process.env.PORT) ||
      5002;

    const endpoint = `http://127.0.0.1:${port}/api/admin/secrets/required`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CI-Secrets-Token': token,
        'X-Audit-Actor-Id': 'ci-required-check',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Required secrets endpoint returned HTTP ${response.status}`);
      if (text) {
        console.error(text);
      }
      return 1;
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      console.error('❌ Invalid JSON payload returned by /api/admin/secrets/required.');
      return 3;
    }

    const required = payload?.data;
    if (!required || !Array.isArray(required.items)) {
      console.error('❌ Invalid payload structure from /api/admin/secrets/required.');
      return 3;
    }

    const missing = required.items.filter((item) => item.status === 'missing');
    if (missing.length > 0) {
      console.error('❌ Required secrets check failed. Missing entries detected:');
      missing.forEach((item) => {
        console.error(`  - ${item.key} (app: ${item.app})`);
      });
      return 1;
    }

    console.log('✅ All required secrets are present according to /api/admin/secrets/required.');
    return 0;
  } catch (error) {
    console.error('❌ Unable to evaluate required secrets:', error.message);
    return 3;
  } finally {
    await closeServer(server);
  }
}

main().then((code) => {
  const exitCode = Number.isInteger(code) ? code : 1;
  process.exit(exitCode);
});
