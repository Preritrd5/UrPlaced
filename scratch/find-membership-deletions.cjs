const fs = require('fs');
const path = require('path');

function getFiles(dir, match) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(fullPath, match));
      } else if (match(fullPath)) {
        results.push(fullPath);
      }
    });
  } catch (e) {}
  return results;
}

const files = getFiles('src', p => p.endsWith('.ts') || p.endsWith('.tsx'));
const occurrences = [];
files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('tenant_memberships') && c.includes('delete')) {
    occurrences.push(f);
  }
});

console.log('Files with tenant_memberships and delete:');
console.log(occurrences);
