const { execSync } = require('child_process');
const fs = require('fs');

const sql = `
SELECT json_agg(t ORDER BY table_name)
FROM (
  SELECT 
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS force_rls,
    (
      SELECT json_agg(
        json_build_object(
          'policyname', p.policyname,
          'cmd', p.cmd,
          'roles', p.roles,
          'qual', p.qual,
          'with_check', p.with_check
        ) ORDER BY p.cmd, p.policyname
      )
      FROM pg_policies p
      WHERE p.schemaname = n.nspname AND p.tablename = c.relname
    ) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
) t;
`;

try {
  const result = execSync(`docker exec -i supabase_db_grdghrhhnqpjywakxzxr psql -U postgres -d postgres -t -A -c "${sql.replace(/"/g, '\\"')}"`, { maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync('scratch/55-tables-audit.json', result.toString().trim());
  console.log('Successfully wrote scratch/55-tables-audit.json');
} catch (err) {
  console.error('Error querying catalog:', err);
}
