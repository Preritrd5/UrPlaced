const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(walk(fullPath));
    else if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(fullPath);
  });
  return results;
}

const files = walk('src');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('/drives')) {
    const matches = content.match(/href=["'`][^"'`]*drives[^"'`]*["'`]/g);
    if (matches) {
      console.log(f.replace(/\\/g, '/'), matches);
    }
  }
});
