const fs = require('fs');
let lines = fs.readFileSync('file-generator.ts', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('mimeType: getMimeTypeForExt("filename" in artifact ? artifact.filename : "unknown")')) {
    if (lines[i-2].includes('filename: target.name')) {
      lines[i] = lines[i].replace('getMimeTypeForExt("filename" in artifact ? artifact.filename : "unknown")', 'getMimeTypeForExt(target.name)');
    } else if (lines[i-2].includes('filename: item.path')) {
      lines[i] = lines[i].replace('getMimeTypeForExt("filename" in artifact ? artifact.filename : "unknown")', 'getMimeTypeForExt(item.path)');
    } else if (lines[i-2].includes('filename: fileName')) {
      lines[i] = lines[i].replace('getMimeTypeForExt("filename" in artifact ? artifact.filename : "unknown")', 'getMimeTypeForExt(fileName)');
    }
  }
}
fs.writeFileSync('file-generator.ts', lines.join('\n'));
