#!/usr/bin/env node
const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const { join } = require('path');

const outDir = join(__dirname, '..', 'tmp', 'georgian-grammar-test');

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

execSync(`npx tsc src/utils/georgianGrammarParser.ts --module commonjs --target ES2019 --moduleResolution node --outDir "${outDir}" --esModuleInterop`, {
  stdio: 'ignore'
});

const parserModule = require(join(outDir, 'georgianGrammarParser.js'));
const parser = new parserModule.GeorgianGrammarParser();

const positive = parser.parseSentence('მე ვხედავ ხეს', { strict: true });
const negative = parser.parseSentence('მე ვხედავ ხე-ს', { strict: true });

const passed = positive.errors.length === 0 && negative.errors.some(error => error.type === 'case');

console.log('[GeorgianGrammar] strict positive errors:', positive.errors.length);
console.log('[GeorgianGrammar] strict negative corrections:', negative.errors.map(e => `${e.token} -> ${e.suggestion || 'n/a'}`).join('; '));

if (!passed) {
  console.error('❌ Georgian grammar validation failed');
  process.exit(1);
}

console.log('✅ Georgian grammar validation passed');
