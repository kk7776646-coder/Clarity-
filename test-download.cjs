const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');
if (code.includes('files/download?path=')) {
  console.log("Success");
} else {
  console.log("FAIL");
}
