const fs = require('fs');
let raw = fs.readFileSync('scratch/55-tables-audit.json');
// Handle UTF-16 LE BOM
let content;
if (raw[0] === 0xff && raw[1] === 0xfe) {
  content = raw.toString('utf16le');
} else if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  content = raw.toString('utf8').substring(1);
} else {
  content = raw.toString('utf8');
}
content = content.trim().replace(/^\uFEFF/, '');
const tables = JSON.parse(content);

console.log('Total public tables:', tables.length);

const withoutRls = tables.filter(t => !t.rls_enabled);
console.log('Tables without RLS:', withoutRls.map(t => t.table_name));

const withoutForceRls = tables.filter(t => !t.force_rls);
console.log('Tables without FORCE RLS:', withoutForceRls.length, withoutForceRls.map(t => t.table_name));

const withoutPolicies = tables.filter(t => !t.policies || t.policies.length === 0);
console.log('Tables without policies:', withoutPolicies.map(t => t.table_name));

const withPlatformAdminPolicy = [];
for (const t of tables) {
  if (t.policies) {
    for (const p of t.policies) {
      const q = (p.qual || '') + ' ' + (p.with_check || '');
      if (q.includes('is_platform_admin') || q.includes('admin@urplaced') || q.includes('super_admin') || q.includes('Super admins')) {
        withPlatformAdminPolicy.push({
          table: t.table_name,
          policy: p.policyname,
          cmd: p.cmd,
          qual: p.qual,
          with_check: p.with_check
        });
      }
    }
  }
}

console.log('\nPolicies with platform admin references:', withPlatformAdminPolicy.length);
withPlatformAdminPolicy.forEach(p => {
  console.log(`- Table: ${p.table}, Policy: "${p.policy}", CMD: ${p.cmd}`);
  console.log(`  QUAL: ${p.qual}`);
});
