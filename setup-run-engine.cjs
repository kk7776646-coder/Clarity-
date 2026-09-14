const fs = require('fs');

if (!fs.existsSync('js/execution')) {
    fs.mkdirSync('js/execution');
}

console.log("Created execution directory.");
