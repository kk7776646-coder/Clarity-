const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');

code = code.replace(
  /\/'<button class="btn btn--primary btn--sm" id="deleteProjectDetailBtn" title="Delete this project">',\/ /g,
  `'<button class="btn btn--primary btn--sm" id="deleteProjectDetailBtn" title="Delete this project">',`
);

code = code.replace(
  /\/'<button class="btn btn--primary btn--sm" id="submitDeleteBtn">Delete<\/button>',\/ /g,
  `'<button class="btn btn--primary btn--sm" id="submitDeleteBtn">Delete</button>',`
);

fs.writeFileSync('js/pages/project.js', code);
