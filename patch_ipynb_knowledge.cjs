const fs = require('fs');
let code = fs.readFileSync('knowledge-engine.ts', 'utf8');

const ipynbLogic = `
  if (file.extension.toLowerCase() === '.ipynb') {
    try {
      const nb = JSON.parse(file.content);
      const cells = nb.cells || [];
      let cellLines = [];
      let cellIdx = 1;
      for (const cell of cells) {
        if (!cell.source) continue;
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        chunks.push({
          id: \`\${projectId}_\${file.path}_cell\${cellIdx}\`,
          projectId,
          fileId: file.path,
          relativePath: file.path,
          language: cell.cell_type === 'code' ? 'python' : 'markdown',
          symbol: \`Cell \${cellIdx} (\${cell.cell_type})\`,
          startLine: cellIdx,
          endLine: cellIdx,
          content: source,
          type: cell.cell_type === 'code' ? 'function' : 'text',
          hash: computeHash(source)
        });
        cellIdx++;
      }
      return chunks;
    } catch (err) {
      // fallback to text chunking if JSON parse fails
    }
  }
`;

code = code.replace(/if \(file\.isBinary\) return chunks;/, `if (file.isBinary) return chunks;\n${ipynbLogic}`);

fs.writeFileSync('knowledge-engine.ts', code);
