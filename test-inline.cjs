const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');
if (code.includes('review-changes-btn')) {
  console.log("Found review-changes-btn");
} else {
  console.log("NOT FOUND");
}
