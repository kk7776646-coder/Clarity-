const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

if (js.includes('VS Code Terminals')) {
    console.log("Success! Project UI is updated.");
} else {
    console.log("Failed. String not found.");
}
