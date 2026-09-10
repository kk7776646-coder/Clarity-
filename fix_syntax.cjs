const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I need to remove the extra try { and } catch that I introduced.
code = code.replace(/    try \{\n      const modelConfig = models.get\(activeModelId\);/g, "      const modelConfig = models.get(activeModelId);");

code = code.replace(/    \} catch \(providerErr: any\) \{\n      console.error\("Provider API stream error:", providerErr\);\n      const errDetail = providerErr\?\.message \|\| "Unknown error occurred";\n      const displayErr = `\\n\\n⚠️ \*\*Model Error \(\$\{activeModelId\}\)\*\*: \$\{errDetail\}\\n\\nPlease check your prompt or model configuration.`;\n      assistantText = displayErr;\n      sendSSE\(\{ content: displayErr \}\);\n    \}\n/g, "");

fs.writeFileSync('server.ts', code);
