const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetStr = `    menuBtn.onclick = (e) => {
       e.stopPropagation();
       dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    };
    cancelBtn.onclick = () => {
       dropdown.style.display = "none";
    };
    document.addEventListener("click", (e) => {
       if (!container.contains(e.target)) dropdown.style.display = "none";
    });`;

const replaceStr = `    menuBtn.onclick = (e) => {
       e.stopPropagation();
       dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    };
    cancelBtn.onclick = () => {
       dropdown.style.display = "none";
    };
    if (!container._menuListenersBound) {
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

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/ui/chat.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in chat.js");
}
