'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const net = require('net');
const { runGuruloChatSuite, resolveEndpointLabel, getLatencyLimit } = require('./test_front_gurulo_chat');

const MAX_ATTEMPTS = Number(process.env.CHAT_TEST_MAX_ATTEMPTS || 5);
const LOG_DIR = path.resolve(process.cwd(), 'logs', 'chat-tests');

const ENDPOINT_MATRIX = [
  {
    url: process.env.GURULO_CHAT_URL_PROXY || 'http://localhost:5002/api/ai/chat',
    mode: 'backend-proxy'
  },
  {
    url: process.env.GURULO_CHAT_URL_DIRECT || 'http://localhost:5001/api/ai/chat',
    mode: 'direct-ai'
  }
];

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

async function checkEndpoint(url) {
  let portOpen = false;
  const endpoint = new URL(url);
  const port = Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80));

  portOpen = await new Promise((resolve) => {
    const socket = net.connect({ host: endpoint.hostname, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });

  if (!portOpen) {
    return { available: false, reason: 'port-closed' };
  }

  try {
    const response = await axios.head(url, { timeout: 2000, validateStatus: () => true });
    if (response.status === 404) {
      return { available: false, reason: 'no route' };
    }
    return { available: true };
  } catch (error) {
    const status = error.response?.status;
    if (status === 404) {
      return { available: false, reason: 'no route' };
    }
    if (status === 405) {
      return { available: true };
    }
    const reason = error.code || error.message;
    return { available: false, reason };
  }
}

function formatMatrixRow({ endpoint, mode, scenario }) {
  return {
    endpoint,
    mode,
    scenario: scenario.label,
    status: scenario.success ? 'PASS' : 'FAIL',
    latencyMs: scenario.duration ?? '—',
    limitMs: scenario.latencyLimitMs ?? '—',
    queryType: scenario.queryType || 'unknown'
  };
}

function printMatrix(rows, attempt) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Attempt ${attempt} results`);
  console.table(rows);
}

function writeLog(attempt, endpointLabel, payload) {
  ensureLogDir();
  const filePath = path.join(LOG_DIR, `run-${attempt}-${endpointLabel}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

function summarizeFailure(stateEntries) {
  const diagnostics = [];
  for (const state of stateEntries) {
    if (state.success) continue;
    const lastAttempt = state.attempts[state.attempts.length - 1];
    if (!lastAttempt) continue;
    const { endpoint, mode, results } = lastAttempt;
    const averageLatency = computeAverageLatency(results);
    const failedScenario = (results || []).find((scenario) => !scenario.success);
    diagnostics.push({
      endpoint: endpoint || 'unknown-endpoint',
      mode,
      failedScenario: failedScenario?.label ?? 'unknown',
      failureStatus: failedScenario?.status ?? 'unknown',
      failureReason: failedScenario?.error || 'No error message',
      averageLatency,
      lastPreview: failedScenario?.responsePreview
    });
  }
  if (diagnostics.length) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚨 Diagnostics after max attempts');
    diagnostics.forEach((diag) => {
      const avgText = typeof diag.averageLatency === 'number' ? `${diag.averageLatency}ms` : String(diag.averageLatency);
      console.log(
        `✖ ${diag.endpoint} (${diag.mode}) — scenario "${diag.failedScenario}" failed (${diag.failureStatus}). Avg latency: ${avgText}. Reason: ${diag.failureReason}`
      );
      if (diag.lastPreview) {
        console.log(`   Preview: ${diag.lastPreview}`);
      }
    });
  }
}

function computeAverageLatency(results = []) {
  const measurements = results
    .filter((entry) => typeof entry.duration === 'number')
    .map((entry) => entry.duration);
  if (!measurements.length) return 'n/a';
  const sum = measurements.reduce((total, value) => total + value, 0);
  return Math.round(sum / measurements.length);
}

async function run() {
  ensureLogDir();
  const endpointStates = new Map();
  ENDPOINT_MATRIX.forEach(({ url, mode }) => {
    endpointStates.set(url, { mode, success: false, attempts: [] });
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const matrixRows = [];
    for (const { url, mode } of ENDPOINT_MATRIX) {
      const state = endpointStates.get(url);
      if (state.success) {
        continue;
      }

      const endpointLabel = resolveEndpointLabel(url);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Running front chat suite for ${endpointLabel} (${mode}) [attempt ${attempt}/${MAX_ATTEMPTS}]`);
      console.log(`📍 Endpoint: ${url}`);
      console.log(`⏱️ Latency limit: ${getLatencyLimit(url)}ms`);

      const availability = await checkEndpoint(url);
      if (!availability.available) {
        const reason = availability.reason || 'unavailable';
        console.log(`⚠️ Endpoint unavailable: ${reason}`);
        const resultRecord = {
          endpoint: endpointLabel,
          mode,
          success: false,
          results: [
            {
              label: 'Endpoint reachability',
              success: false,
              duration: null,
              queryType: 'unknown',
              status: `skipped (${reason})`,
              error: reason
            }
          ]
        };
        state.attempts.push(resultRecord);
        matrixRows.push({
          endpoint: endpointLabel,
          mode,
          scenario: 'Endpoint reachability',
          status: 'SKIP',
          latencyMs: '—',
          limitMs: getLatencyLimit(url),
          queryType: 'unknown'
        });
        continue;
      }

      const suiteResult = await runGuruloChatSuite({
        endpoint: url,
        attempt,
        abortOffline: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });

      const logPath = writeLog(attempt, endpointLabel, suiteResult.logPayload);
      console.log(`📝 Log saved to ${path.relative(process.cwd(), logPath)}`);

      suiteResult.results.forEach((scenarioResult) => {
        matrixRows.push(
          formatMatrixRow({
            endpoint: endpointLabel,
            mode,
            scenario: scenarioResult
          })
        );
      });

      state.attempts.push({
        endpoint: endpointLabel,
        mode,
        success: suiteResult.success,
        results: suiteResult.results
      });

      if (suiteResult.success) {
        state.success = true;
      }
    }

    printMatrix(matrixRows, attempt);

    const unresolved = Array.from(endpointStates.values()).filter((entry) => !entry.success);
    if (unresolved.length === 0) {
      console.log('\n✅ All endpoints passed the Gurulo front chat suite.');
      return;
    }

    if (attempt === MAX_ATTEMPTS) {
      summarizeFailure(Array.from(endpointStates.values()));
      process.exitCode = 1;
      return;
    }

    console.log('\n🔁 Some scenarios failed. Retrying...');
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('🚨 Front chat runner encountered an unexpected error:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  run
};
