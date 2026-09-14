const fs = require('fs');
let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const regex = /exportPdfBtn\?\.addEventListener\("click", async \(\) => \{[\s\S]*?\}\);\s*\}\s*\},/m;

const newBlock = `exportPdfBtn?.addEventListener("click", async () => {
        exportDropdown.style.display = "none";
        
        if (!window.html2pdf) {
            try {
                await new Promise((resolve, reject) => {
                   const s = document.createElement("script");
                   s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                   s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
                });
            } catch(e) {
               if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF library failed to load.", "danger");
               return;
            }
        }

        const feed = document.getElementById("conversationList");
        if (!feed) return;
        
        if (feed.classList.contains("conversation--empty")) {
            if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("No chat to export.", "info");
            return;
        }

        if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Generating PDF...", "info");

        try {
          const wrapper = document.createElement("div");
          wrapper.id = "mainExportContainer";
          wrapper.style.width = "800px"; 
          wrapper.style.padding = "40px";
          wrapper.style.background = "#ffffff";
          wrapper.style.color = "#000000";
          wrapper.style.position = "absolute";
          wrapper.style.left = "-9999px";
          wrapper.style.top = "0";
          
          const now = new Date();
          const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString();
          
          const header = document.createElement("h2");
          header.style.marginBottom = "24px";
          header.style.color = "#1e293b";
          header.style.fontFamily = "Inter, sans-serif";
          header.style.borderBottom = "1px solid #e2e8f0";
          header.style.paddingBottom = "12px";
          header.innerText = "Clarity Chat Export - " + dateStr;
          wrapper.appendChild(header);

          const clone = feed.cloneNode(true);
          
          clone.style.height = "auto";
          clone.style.maxHeight = "none";
          clone.style.overflow = "visible";
          clone.style.padding = "0";
          clone.style.margin = "0";

          clone.querySelectorAll("button, .spinner, .message__controls, .message__status").forEach(el => el.remove());
          
          const userMsgs = clone.querySelectorAll(".message--user .message__bubble");
          userMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>You:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#4B5563";
            h.style.fontFamily = "Inter, sans-serif";
            h.style.fontSize = "13px";
            m.insertBefore(h, m.firstChild);
            
            m.style.background = "#f3f4f6";
            m.style.color = "#111827";
            m.style.boxShadow = "none";
            m.style.border = "1px solid #e5e7eb";
            m.style.borderRadius = "8px";
            m.style.padding = "16px";
            m.style.marginBottom = "16px";
          });
          
          const aiMsgs = clone.querySelectorAll(".message--assistant .message__bubble, .project-chat-msg--ai");
          aiMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>Assistant:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#7C3AED";
            h.style.fontFamily = "Inter, sans-serif";
            h.style.fontSize = "13px";
            m.insertBefore(h, m.firstChild);
            
            m.style.background = "#ffffff";
            m.style.color = "#111827";
            m.style.boxShadow = "none";
            m.style.border = "1px solid #e5e7eb";
            m.style.borderRadius = "8px";
            m.style.padding = "16px";
            m.style.marginBottom = "16px";
          });

          clone.querySelectorAll("pre").forEach(pre => {
             pre.style.whiteSpace = "pre-wrap";
             pre.style.wordBreak = "break-word";
             pre.style.background = "#f8fafc";
             pre.style.border = "1px solid #cbd5e1";
             pre.style.padding = "12px";
             pre.style.borderRadius = "6px";
             pre.style.overflowX = "hidden";
          });
          
          // Force all svg/mermaid containers to wrap properly
          clone.querySelectorAll(".mermaid-container").forEach(c => {
              c.style.background = "#ffffff";
              c.style.border = "1px solid #e5e7eb";
          });

          wrapper.appendChild(clone);
          document.body.appendChild(wrapper);

          const opt = {
            margin:       10, // mm
            filename:     'Clarity_Chat_Export.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          window.html2pdf().set(opt).from(wrapper).save().then(() => {
             if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
             if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF Export successful!", "success");
          }).catch(err => {
             if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
             console.error("PDF Export error:", err);
             if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Failed to export PDF.", "danger");
          });

        } catch (err) {
          console.error("PDF setup error:", err);
          if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Failed to export PDF.", "danger");
        }
      });
    }
  },`;

if (regex.test(js)) {
   js = js.replace(regex, newBlock);
   fs.writeFileSync('js/ui/chat.js', js, 'utf8');
   console.log("Successfully replaced export logic");
} else {
   console.log("Regex not found");
}
