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

const allTsx = getFiles('src', p => p.endsWith('.tsx') || p.endsWith('.ts'));
const serverActions = [];
allTsx.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('"use server"') || content.includes("'use server'")) {
    serverActions.push(file);
  }
});

console.log('Server actions count:', serverActions.length);
if (serverActions.length > 0) {
  console.log('Server action files:', serverActions);
}

const sharedComponents = getFiles('src/components', p => p.endsWith('.tsx'));
const appComponents = getFiles('src/app', p => p.includes('components') && p.endsWith('.tsx'));
const moduleComponents = getFiles('src/modules', p => p.includes('components') && p.endsWith('.tsx'));

console.log('Shared UI components (src/components):', sharedComponents.length);
console.log('App-scoped components (src/app/**/components):', appComponents.length);
console.log('Module-scoped components (src/modules/**/components):', moduleComponents.length);
console.log('Total UI components:', sharedComponents.length + appComponents.length + moduleComponents.length);
