const fs = require('fs');
let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const oldLogic = `          let htmlContent = clone.innerHTML;`;
const newLogic = `
          const userMsgs = clone.querySelectorAll(".message--user .message__bubble");
          userMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>You:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#4B5563";
            m.insertBefore(h, m.firstChild);
          });
          
          const aiMsgs = clone.querySelectorAll(".message--assistant .message__bubble, .project-chat-msg--ai");
          aiMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>Assistant:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#7C3AED";
            m.insertBefore(h, m.firstChild);
          });
          
          let htmlContent = clone.innerHTML;`;

js = js.replace(oldLogic, newLogic);
fs.writeFileSync('js/ui/chat.js', js, 'utf8');
console.log("Improved PDF content rendering.");
