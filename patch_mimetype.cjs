const fs = require('fs');
let code = fs.readFileSync('file-generator.ts', 'utf8');

const getMimeTypeFunc = `
function getMimeTypeForExt(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "application/javascript", jsx: "application/javascript",
    ts: "application/typescript", tsx: "application/typescript",
    html: "text/html", css: "text/css", json: "application/json",
    py: "text/x-python", csv: "text/csv", svg: "image/svg+xml",
    md: "text/markdown", ipynb: "application/x-ipynb+json",
    java: "text/x-java-source", c: "text/x-c", cpp: "text/x-c",
    sql: "application/sql", xml: "application/xml"
  };
  return map[ext] || "text/plain";
}
`;

code = code.replace(/export function validateCode/, getMimeTypeFunc + "\nexport function validateCode");

code = code.replace(/mimeType: "text\/plain"/g, 'mimeType: getMimeTypeForExt(arguments[0]?.filename || "txt")'); // This is a bit hacky, let's just replace the exact lines

fs.writeFileSync('file-generator.ts', code);
