const fs = require('fs');
let file = fs.readFileSync('project-routes.ts', 'utf8');

const targetCheck = `    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {`;

const newCheck = `    const canFullyResolveWithRules = targetIssues.length > 0 && targetIssues.every((i) => i.patchedContent || i.suggestedCode);

    // 1. Try Gemini AI fix if API key exists and we CANNOT fully resolve with rules
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey && !canFullyResolveWithRules) {`;

file = file.replace(targetCheck, newCheck);
file = file.replace('modelName: "gemini-3.6-flash"', 'modelName: "gemini-1.5-flash"');

fs.writeFileSync('project-routes.ts', file, 'utf8');
console.log("Updated project-routes.ts to skip Gemini if rule-based fix is available.");
