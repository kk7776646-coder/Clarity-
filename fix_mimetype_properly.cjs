const fs = require('fs');
let code = fs.readFileSync('file-generator.ts', 'utf8');

code = code.replace(/mimeType: getMimeTypeForExt\(arguments\[0\]\?\.filename \|\| "txt"\)/g, 'mimeType: getMimeTypeForExt("filename" in artifact ? artifact.filename : "unknown")'); // wait, the object IS the artifact.

fs.writeFileSync('file-generator.ts', code);
