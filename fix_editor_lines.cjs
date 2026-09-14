const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

const targetHTML = `      content.innerHTML = [
        '<div class="vscode-editor-container">',
        '<div class="vscode-editor-bar">',
        '<span>Editing: <strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong></span>',
        '<span class="muted">Ctrl+S to save changes • Syncs project intelligence</span>',
        '</div>',
        '<textarea class="vscode-editor-textarea" id="vscodeEditTextarea" spellcheck="false">' + window.Clarity.utils.escapeHtml(currentFileContent) + '</textarea>',
        '</div>'
      ].join("");`;

const replaceHTML = `      content.innerHTML = [
        '<div class="vscode-editor-container" style="display:flex; flex-direction:column; height:100%;">',
        '<div class="vscode-editor-bar" style="flex-shrink:0;">',
        '<span>Editing: <strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong></span>',
        '<span class="muted">Ctrl+S to save changes • Syncs project intelligence</span>',
        '</div>',
        '<div style="display:flex; flex:1; min-height:0; position:relative; overflow:hidden;">',
        '<div id="vscodeEditLineNumbers" style="padding:16px 8px; font-family:var(--font-mono); font-size:13px; line-height:20px; color:#858585; text-align:right; user-select:none; overflow:hidden; background:var(--surface); flex-shrink:0;"></div>',
        '<textarea class="vscode-editor-textarea" id="vscodeEditTextarea" spellcheck="false" style="flex:1; margin:0; border:none; outline:none; padding:16px; font-family:var(--font-mono); font-size:13px; line-height:20px; resize:none; white-space:pre; overflow:auto; background:transparent; color:inherit;">' + window.Clarity.utils.escapeHtml(currentFileContent) + '</textarea>',
        '</div>',
        '</div>'
      ].join("");`;

const targetJS = `      const ta = document.getElementById("vscodeEditTextarea");
      if (ta) {
        ta.focus();
        ta.addEventListener("keydown", (e) => {`;

const replaceJS = `      const ta = document.getElementById("vscodeEditTextarea");
      const ln = document.getElementById("vscodeEditLineNumbers");
      if (ta) {
        if (ln) {
          const updateLineNumbers = () => {
             const lines = ta.value.split(/\\r?\\n/).length;
             let html = "";
             for(let i=1; i<=lines; i++) html += i + "<br>";
             ln.innerHTML = html;
          };
          ta.addEventListener("input", updateLineNumbers);
          ta.addEventListener("scroll", () => {
             ln.scrollTop = ta.scrollTop;
          });
          updateLineNumbers();
        }
        ta.focus();
        ta.addEventListener("keydown", (e) => {`;

if (file.includes(targetHTML)) {
  file = file.replace(targetHTML, replaceHTML);
  file = file.replace(targetJS, replaceJS);
  fs.writeFileSync('js/pages/project.js', file, 'utf8');
  console.log("Success replacing line numbers.");
} else {
  console.log("Could not find target strings.");
}
