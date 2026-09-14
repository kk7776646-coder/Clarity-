const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetStr = `  if (exportBtn && exportDropdown) {
    exportBtn.addEventListener("click", () => {
      exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
    });
    
    document.addEventListener("click", (e) => {
      if (!exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
        exportDropdown.style.display = "none";
      }
    });

    exportCancelBtn?.addEventListener("click", () => {
      exportDropdown.style.display = "none";
    });`;

const replaceStr = `  if (exportBtn && exportDropdown) {
    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
    });
    
    if (!container._projExportListenersBound) {
        document.addEventListener("click", (e) => {
          if (exportBtn && exportDropdown && !exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
            exportDropdown.style.display = "none";
          }
        });
        document.addEventListener("keydown", (e) => {
           if (e.key === "Escape" && exportDropdown && exportDropdown.style.display === "block") {
               exportDropdown.style.display = "none";
           }
        });
        container._projExportListenersBound = true;
    }

    exportCancelBtn?.addEventListener("click", () => {
      exportDropdown.style.display = "none";
    });`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in project.js");
}
