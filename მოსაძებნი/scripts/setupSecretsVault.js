#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('dotenv');

const ACTOR_ID = 'setup-secrets-vault';

function loadEnv(pathname) {
  if (!fs.existsSync(pathname)) {
    return {};
  }
  const raw = fs.readFileSync(pathname, 'utf8');
  return parse(raw);
}

function loadEnvExamples() {
  const repoRoot = path.join(__dirname, '..');
  const candidates = [
    path.join(repoRoot, '.env.example'),
    path.join(repoRoot, 'backend', '.env.example'),
    path.join(repoRoot, 'ai-service', '.env.example'),
  ];

  const values = new Map();
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const entries = loadEnv(filePath);
    for (const [key, value] of Object.entries(entries)) {
      if (!key || value === undefined || value === null) continue;
      const trimmed = String(value).trim();
      if (!trimmed) continue;
      if (!values.has(key)) {
        values.set(key, trimmed);
      }
    }
  }
  return values;
}

function maskValue(value) {
  if (!value) return 'empty';
  const str = String(value);
  if (str.length <= 4) {
    return `${'*'.repeat(str.length)} (${str.length} chars)`;
  }
  return `**** (${str.length} chars)`;
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  const repoRoot = path.join(__dirname, '..');
  const envPath = path.join(repoRoot, '.env');
  if (fs.existsSync(envPath)) {
    const { config } = require('dotenv');
    config({ path: envPath });
  }

  const encKey = process.env.SECRETS_ENC_KEY;
  if (!encKey) {
    throw new Error('SECRETS_ENC_KEY is not configured. Update .env before running this script.');
  }

  const candidateBuffers = [];
  candidateBuffers.push(Buffer.from(encKey, 'utf8'));
  try {
    candidateBuffers.push(Buffer.from(encKey, 'base64'));
  } catch (error) {
    // ignore base64 parsing errors
  }

  const isValidKey = candidateBuffers.some((buf) => buf.length === 32);
  if (!isValidKey) {
    throw new Error('SECRETS_ENC_KEY must be exactly 32 bytes in utf8 or base64 form.');
  }

  const secretsVault = require('../backend/services/secretsVault');
  const secretsScanner = require('../backend/services/secretsScanner');
  const secretsSyncQueue = require('../backend/services/secretsSyncQueue');
  const { getRequiredSecrets } = require('../backend/services/secretsRequiredService');
  const { syncEnvFiles } = require('../backend/services/secretsSyncService');

  console.log('🔐 Secrets Vault setup starting…');

  const exampleValues = loadEnvExamples();
  const knownKeysBefore = secretsVault.getAllKeys();
  const initialScan = await secretsScanner.scanForMissing(knownKeysBefore);
  console.log(`📦 Initial scan found ${initialScan.missing.length} missing keys.`);

  const ensuredKeys = new Set();

  async function ensureSecret(key) {
    if (ensuredKeys.has(key)) {
      return;
    }
    ensuredKeys.add(key);

    const fallbackValue = exampleValues.get(key) || '__PLACEHOLDER__';
    try {
      const existing = secretsVault.get(key);
      const updatePayload = {};
      if (!existing.required) {
        updatePayload.required = true;
      }
      if (existing.visibility !== 'hidden') {
        updatePayload.visibility = 'hidden';
      }
      if (!existing.valueEncrypted) {
        updatePayload.value = fallbackValue;
      }

      if (Object.keys(updatePayload).length === 0) {
        console.log(`• ${key}: already configured (${maskValue(fallbackValue)})`);
        return;
      }

      console.log(`• ${key}: updating ${Object.keys(updatePayload).join(', ')}`);
      await secretsVault.update(key, {
        ...updatePayload,
        updatedBy: ACTOR_ID,
      });
      await secretsSyncQueue.add(key);
    } catch (error) {
      if (error.code !== 'NOT_FOUND') {
        throw error;
      }

      console.log(`• ${key}: creating placeholder (${maskValue(fallbackValue)})`);
      await secretsVault.create({
        key,
        value: fallbackValue,
        visibility: 'hidden',
        source: 'scanned',
        createdBy: ACTOR_ID,
        required: true,
      });
      await secretsSyncQueue.add(key);
    }
  }

  const requiredState = await getRequiredSecrets();
  for (const item of requiredState.items) {
    if (item.status !== 'missing') continue;
    await ensureSecret(item.key);
  }

  const afterEnsure = await getRequiredSecrets();
  const remainingMissing = afterEnsure.items.filter((item) => item.status === 'missing');
  console.log(`✅ Placeholder import complete. Remaining missing entries: ${remainingMissing.length}.`);

  console.log('🔄 Syncing .env files…');
  const syncResult = await syncEnvFiles();
  for (const [service, info] of Object.entries(syncResult.services)) {
    console.log(`  - ${service}: status=${info.status}, updatedKeys=${info.updatedKeys.length}, changed=${info.changed}`);
    if (info.backupPath) {
      console.log(`    backup: ${path.relative(repoRoot, info.backupPath)}`);
    }
    if (info.missingKeys.length) {
      console.log(`    missing keys: ${info.missingKeys.join(', ')}`);
    }
  }

  const usageTargets = ['GROQ_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_KEY'];
  for (const target of usageTargets) {
    const occurrences = await secretsScanner.findKeyUsages(target);
    const flattened = Object.values(occurrences).flat();
    console.log(`🔎 Usage for ${target}: ${flattened.length} references`);
    flattened.slice(0, 10).forEach((entry) => {
      console.log(`    • ${entry.file}:${entry.line} – ${entry.context}`);
    });
  }

  console.log('✨ Secrets Vault setup finished.');
}

main().catch((error) => {
  console.error('❌ Secrets Vault setup failed:', error.message);
  process.exitCode = 1;
});
