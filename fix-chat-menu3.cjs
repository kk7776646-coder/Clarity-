const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetStr = `    if (!container._menuListenersBound) {
        document.addEventListener("click", (e) => {
           if (!container.contains(e.target) && dropdown.style.display === "block") {
               dropdown.style.display = "none";
           }
        });
        document.addEventListener("keydown", (e) => {
           if (e.key === "Escape" && dropdown.style.display === "block") {
               dropdown.style.display = "none";
           }
        });
        container._menuListenersBound = true;
    }`;

const replaceStr = `    if (!container._menuListenersBound) {
        document.addEventListener("click", (e) => {
           const cont = document.getElementById("mainExportContainer");
           const drop = document.getElementById("exportChatMainDropdown");
           if (cont && drop && drop.style.display === "block" && !cont.contains(e.target)) {
               drop.style.display = "none";
           }
        });
        document.addEventListener("keydown", (e) => {
           const drop = document.getElementById("exportChatMainDropdown");
           if (e.key === "Escape" && drop && drop.style.display === "block") {
               drop.style.display = "none";
           }
        });
        container._menuListenersBound = true;
    }`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/ui/chat.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in chat.js");
}
