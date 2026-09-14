const fs = require('fs');

let file = fs.readFileSync('js/pages/project.js', 'utf8');

const target = `  function promptJumpToLine() {
    const rawLines = currentFileContent ? currentFileContent.split(/\\r?\\n/) : [""];
    const totalLines = rawLines.length;
    const input = prompt("Go to line (1 - " + totalLines + "):", activeLineNum || "1");
    if (input === null) return;
    const lineNum = parseInt(input.trim(), 10);
    if (isNaN(lineNum) || lineNum < 1 || lineNum > totalLines) {
      window.Clarity.toast.show("Please enter a valid line number between 1 and " + totalLines, "warning");
      return;
    }
    jumpToLine(lineNum, true);
  }`;

const replacement = `  function promptJumpToLine() {
    const rawLines = currentFileContent ? currentFileContent.split(/\\r?\\n/) : [""];
    const totalLines = rawLines.length;
    
    const body = \`
      <div style="margin-bottom:12px;">Enter line number (1 - \${totalLines}):</div>
      <input type="number" id="jumpToLineInput" class="input" min="1" max="\${totalLines}" value="\${activeLineNum || 1}" style="width:100%;">
    \`;
    const actions = \`
      <button class="btn btn--outline" data-modal-close="true">Cancel</button>
      <button class="btn btn--primary" id="confirmJumpBtn">Go</button>
    \`;
    
    window.Clarity.modal.open("Go to Line", body, actions);
    setTimeout(() => document.getElementById("jumpToLineInput")?.focus(), 100);
    
    const doJump = () => {
       const val = document.getElementById("jumpToLineInput").value;
       const lineNum = parseInt(val.trim(), 10);
       if (isNaN(lineNum) || lineNum < 1 || lineNum > totalLines) {
         window.Clarity.toast.show("Please enter a valid line number between 1 and " + totalLines, "warning");
         return;
       }
       window.Clarity.modal.close();
       
       if (editingFile) {
         const ta = document.getElementById("vscodeEditTextarea");
         if (ta) {
           const lines = ta.value.split(/\\r?\\n/);
           let pos = 0;
           for(let i=0; i<lineNum-1; i++) {
              pos += lines[i].length + 1;
           }
           ta.focus();
           ta.setSelectionRange(pos, pos);
           
           // Scroll to line
           const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20.8;
           ta.scrollTop = (lineNum - 1) * lineHeight;
         }
       } else {
         jumpToLine(lineNum, true);
       }
    };
    
    document.getElementById("confirmJumpBtn")?.addEventListener("click", doJump);
    document.getElementById("jumpToLineInput")?.addEventListener("keydown", (e) => {
       if (e.key === "Enter") {
         e.preventDefault();
         doJump();
       }
    });
  }`;

file = file.replace(target, replacement);
fs.writeFileSync('js/pages/project.js', file, 'utf8');

console.log("Success fixing jump to line");
