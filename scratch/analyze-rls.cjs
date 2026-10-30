const fs = require('fs');
const path = require('path');

const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

const tables = new Map(); // tableName -> { file, rls: false, policies: [] }
const functions = [];
const buckets = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Match CREATE TABLE
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const name = match[1].toLowerCase();
    if (!tables.has(name)) {
      tables.set(name, { name, file, rls: false, policies: [] });
    }
  }

  // Match ENABLE ROW LEVEL SECURITY
  const rlsRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  while ((match = rlsRegex.exec(content)) !== null) {
    const name = match[1].toLowerCase();
    if (tables.has(name)) {
      tables.get(name).rls = true;
    }
  }

  // Match CREATE POLICY
  // CREATE POLICY "name" ON table FOR action TO role USING (...) WITH CHECK (...)
  const policyRegex = /CREATE\s+POLICY\s+["']?([^"'\n]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)(?:\s+AS\s+[a-zA-Z]+)?(?:\s+FOR\s+([A-Z]+))?(?:\s+TO\s+([^ \n]+))?(?:\s+USING\s*\(([\s\S]*?)\))?(?:\s+WITH\s+CHECK\s*\(([\s\S]*?)\))?;/gi;
  while ((match = policyRegex.exec(content)) !== null) {
    const policyName = match[1].trim();
    const tableName = match[2].toLowerCase();
    const action = match[3] || 'ALL';
    const toRole = match[4] || 'PUBLIC';
    const using = match[5] ? match[5].trim().replace(/\s+/g, ' ') : '';
    const withCheck = match[6] ? match[6].trim().replace(/\s+/g, ' ') : '';

    if (tables.has(tableName)) {
      tables.get(tableName).policies.push({
        name: policyName,
        action,
        toRole,
        using: using.slice(0, 100),
        withCheck: withCheck.slice(0, 100)
      });
    }
  }

  // Match Functions
  const funcRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  while ((match = funcRegex.exec(content)) !== null) {
    const fname = match[1].toLowerCase();
    if (!functions.includes(fname)) functions.push(fname);
  }

  // Match Storage buckets
  const bucketRegex = /INSERT\s+INTO\s+storage\.buckets[^(]*\([^)]*\)\s*VALUES\s*\(\s*['"]([^'"]+)['"]/gi;
  while ((match = bucketRegex.exec(content)) !== null) {
    buckets.push(match[1]);
  }
});

console.log('Total Tables Identified:', tables.size);
let withRls = 0;
let totalPolicies = 0;
tables.forEach((t, name) => {
  if (t.rls) withRls++;
  totalPolicies += t.policies.length;
});
console.log('Tables with RLS Enabled:', withRls);
console.log('Total Policies Defined:', totalPolicies);
console.log('Functions:', functions);
console.log('Storage Buckets:', buckets);

// Dump table summary
const tableList = Array.from(tables.keys()).sort();
fs.writeFileSync('scratch/rls-summary.json', JSON.stringify({
  totalTables: tables.size,
  rlsEnabledCount: withRls,
  totalPolicies,
  tables: Array.from(tables.values()),
  functions,
  buckets
}, null, 2));
