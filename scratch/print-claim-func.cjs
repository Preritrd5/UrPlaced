const fs = require('fs');
let raw = fs.readFileSync('scratch/functions-audit.json');
let content = raw.toString('utf16le').trim().replace(/^\uFEFF/, '');
const funcs = JSON.parse(content);
const f = funcs.find(x => x.proname === 'claim_student_roster');
console.log(f.definition);
