const fs = require('fs');

const inventory = JSON.parse(fs.readFileSync('scratch/db-schema-inventory.json', 'utf8'));
const rlsSummary = JSON.parse(fs.readFileSync('scratch/rls-summary.json', 'utf8'));

// Build lookup map for rls
const rlsMap = new Map();
rlsSummary.tables.forEach(t => {
  rlsMap.set(t.name, t);
});

let md = '';

inventory.sort((a, b) => a.name.localeCompare(b.name)).forEach((t, idx) => {
  const rlsInfo = rlsMap.get(t.name) || { rls: false, policies: [] };
  const tenantCol = t.columns.find(c => c.name === 'tenant_id') ? 'tenant_id (Scoped)' : (t.name === 'tenants' ? 'id (Tenant Root)' : (t.name === 'profiles' ? 'Global Platform Table (Linked to auth.users)' : 'None'));

  md += `### ${idx + 1}. \`${t.name}\`\n\n`;
  md += `- **Migration Source:** \`${t.file}\`\n`;
  md += `- **Multi-Tenant Boundary:** \`${tenantCol}\`\n`;
  md += `- **Row Level Security (RLS):** ${rlsInfo.rls ? '✅ Forced / Enabled' : '❌ Disabled'} (${rlsInfo.policies.length} Policies Defined)\n`;
  md += `- **Primary Key:** \`${t.primaryKey.join(', ') || 'id'}\`\n\n`;

  // Columns table
  md += `| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  t.columns.forEach(c => {
    const fk = t.foreignKeys.find(f => f.columns.includes(c.name));
    let extra = '';
    if (t.primaryKey.includes(c.name)) extra += 'PRIMARY KEY; ';
    if (fk) extra += `FK -> \`${fk.refTable}(${fk.refColumns.join(', ')})\` ${fk.action}; `;
    const uq = t.uniqueConstraints.find(u => u.columns.includes(c.name));
    if (uq) extra += `UNIQUE; `;
    const chk = t.checkConstraints.find(k => k.name.includes(c.name));
    if (chk) extra += `CHECK: \`${chk.expression}\`; `;

    md += `| \`${c.name}\` | \`${c.type}\` | ${c.notNull ? 'NOT NULL' : 'NULL'} | \`${c.default || '—'}\` | ${extra || '—'} |\n`;
  });

  md += '\n';

  // Indexes
  if (t.indexes.length > 0) {
    md += `**Indexes:**\n`;
    t.indexes.forEach(i => {
      md += `- \`${i.name}\` on \`(${i.columns.join(', ')})\`${i.isUnique ? ' [UNIQUE]' : ''}\n`;
    });
    md += '\n';
  }

  // Policies
  if (rlsInfo.policies.length > 0) {
    md += `**RLS Policies (${rlsInfo.policies.length}):**\n`;
    rlsInfo.policies.forEach(p => {
      md += `- **"${p.name}"** — Action: \`${p.action}\` | Role: \`${p.toRole}\`\n`;
    });
    md += '\n';
  }

  md += '---\n\n';
});

fs.writeFileSync('scratch/database-inventory-section.md', md);
console.log('Database inventory markdown generated successfully!');
