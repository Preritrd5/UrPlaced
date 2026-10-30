const { execSync } = require('child_process');
const passwords = ['postgres', 'root', 'admin', 'password', '123456', '1234', ''];
for (const pwd of passwords) {
  try {
    const out = execSync('"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -h 127.0.0.1 -p 5555 -U postgres -d postgres -c "SELECT version();"', {
      env: { ...process.env, PGPASSWORD: pwd },
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`Password "${pwd}" SUCCESS:`, out.toString());
    process.exit(0);
  } catch (e) {
    console.log(`Password "${pwd}" FAILED:`, e.stderr ? e.stderr.toString().trim() : e.message);
  }
}
