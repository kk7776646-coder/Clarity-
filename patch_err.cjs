const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const formatApiErrorFunc = `
function formatApiError(err: any): string {
  let msg = err.message || "An unknown error occurred";
  try {
    if (msg.includes('{"error"')) {
      const startIdx = msg.indexOf('{');
      const endIdx = msg.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          let innerMsg = parsed.error.message;
          try {
             const innerParsed = JSON.parse(innerMsg);
             if (innerParsed.error && innerParsed.error.message) {
               msg = innerParsed.error.message;
             } else {
               msg = innerMsg;
             }
          } catch(e2) {
             msg = innerMsg;
          }
        }
      }
    }
  } catch (e) {
  }
  
  if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED")) {
     return "You have exceeded your API quota or rate limit. " + msg;
  }
  return msg;
}
`;

if (!code.includes('function formatApiError')) {
  code = code.replace(/function getGeminiClient/, formatApiErrorFunc + '\nfunction getGeminiClient');
  
  // Replace chat error
  code = code.replace(
    /console\.error\("Chat generation error:", err\);\n\s*sendSSE\(\{\n\s*error: \{\n\s*message: err\.message \|\| "Failed to generate AI response",/g,
    `console.error("Chat generation error:", err);\n      sendSSE({\n        error: {\n          message: formatApiError(err) || "Failed to generate AI response",`
  );
  
  // Replace any other places where we send error message for generate/chat
  // Wait, let's just do a regex for `message: err.message || "Failed`
  // Actually, I can use a global replace
  code = code.replace(/message: err\.message \|\| /g, 'message: formatApiError(err) || ');
  
  fs.writeFileSync('server.ts', code);
}
