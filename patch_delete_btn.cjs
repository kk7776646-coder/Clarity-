const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');

code = code.replace(
  /'<button class="btn btn--outline btn--sm" id="deleteProjectDetailBtn" style="color:var\(--danger\); border-color:rgba\(239,68,68,0\.35\);" title="Delete this project">',/g,
  /'<button class="btn btn--primary btn--sm" id="deleteProjectDetailBtn" title="Delete this project">',/
);

code = code.replace(
  /'<button class="btn btn--primary btn--sm" id="submitDeleteBtn" style="background:#dc2626; border-color:#dc2626;">Delete<\/button>',/g,
  /'<button class="btn btn--primary btn--sm" id="submitDeleteBtn">Delete<\/button>',/
);

fs.writeFileSync('js/pages/project.js', code);
