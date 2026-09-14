const fs = require('fs');
let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetBind = `      this._bindSuggestionChips();`;
const replaceBind = `      this._bindSuggestionChips();
      this._bindMainChatExportMenu();`;
js = js.replace(targetBind, replaceBind);

const targetMethod = `  _bindSuggestionChips() {`;
const newMethod = `  _bindMainChatExportMenu() {
    const exportBtn = document.getElementById("mainChatExportMenuBtn");
    const exportDropdown = document.getElementById("mainChatExportDropdown");
    const exportPdfBtn = document.getElementById("mainChatExportPdfBtn");
    const exportCancelBtn = document.getElementById("mainChatExportCancelBtn");

    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
      });

      if (!this._exportListenersBound) {
          document.addEventListener("click", (e) => {
            const drop = document.getElementById("mainChatExportDropdown");
            const btn = document.getElementById("mainChatExportMenuBtn");
            if (btn && drop && drop.style.display === "block" && !btn.contains(e.target) && !drop.contains(e.target)) {
              drop.style.display = "none";
            }
          });
          document.addEventListener("keydown", (e) => {
             const drop = document.getElementById("mainChatExportDropdown");
             if (e.key === "Escape" && drop && drop.style.display === "block") {
                 drop.style.display = "none";
             }
          });
          this._exportListenersBound = true;
      }

      exportCancelBtn?.addEventListener("click", () => {
        exportDropdown.style.display = "none";
      });

      exportPdfBtn?.addEventListener("click", async () => {
        exportDropdown.style.display = "none";
        if (!window.pdfMake || !window.htmlToPdfmake) {
            if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF library not loaded.", "danger");
            return;
        }

        const feed = document.getElementById("conversationList");
        if (!feed) return;
        
        if (feed.classList.contains("conversation--empty")) {
            if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("No chat to export.", "info");
            return;
        }

        if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Exporting chat to PDF...", "info");

        try {
          const clone = feed.cloneNode(true);
          clone.querySelectorAll("button, .spinner, .message__controls").forEach(el => el.remove());

          const imgs = clone.querySelectorAll("img");
          for (let img of imgs) {
            try {
              if (!img.src.startsWith("data:")) {
                const res = await fetch(img.src);
                const blob = await res.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise((resolve) => {
                  reader.onloadend = () => resolve(reader.result);
                  reader.readAsDataURL(blob);
                });
                img.src = dataUrl;
              }
            } catch (err) {
              console.warn("Failed to convert image for PDF", img.src, err);
            }
          }

          let htmlContent = clone.innerHTML;
          
          let val = window.htmlToPdfmake(htmlContent, {
            defaultStyles: {
              p: { margin: [0, 5, 0, 10], fontSize: 11, lineHeight: 1.5, color: "#1F2937" },
              h1: { fontSize: 20, bold: true, margin: [0, 15, 0, 5] },
              h2: { fontSize: 16, bold: true, margin: [0, 15, 0, 5] },
              h3: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
              pre: { font: "Courier", background: "#f1f5f9", margin: [0, 5, 0, 10], padding: 8, fontSize: 10 },
              code: { font: "Courier", fontSize: 10, background: "#f8fafc" },
              ul: { margin: [0, 5, 0, 10] },
              ol: { margin: [0, 5, 0, 10] },
              li: { margin: [0, 2, 0, 2] }
            }
          });

          const now = new Date();
          const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString();
          val.unshift({ text: "Clarity Chat Export - " + dateStr, style: "header", margin: [0, 0, 0, 20] });

          const docDefinition = {
            content: val,
            pageSize: "A4",
            pageMargins: [40, 40, 40, 40],
            defaultStyle: {
              font: "Roboto"
            },
            styles: {
              header: {
                fontSize: 18,
                bold: true,
                color: '#1e293b'
              }
            }
          };

          window.pdfMake.createPdf(docDefinition).download("Clarity_Chat_Export.pdf");
          if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF Export successful!", "success");

        } catch (err) {
          console.error("PDF Export error:", err);
          if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Failed to export PDF.", "danger");
        }
      });
    }
  },

  _bindSuggestionChips() {`;

js = js.replace(targetMethod, newMethod);
fs.writeFileSync('js/ui/chat.js', js, 'utf8');
console.log("Patched chat.js with export menu logic");
