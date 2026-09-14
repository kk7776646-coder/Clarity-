const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetStr = `    if (!container._projExportListenersBound) {
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
    }`;

const replaceStr = `    if (!container._projExportListenersBound) {
        document.addEventListener("click", (e) => {
          const btn = document.getElementById("exportChatMenuBtn");
          const drop = document.getElementById("exportChatDropdown");
          if (btn && drop && drop.style.display === "block" && !btn.contains(e.target) && !drop.contains(e.target)) {
            drop.style.display = "none";
          }
        });
        document.addEventListener("keydown", (e) => {
           const drop = document.getElementById("exportChatDropdown");
           if (e.key === "Escape" && drop && drop.style.display === "block") {
               drop.style.display = "none";
           }
        });
        container._projExportListenersBound = true;
    }`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in project.js");
}
