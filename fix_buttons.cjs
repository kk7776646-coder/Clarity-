const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetBtn1 = `class="btn btn--danger" style="display:none; position:fixed; top:20px; right:32px; z-index:9999999; padding:8px 16px; font-weight:700; font-size:13px; border-radius:8px; align-items:center; gap:6px; box-shadow:0 4px 15px rgba(239,68,68,0.4); border:none; cursor:pointer; background-color:#ef4444 !important; color:#ffffff !important;"`;
const replaceBtn1 = `class="btn btn--outline" style="display:none; position:fixed; top:20px; right:32px; z-index:9999999; padding:8px 16px; font-weight:600; font-size:13px; border-radius:8px; align-items:center; gap:6px; cursor:pointer; background:var(--surface); box-shadow:var(--shadow-float); border:1px solid var(--line);"`;

js = js.split(targetBtn1).join(replaceBtn1);

fs.writeFileSync('js/pages/project.js', js, 'utf8');
console.log("Updated buttons.");
