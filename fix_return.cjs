const fs = require('fs');
let file = fs.readFileSync('project-routes.ts', 'utf8');

const targetReturn = `    return res.json({
      success: true,
      path: cleanPath,
      fixedCount: fixedCount || 1,
      content: fixedContent,
      diagnostics: freshDiag,
    });`;

const newReturn = `    return res.json({
      success: true,
      path: cleanPath,
      fixedCount: fixedCount || 1,
      content: fixedContent,
      fixedContent: fixedContent,
      diagnostics: freshDiag,
    });`;

file = file.replace(targetReturn, newReturn);
fs.writeFileSync('project-routes.ts', file, 'utf8');
console.log("Fixed return payload in project-routes.ts");
