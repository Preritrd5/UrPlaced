const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(walk(fullPath));
    else results.push(fullPath);
  });
  return results;
}

const routes = walk('src/app/api');
const findings = [];

routes.forEach(r => {
  const code = fs.readFileSync(r, 'utf8');
  const hasAuthContext = code.includes('requireAuthContext');
  const hasClientSuppliedTenant = /searchParams\.get\(['"]tenantId['"]\)|body\.tenantId/i.test(code);
  const usesAdminClient = code.includes('createAdminClient');
  const usesServerClient = code.includes('createClient');

  findings.push({
    route: r.replace(/\\/g, '/').replace('src/app/api/', ''),
    hasAuthContext,
    hasClientSuppliedTenant,
    usesAdminClient,
    usesServerClient
  });
});

console.log('Total API routes analyzed:', findings.length);
const withoutAuthContext = findings.filter(f => !f.hasAuthContext);
console.log('Routes without requireAuthContext (' + withoutAuthContext.length + '):');
withoutAuthContext.forEach(f => console.log(' -', f.route));

const clientTenantRoutes = findings.filter(f => f.hasClientSuppliedTenant);
console.log('\nRoutes reading client-supplied tenantId (' + clientTenantRoutes.length + '):');
clientTenantRoutes.forEach(f => console.log(' -', f.route));
