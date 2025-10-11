// backend/scripts/verifyEnv.js
require('dotenv').config();

const required = [
  'WEBAPP_RP_NAME',
  'ADMIN_ALLOWED_PERSONAL_ID',
  'RP_ID',
  'ORIGIN',
  'ALLOWED_ORIGINS',
  'AI_SERVICE_URL',
  'FRONTEND_URL',
  'PORT',
  'FIREBASE_ADMIN_KEY',
];

const results = [];
let issues = [];

for (const key of required) {
  const val = process.env[key];
  if (!val || String(val).trim() === '') {
    results.push(`${key} = MISSING`);
    issues.push(key);
  } else {
    results.push(`${key} = SET`);
  }
}

try {
  JSON.parse(process.env.FIREBASE_ADMIN_KEY || '');
} catch (_) {
  if (!issues.includes('FIREBASE_ADMIN_KEY')) {
    issues.push('FIREBASE_ADMIN_KEY(JSON invalid)');
  }
}

console.log(results.join('\n'));
console.log('---------------------------');
if (issues.length) {
  console.error(`❌ Missing or invalid items: ${issues.join(', ')}`);
  process.exit(1);
} else {
  console.log('✅ All required environment variables are valid (including FIREBASE_ADMIN_KEY)');
}