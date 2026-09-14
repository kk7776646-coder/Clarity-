const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// If server.js is output as cjs but package.json is type: module, it might conflict in dev tools
// Actually, our start script handles it correctly. We don't need to change it.
