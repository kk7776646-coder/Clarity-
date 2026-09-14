const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');

code = code.replace(
    "project.github.status.toUpperCase()",
    "(project.github.status || 'unknown').toUpperCase()"
);

code = code.replace(
    "const method = ep.method.toUpperCase();",
    "const method = (ep.method || 'ANY').toUpperCase();"
);

code = code.replace(
    "stateLabel.textContent = data.status.toUpperCase();",
    "stateLabel.textContent = (data.status || 'unknown').toUpperCase();"
);

fs.writeFileSync('js/pages/project.js', code);
