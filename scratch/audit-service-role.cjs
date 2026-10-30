const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walk(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = walk('src');

// 1. Find all routes
const routes = allFiles.filter(f => f.endsWith('route.ts') || f.endsWith('route.js'));
console.log('Total API routes:', routes.length);

// 2. Find all occurrences of createAdminClient
const adminUsages = [];
for (const file of allFiles) {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('createAdminClient') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      adminUsages.push(file);
    }
  }
}

console.log('Files using createAdminClient or service role key:', adminUsages.length);
adminUsages.forEach(f => console.log(' -', f));
