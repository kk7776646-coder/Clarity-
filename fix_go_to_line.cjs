const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

file = file.replace('if (searchBtn) searchBtn.style.display = "none";', 'if (searchBtn) searchBtn.style.display = "flex";');
file = file.replace('if (jumpBtn) jumpBtn.style.display = "none";', 'if (jumpBtn) jumpBtn.style.display = "flex";');

const oldStr = `    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      const editorStage = document.getElementById("vscodeEditorStage");
      if (editorStage) {
        e.preventDefault();
        toggleInFileSearch(true);
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
      const editorStage = document.getElementById("vscodeEditorStage");
      if (editorStage) {
        e.preventDefault();
        promptJumpToLine();
      }
    }`;

const newStr = `    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      const viewer = document.getElementById("viewerContent");
      if (viewer && viewer.innerHTML.trim().length > 0) {
        e.preventDefault();
        toggleInFileSearch(true);
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
      const viewer = document.getElementById("viewerContent");
      if (viewer && viewer.innerHTML.trim().length > 0) {
        e.preventDefault();
        promptJumpToLine();
      }
    }`;

file = file.replace(oldStr, newStr);

fs.writeFileSync('js/pages/project.js', file, 'utf8');
console.log("Success");
