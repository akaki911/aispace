#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const { join } = require('path');
const assert = require('assert');

const outDir = join(__dirname, '..', 'tmp', 'futuristic-chat-tests');

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

execSync(
  `npx tsc src/components/futuristic-chat/AIChatInterface.tsx --module commonjs --target ES2019 --moduleResolution node --jsx react-jsx --esModuleInterop --outDir "${outDir}" --rootDir src`,
  { stdio: 'ignore' },
);

const compiledModulePath = join(outDir, 'components', 'futuristic-chat', 'AIChatInterface.js');
const { normalizeKaPunctuation } = require(compiledModulePath);

const cleaned = normalizeKaPunctuation('გამარჯობა.. „„გურულო““  აქ  არის', 'ka');
assert.strictEqual(cleaned, 'გამარჯობა. „გურულო“ აქ არის');

const preservedEllipsis = normalizeKaPunctuation('გზა... სუფთაა', 'ka');
assert.strictEqual(preservedEllipsis, 'გზა... სუფთაა');

const semantics = normalizeKaPunctuation('გზა „ბახმაროსკენ“ კარგია..', 'ka');
assert.strictEqual(semantics, 'გზა „ბახმაროსკენ“ კარგია.');

const untouchedEnglish = normalizeKaPunctuation('Hello..  world', 'en');
assert.strictEqual(untouchedEnglish, 'Hello..  world');

console.log('✅ normalizeKaPunctuation tests passed');
