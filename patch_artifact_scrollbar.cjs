const fs = require('fs');
let code = fs.readFileSync('js/ui/artifact.js', 'utf8');

code = code.replace(
  /<div style="flex: 1; overflow: auto; background: #1e1e1e; color: #d4d4d4; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 20px; display: flex;" id="codeEditorViewport">/g,
  `<div style="flex: 1; overflow: auto; background: #1e1e1e; color: #d4d4d4; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 13px; line-height: 20px; display: flex; position: relative;" id="codeEditorViewport">`
);

code = code.replace(
  /<div id="codeGutter" style="padding: 12px 0; user-select: none; text-align: right; color: #858585; border-right: 1px solid #333333; background: #1e1e1e; min-width: 46px; flex-shrink: 0;">/g,
  `<div id="codeGutter" style="padding: 12px 0; user-select: none; text-align: right; color: #858585; border-right: 1px solid #333333; background: #1e1e1e; min-width: 46px; flex-shrink: 0; position: sticky; left: 0; z-index: 10;">`
);

code = code.replace(
  /<div id="codeBody" style="padding: 12px 16px; flex: 1; white-space: pre; overflow-x: auto; tab-size: 2;">/g,
  `<div id="codeBody" style="padding: 12px 16px; flex: 1; white-space: pre; overflow: visible; tab-size: 2; display: inline-block; min-width: max-content;">`
);

fs.writeFileSync('js/ui/artifact.js', code);
