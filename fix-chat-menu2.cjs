const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetStr = `    menuBtn.onclick = (e) => {
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

// Wait, the previous fix applied exactly this targetStr. 
// Let's make sure it handles click inside pdf button correctly if it hasn't already.
