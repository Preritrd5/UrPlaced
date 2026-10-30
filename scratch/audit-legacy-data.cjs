const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env safely
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.log('Missing Supabase configuration.');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function runAudit() {
  console.log('Auditing existing database records for multi-college conflicts...');

  // 1. Audit tenant_memberships
  const { data: memberships, error: memErr } = await supabase
    .from('tenant_memberships')
    .select('id, tenant_id, user_id, role, status');

  if (memErr) {
    console.error('Error fetching memberships:', memErr.message);
  } else {
    console.log(`Total tenant_memberships rows: ${memberships.length}`);
    const userMap = new Map();
    memberships.forEach(m => {
      if (!userMap.has(m.user_id)) userMap.set(m.user_id, []);
      userMap.get(m.user_id).push(m);
    });

    const multiCollegeUsers = [];
    userMap.forEach((mList, uid) => {
      const distinctTenants = new Set(mList.map(m => m.tenant_id));
      if (distinctTenants.size > 1) {
        multiCollegeUsers.push({ userId: uid, count: mList.length, tenants: Array.from(distinctTenants) });
      }
    });

    console.log(`Users with multi-college memberships: ${multiCollegeUsers.length}`);
    if (multiCollegeUsers.length > 0) {
      console.log('Conflict details:', multiCollegeUsers);
    }
  }

  // 2. Audit invitations
  const { data: invitations, error: invErr } = await supabase
    .from('invitations')
    .select('id, tenant_id, email, status');

  if (invErr) {
    console.error('Error fetching invitations:', invErr.message);
  } else {
    console.log(`Total invitations rows: ${invitations.length}`);
    const emailMap = new Map();
    invitations.forEach(inv => {
      const em = (inv.email || '').toLowerCase().trim();
      if (!emailMap.has(em)) emailMap.set(em, []);
      emailMap.get(em).push(inv);
    });

    const multiCollegePendingInvites = [];
    emailMap.forEach((invList, em) => {
      const pendingTenants = new Set(invList.filter(i => i.status === 'PENDING').map(i => i.tenant_id));
      if (pendingTenants.size > 1) {
        multiCollegePendingInvites.push({ email: em, count: pendingTenants.size, tenants: Array.from(pendingTenants) });
      }
    });

    console.log(`Pending invitations across multiple colleges for same email: ${multiCollegePendingInvites.length}`);
  }

  // 3. Audit students
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, tenant_id, user_id, enrollment_number');

  if (studErr) {
    console.error('Error fetching students:', studErr.message);
  } else {
    console.log(`Total students rows: ${students.length}`);
    const studentUserMap = new Map();
    students.filter(s => s.user_id).forEach(s => {
      if (!studentUserMap.has(s.user_id)) studentUserMap.set(s.user_id, []);
      studentUserMap.get(s.user_id).push(s);
    });

    const multiCollegeStudents = [];
    studentUserMap.forEach((sList, uid) => {
      const distinctTenants = new Set(sList.map(s => s.tenant_id));
      if (distinctTenants.size > 1) {
        multiCollegeStudents.push({ userId: uid, tenants: Array.from(distinctTenants) });
      }
    });
    console.log(`Students with claimed records across multiple colleges: ${multiCollegeStudents.length}`);
  }
}

runAudit();
