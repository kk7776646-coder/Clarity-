const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// POST file
code = code.replace(
  `files.set(fileId, file);`,
  `files.set(fileId, file);
      // Knowledge update
      const ext = path.extname(file.filename);
      updateFileKnowledge(pid, {
        path: file.filename,
        name: path.basename(file.filename),
        extension: ext,
        size: Buffer.byteLength(file.content || "", "utf-8"),
        isBinary: false,
        content: file.content || "",
        lineCount: (file.content || "").split('\\n').length
      });`
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with incremental update");
