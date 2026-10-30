const fs = require('fs');
let raw = fs.readFileSync('scratch/functions-audit.json');
let content;
if (raw[0] === 0xff && raw[1] === 0xfe) {
  content = raw.toString('utf16le');
} else if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  content = raw.toString('utf8').substring(1);
} else {
  content = raw.toString('utf8');
}
content = content.trim().replace(/^\uFEFF/, '');
const funcs = JSON.parse(content);

console.log('Total public functions:', funcs.length);

const secDefFuncs = funcs.filter(f => f.is_security_definer);
console.log('SECURITY DEFINER functions:', secDefFuncs.length);

secDefFuncs.forEach(f => {
  console.log(`\n- ${f.proname}(${f.arguments})`);
  console.log(`  Owner: ${f.owner}`);
  console.log(`  Config: ${f.config_search_path}`);
});
