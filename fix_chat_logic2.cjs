const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

file = file.replace(/clone.querySelectorAll\("button, \.spinner, \.artifact-card"\)/g, 'clone.querySelectorAll("button, .spinner")');
fs.writeFileSync('js/pages/project.js', file, 'utf8');
