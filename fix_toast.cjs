const fs = require('fs');

let chatJs = fs.readFileSync('js/ui/chat.js', 'utf8');
chatJs = chatJs.replace(/window\.Clarity\.ui\.showToast/g, "window.Clarity.toast.show");
fs.writeFileSync('js/ui/chat.js', chatJs, 'utf8');

let projJs = fs.readFileSync('js/pages/project.js', 'utf8');
projJs = projJs.replace(/window\.Clarity\.ui\.showToast/g, "window.Clarity.toast.show");
fs.writeFileSync('js/pages/project.js', projJs, 'utf8');

console.log("Fixed toasts.");
