const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

// I'll make the catch block of l() print to console as well
if (js.includes('A.innerHTML = \'<div style="color:var(--danger);')) {
    js = js.replace('A.innerHTML = \'<div style="color:var(--danger);', 'console.error(z); A.innerHTML = \'<div style="color:var(--danger);');
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
}
