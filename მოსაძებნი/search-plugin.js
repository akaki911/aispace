
const fs = require('fs');
const path = require('path');

function searchDirectory(dir) {
  try {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.config'].includes(entry.name)) return;
        searchDirectory(fullPath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('@prettier/plugin-estree')) {
            console.log(`✅ Found "@prettier/plugin-estree" in: ${fullPath}`);
            console.log('Context:', content.slice(content.indexOf('@prettier/plugin-estree') - 50, content.indexOf('@prettier/plugin-estree') + 100));
            console.log('---');
          }
        } catch (e) {
          // Skip binary files
        }
      }
    });
  } catch (e) {
    // Skip directories we can't read
  }
}

console.log('🔍 Searching for @prettier/plugin-estree references...');
searchDirectory('.');
console.log('🔍 Search completed.');
