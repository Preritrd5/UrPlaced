const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else if (file.endsWith('route.ts') || file.endsWith('route.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const routes = walk('src/app/api');
console.log('Total API route files:', routes.length);

const results = [];

for (const r of routes) {
  const relPath = path.relative(process.cwd(), r).replace(/\\/g, '/');
  const content = fs.readFileSync(r, 'utf8');
  
  const hasAuth = content.includes('getCurrentUserProfile') || 
                  content.includes('server-context') || 
                  content.includes('createClient') ||
                  content.includes('auth.getUser') ||
                  content.includes('getSession');
                  
  const hasTenantCheck = content.includes('tenant_id') || 
                         content.includes('activeMembership') || 
                         content.includes('tenantId') ||
                         content.includes('tenant');
                         
  const methods = [];
  if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET');
  if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST');
  if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT');
  if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH');
  if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE');

  results.push({
    route: relPath,
    methods,
    hasAuth,
    hasTenantCheck
  });
}

const unauthenticated = results.filter(r => !r.hasAuth);
console.log('\nUnauthenticated routes (must be public by design):', unauthenticated.length);
unauthenticated.forEach(r => console.log(' -', r.route, r.methods.join(', ')));
