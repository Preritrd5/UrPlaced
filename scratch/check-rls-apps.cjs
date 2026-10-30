const fs = require('fs');
const content = fs.readFileSync('supabase/migrations/20261018000002_phase04_college_placement.sql', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('CREATE POLICY "applications_select_policy"'));
console.log(lines.slice(idx, idx + 40).join('\n'));
