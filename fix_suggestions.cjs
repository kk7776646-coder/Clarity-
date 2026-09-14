const fs = require('fs');
let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetBind = `  _bindSuggestionChips() {
    document.querySelectorAll("[data-suggestion]").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-suggestion");
        const input = document.getElementById("composerInput");
        if (input) {
          input.value = text;
          input.focus();
          const sendBtn = document.getElementById("composerSend");
          if (sendBtn) sendBtn.disabled = false;
        }
      });
    });
  },`;

const replaceBind = `  _bindSuggestionChips() {
    document.querySelectorAll("[data-suggestion]").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-suggestion");
        const input = document.getElementById("composerInput");
        if (input) {
          input.value = text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
          
          // Optionally auto-send
          const sendBtn = document.getElementById("composerSend");
          if (sendBtn) {
              sendBtn.disabled = false;
              sendBtn.click();
          }
        }
      });
    });
  },`;

if (js.includes(targetBind)) {
    js = js.replace(targetBind, replaceBind);
    fs.writeFileSync('js/ui/chat.js', js, 'utf8');
    console.log("Updated _bindSuggestionChips");
}
