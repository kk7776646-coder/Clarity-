const fs = require('fs');

let file = fs.readFileSync('js/pages/project.js', 'utf8');

const target = `      content.innerHTML = [
        '<div class="vscode-editor-container">',
        '<div class="vscode-editor-bar">',
        '<span>Editing: <strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong></span>',
        '<span class="muted">Ctrl+S to save changes • Syncs project intelligence</span>',
        '</div>',
        '<textarea class="vscode-editor-textarea" id="vscodeEditTextarea" spellcheck="false">' + window.Clarity.utils.escapeHtml(currentFileContent) + '</textarea>',
        '</div>'
      ].join("");
      const ta = document.getElementById("vscodeEditTextarea");
      if (ta) {
        ta.focus();
        ta.addEventListener("keydown", (e) => {`;

const replacement = `      content.innerHTML = [
        '<div class="vscode-editor-container" style="display:flex; flex-direction:column; height:100%;">',
        '<div class="vscode-editor-bar">',
        '<span>Editing: <strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong></span>',
        '<span class="muted">Ctrl+S to save changes • Syncs project intelligence</span>',
        '</div>',
        '<div style="display:flex; flex:1; overflow:hidden; background:var(--surface);">',
        '<div id="vscodeEditLineNumbers" style="padding:16px 8px; text-align:right; font-family:var(--font-mono); font-size:13px; line-height:1.6; color:var(--ink-faint); border-right:1px solid var(--line); user-select:none; overflow:hidden; background:var(--surface-muted);">1</div>',
        '<textarea class="vscode-editor-textarea" id="vscodeEditTextarea" spellcheck="false" style="flex:1; margin:0; border:none; resize:none; padding-left:12px; background:var(--surface); color:var(--ink);">' + window.Clarity.utils.escapeHtml(currentFileContent) + '</textarea>',
        '</div>',
        '</div>'
      ].join("");
      const ta = document.getElementById("vscodeEditTextarea");
      const ln = document.getElementById("vscodeEditLineNumbers");
      if (ta) {
        if (ln) {
          const updateLines = () => {
             const lines = ta.value.split('\\n').length;
             ln.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br/>');
          };
          updateLines();
          ta.addEventListener('input', updateLines);
          ta.addEventListener('scroll', () => {
             ln.scrollTop = ta.scrollTop;
          });
        }
        ta.focus();
        ta.addEventListener("keydown", (e) => {`;

file = file.replace(target, replacement);
fs.writeFileSync('js/pages/project.js', file, 'utf8');

console.log("Success fixing edit lines");
