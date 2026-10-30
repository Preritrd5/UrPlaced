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

const pages = getFiles('src/app', p => path.basename(p) === 'page.tsx').map(p => p.replace(/\\/g, '/'));
const routes = getFiles('src/app', p => path.basename(p) === 'route.ts').map(p => p.replace(/\\/g, '/'));

console.log('--- PAGES BY CATEGORY ---');
const pageCats = {
  college: [],
  student: [],
  shared: [],
  auth: [],
  public: [],
  design: []
};

pages.forEach(p => {
  const rel = p.replace('src/app', '').replace('/page.tsx', '') || '/';
  if (rel.startsWith('/auth')) pageCats.auth.push(rel);
  else if (rel.startsWith('/design-system')) pageCats.design.push(rel);
  else if (rel.startsWith('/dashboard/student')) pageCats.student.push(rel);
  else if (['/dashboard/profile', '/dashboard/select-tenant', '/dashboard/drives/[id]/prep'].includes(rel)) pageCats.shared.push(rel);
  else if (rel.startsWith('/dashboard')) pageCats.college.push(rel);
  else pageCats.public.push(rel);
});

Object.keys(pageCats).forEach(k => {
  console.log(`${k} (${pageCats[k].length}):`, pageCats[k]);
});

console.log('\n--- API ROUTES BY DOMAIN ---');
const routeCats = {
  auth: [],
  placement: [],
  students: [],
  questions: [],
  assessments: [],
  training: [],
  analytics: [],
  ai: [],
  invitations: [],
  misc: []
};

routes.forEach(r => {
  const rel = r.replace('src/app', '').replace('/route.ts', '');
  if (rel.startsWith('/auth') || rel.startsWith('/api/auth')) routeCats.auth.push(rel);
  else if (rel.startsWith('/api/placement')) routeCats.placement.push(rel);
  else if (rel.startsWith('/api/student')) routeCats.students.push(rel);
  else if (rel.startsWith('/api/questions')) routeCats.questions.push(rel);
  else if (rel.startsWith('/api/assessments')) routeCats.assessments.push(rel);
  else if (rel.startsWith('/api/training')) routeCats.training.push(rel);
  else if (rel.startsWith('/api/analytics') || rel.startsWith('/api/cohort')) routeCats.analytics.push(rel);
  else if (rel.startsWith('/api/ai')) routeCats.ai.push(rel);
  else if (rel.startsWith('/api/invitations')) routeCats.invitations.push(rel);
  else routeCats.misc.push(rel);
});

Object.keys(routeCats).forEach(k => {
  console.log(`${k} (${routeCats[k].length}):`, routeCats[k]);
});
