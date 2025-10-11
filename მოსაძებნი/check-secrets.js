const path = require('path');
const { ensureLocalSecrets } = require('./scripts/ensureLocalSecrets');

ensureLocalSecrets({ cwd: path.resolve(__dirname), silent: true });

const requiredSecrets = {
  // Firebase Frontend Configuration
  frontend: {
    'VITE_FIREBASE_API_KEY': 'Frontend Firebase API Key',
    'VITE_FIREBASE_AUTH_DOMAIN': 'Frontend Firebase Auth Domain',
    'VITE_FIREBASE_PROJECT_ID': 'Frontend Firebase Project ID',
    'VITE_FIREBASE_STORAGE_BUCKET': 'Frontend Firebase Storage Bucket',
    'VITE_FIREBASE_MESSAGING_SENDER_ID': 'Frontend Firebase Messaging Sender ID',
    'VITE_FIREBASE_APP_ID': 'Frontend Firebase App ID',
    'VITE_FIREBASE_MEASUREMENT_ID': 'Frontend Firebase Measurement ID (optional)'
  },
  
  // AI Service Configuration
  aiService: {
    'GROQ_API_KEY': 'Groq API Key for AI Service',
    'AI_INTERNAL_TOKEN': 'Internal token for AI Service communication',
    'FIREBASE_SERVICE_ACCOUNT_KEY': 'Firebase Service Account JSON for AI Service'
  },
  
  // Backend Configuration
  backend: {
    'AI_INTERNAL_TOKEN': 'Internal token for Backend (should match AI Service)',
    'SESSION_SECRET': 'Session secret for Backend',
    'FIREBASE_SERVICE_ACCOUNT_KEY': 'Firebase Service Account JSON for Backend (should match AI Service)',
    'ADMIN_SETUP_TOKEN': 'Admin setup token for initial configuration'
  },
  
  // Optional but recommended
  optional: {
    'FIREBASE_PROJECT_ID': 'Firebase Project ID (fallback)',
    'AI_SERVICE_URL': 'AI Service URL override',
    'ALLOWED_BACKEND_IPS': 'Allowed IPs for Backend communication'
  }
};

function checkSecrets() {
  console.log('🔍 Secrets-ების შემოწმება...\n');
  
  let missingSecrets = [];
  let presentSecrets = [];
  let issues = [];
  
  // Check all categories
  Object.entries(requiredSecrets).forEach(([category, secrets]) => {
    console.log(`📂 ${category.toUpperCase()} კატეგორია:`);
    
    Object.entries(secrets).forEach(([key, description]) => {
      const value = process.env[key];
      
      if (!value || value.trim() === '') {
        console.log(`  ❌ ${key} - არ არის განსაზღვრული`);
        missingSecrets.push({ key, description, category });
      } else {
        // Special validation for JSON secrets
        if (key.includes('FIREBASE_SERVICE_ACCOUNT_KEY')) {
          try {
            const parsed = JSON.parse(value);
            if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
              console.log(`  ⚠️  ${key} - JSON არასწორია (აკლია საჭირო ველები)`);
              issues.push({ key, issue: 'Invalid JSON structure', category });
            } else {
              console.log(`  ✅ ${key} - OK (valid JSON)`);
              presentSecrets.push({ key, description, category });
            }
          } catch (e) {
            console.log(`  ❌ ${key} - JSON formatting შეცდომა`);
            issues.push({ key, issue: 'Invalid JSON format', category });
          }
        } else if (key === 'AI_INTERNAL_TOKEN') {
          if (value.length < 32) {
            console.log(`  ⚠️  ${key} - ძალიან მოკლეა (უნდა იყოს მინიმუმ 32 სიმბოლო)`);
            issues.push({ key, issue: 'Token too short', category });
          } else {
            console.log(`  ✅ ${key} - OK (${value.substring(0, 10)}...)`);
            presentSecrets.push({ key, description, category });
          }
        } else {
          console.log(`  ✅ ${key} - OK`);
          presentSecrets.push({ key, description, category });
        }
      }
    });
    console.log('');
  });
  
  // Summary
  console.log('📊 შეჯამება:');
  console.log(`✅ განსაზღვრული: ${presentSecrets.length}`);
  console.log(`❌ ნაკლული: ${missingSecrets.length}`);
  console.log(`⚠️  პრობლემები: ${issues.length}\n`);
  
  if (missingSecrets.length > 0) {
    console.log('🚨 ნაკლული Secrets-ები:');
    missingSecrets.forEach(({ key, description, category }) => {
      console.log(`  ${category}: ${key} - ${description}`);
    });
    console.log('\n💡 როგორ დაამატოთ:');
    console.log('1. Replit-ში გახსენით "Secrets" ფანჯარა');
    console.log('2. დააჭირეთ "+ New Secret" ღილაკს');
    console.log('3. შეიყვანეთ Key-ისა და Value-ს\n');
  }
  
  if (issues.length > 0) {
    console.log('⚠️  პრობლემების დეტალები:');
    issues.forEach(({ key, issue, category }) => {
      console.log(`  ${category}: ${key} - ${issue}`);
    });
    console.log('');
  }
  
  // Special check for matching tokens
  if (process.env.AI_INTERNAL_TOKEN) {
    const aiServiceToken = process.env.AI_INTERNAL_TOKEN;
    console.log('🔐 Token-ების თანმიმდევრობის შემოწმება:');
    console.log(`AI_INTERNAL_TOKEN length: ${aiServiceToken.length}`);
    console.log(`Token preview: ${aiServiceToken.substring(0, 10)}...${aiServiceToken.slice(-5)}`);
  }
  
  // Return status
  return {
    success: missingSecrets.length === 0 && issues.length === 0,
    missing: missingSecrets,
    issues: issues,
    present: presentSecrets
  };
}

// Run the check
if (require.main === module) {
  const result = checkSecrets();
  
  if (result.success) {
    console.log('🎉 ყველა საჭირო secrets წარმატებით არის კონფიგურებული!');
    process.exit(0);
  } else {
    console.log('❌ რამდენიმე secrets საჭიროებს ყურადღებას.');
    process.exit(1);
  }
}

module.exports = { checkSecrets, requiredSecrets };
