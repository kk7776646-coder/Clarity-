const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetStr = "` : ''}\n      `;\n    }\n\n    if (termOut) {";
const replaceStr = "` : ''}\n        ${data.port && (data.status === 'running' || data.status === 'starting') ? `\n          <div style=\"margin-top: 12px;\">\n            <a href=\"http://localhost:${data.port}\" target=\"_blank\" class=\"btn btn--sm btn--primary\" style=\"display:inline-flex; align-items:center; gap:6px; text-decoration:none;\">\n              <svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/><polyline points=\"15 3 21 3 21 9\"/><line x1=\"10\" y1=\"14\" x2=\"21\" y2=\"3\"/></svg>\n              Open Preview (Port ${data.port})\n            </a>\n          </div>\n        ` : ''}\n      `;\n    }\n\n    if (termOut) {";

js = js.replace(targetStr, replaceStr);
fs.writeFileSync('js/pages/project.js', js, 'utf8');
