const fs = require('fs');
const path = require('path');

const testDir = 'src/test';
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));

console.log('Total test files in src/test:', files.length);

const categories = {
  auth_tenancy: [],
  placement_drives: [],
  questions_assessments: [],
  mistakes_mastery: [],
  notifications: [],
  ai_services: [],
  ui_responsiveness_theme: [],
  other: [],
};

files.forEach(f => {
  if (f.includes('auth') || f.includes('tenant') || f.includes('membership') || f.includes('srn') || f.includes('signup')) {
    categories.auth_tenancy.push(f);
  } else if (f.includes('drive') || f.includes('company') || f.includes('placement') || f.includes('student-directory') || f.includes('eligibility') || f.includes('candidate')) {
    categories.placement_drives.push(f);
  } else if (f.includes('question') || f.includes('assessment') || f.includes('set')) {
    categories.questions_assessments.push(f);
  } else if (f.includes('mistake') || f.includes('mastery') || f.includes('revision')) {
    categories.mistakes_mastery.push(f);
  } else if (f.includes('notification') || f.includes('announcement')) {
    categories.notifications.push(f);
  } else if (f.includes('ai-') || f.includes('floating-ai')) {
    categories.ai_services.push(f);
  } else if (f.includes('viewport') || f.includes('responsiveness') || f.includes('mobile') || f.includes('laptop') || f.includes('dark-mode') || f.includes('theme') || f.includes('logo') || f.includes('menu')) {
    categories.ui_responsiveness_theme.push(f);
  } else {
    categories.other.push(f);
  }
});

for (const [cat, list] of Object.entries(categories)) {
  console.log(`\n=== ${cat.toUpperCase()} (${list.length}) ===`);
  list.forEach(f => console.log(' -', f));
}
