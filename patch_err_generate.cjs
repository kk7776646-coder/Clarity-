const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /res\.status\(500\)\.json\(\{ error: err\.message \|\| "Failed to generate artifact", type: "generation_error" \}\);/g,
  `res.status(500).json({ error: formatApiError(err) || "Failed to generate artifact", type: "generation_error" });`
);

fs.writeFileSync('server.ts', code);
