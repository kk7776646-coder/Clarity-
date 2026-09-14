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

    if (exportCancelBtn) {
      exportCancelBtn.addEventListener("click", () => {
        exportDropdown.style.display = "none";
      });
    }`;

const replaceStr = `  if (exportBtn && exportDropdown) {
    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
    });
    
    // Use named functions for global listeners so we can unbind them if needed, or just bind them uniquely
    if (!container._projExportListenersBound) {
        document.addEventListener("click", (e) => {
          if (!exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
            exportDropdown.style.display = "none";
          }
        });
        document.addEventListener("keydown", (e) => {
           if (e.key === "Escape" && exportDropdown.style.display === "block") {
               exportDropdown.style.display = "none";
           }
        });
        container._projExportListenersBound = true;
    }

    if (exportCancelBtn) {
      exportCancelBtn.addEventListener("click", () => {
        exportDropdown.style.display = "none";
      });
    }`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in project.js");
}
