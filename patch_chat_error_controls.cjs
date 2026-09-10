const fs = require('fs');
let code = fs.readFileSync('js/ui/chat.js', 'utf8');

// Remove change model from _showErrorControls
code = code.replace(/const change = document\.createElement\("button"\);\s*change\.className = "btn btn--ghost btn--sm";\s*change\.textContent = "Change model";\s*change\.addEventListener\("click", \(\) => \{ window\.location\.hash = "#\/model"; \}\);\s*bar\.appendChild\(retry\);\s*bar\.appendChild\(change\);/g, 
"bar.appendChild(retry);");

fs.writeFileSync('js/ui/chat.js', code);
